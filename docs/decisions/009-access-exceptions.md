# 009 — Cross-district access exceptions (Phase 6 component 4)

Status: accepted (Phase 6)
Date: 2026-08-01

## Decision

Case-scoped access exceptions (brief 7.2): an approved, unexpired
exception lets the REQUESTING officer see ONE case (referenced by case
number) that their jurisdiction would otherwise hide. Implemented on
the stub `access_exception_requests` table — no migration was needed;
the Phase 6 kickoff stub shape (case_reference, operational_reason,
requested_duration_hours, status, reviewed_*, expires_at) matched the
approved design as-is.

## Alembic resolution (Phase 6 close-out — explicit, plain)

`access_exception_requests` was created by the ORIGINAL initial
migration `d8b860383935` (Sprint 1, 16 tables), NOT by any Phase 6
revision. No migration was silently skipped: alembic head
`a9c4e8d2f1b5` (entity_resolution_events) and the initial migration
are the only DDL authors of this table. Live DB schema (information_schema,
checked at close-out) vs the initial migration — column-by-column identical:

```
 id                        uuid          NOT NULL  PK
 requested_by_id           uuid          NOT NULL  FK officers.id
 case_reference            varchar       NOT NULL
 operational_reason        text          NOT NULL
 requested_duration_hours  varchar       NOT NULL
 status                    varchar       NOT NULL
 reviewed_by_id            uuid          NULL      FK officers.id
 reviewed_at               timestamptz   NULL
 scope_json                text          NULL
 expires_at                timestamptz   NULL
 created_at                timestamptz   NULL      default now()
 updated_at                timestamptz   NULL      default now()
```

Component 4's needs — case_reference (case-scoped lookup by number),
operational_reason, requested_duration_hours, the status vocabulary
(pending|approved|denied|revoked; expired is derived, never written),
reviewed_by_id/reviewed_at (reviewer identity), expires_at (inline
expiry) — were ALL present from Sprint 1. Phase 6 added only
service/router logic and the `_visible_case_stmt` funnel lift. No
schema work was required or skipped.

## Enforcement — decision 002's reserved "second filter layer"

`case_service._visible_case_stmt` — the single visibility funnel shared
by list/get/notes/export/note-create — gained a sanctioned narrow lift:
when the officer is jurisdiction-filtered, approved-unexpired exception
case ids are OR-ed into the district scope. Tier filtering is untouched:
an exception widens jurisdiction ONLY, never the classification gate
(proven: a PROTECTED CEN case stays 404 for a detective even with an
approved exception — D6-D8 below).

- Approval is step-up gated (`require_step_up_auth` + `exception:approve`):
  the most sensitive governance action in this component. Deny/revoke
  are `exception:approve`-gated without step-up (documented asymmetry).
  The request-list endpoint is gated `case:read` (every role holds it;
  visibility filtering — own vs all — happens in the service; the gate
  was added at Phase 6 close-out, the endpoint previously carried only
  authentication).
- Expiry is checked INLINE at read/enforcement time — no background job.
  An expired exception grants nothing; the stored status stays
  `approved` and the response exposes `effective: bool` (derived).
- Status vocabulary: pending | approved | denied | revoked. Transitions:
  pending->approved|denied, approved->revoked. Invalid transitions 422.

## Inferred rules (flagged, not brief-specified)

- `requested_duration_hours` is whole hours 1..8760, validated at request
  time; `expires_at` = approval time + duration.
- Requesters may not review their own requests (422
  `cannot_review_own_request`).
- Duplicate active requests (pending, or approved-and-unexpired) for the
  same requester+case are rejected (409) — inferred, documented.
- Request is gated on `case:read` (every role holds it); the referenced
  case must EXIST by number (404) but visibility is deliberately NOT
  required — requesting access to an out-of-jurisdiction case is the point.
- Reviewer identity is recorded both on the row and in the audit entry.
- Approval writes no note-level grants: `inter_unit_approved` note
  visibility stays on the case-team gate (006 open question).

## Audit

exception_requested (requester), exception_approved / exception_denied /
exception_revoked (reviewer) — all with case_reference detail. 9 rows
for the verification run, 1:1 with events.

## Verification evidence (real output)

- **Regression first**: full case matrix (list/get/notes/note-create/
  case-create validation across all 5 roles, 33 assertions) + full
  export matrix (13 assertions incl. step-up, redaction neutrality,
  audit counts) — run-to-run byte-identical before/after the lift.
  The only baseline delta ever observed was the regression script's own
  created note (visibility case_team, invisible to the checker's role —
  fixed by checking from the author's view); export matrix identical.
- **Before/during/after** (detective, home CEN, CASE-2026-0002 EAST
  restricted): 404 before; request 201 pending/effective=false;
  duplicate 409; nonexistent case 404; bad duration 422; self-approve
  401 without assertion then 403 with (step-up precedes permission,
  same ordering as export); approve without step-up 401; approve with
  step-up 200 effective=true expires=+1h; during: GET 200, notes 200,
  in list, export 200, note-create 201; tier orthogonality: approved
  exception on PROTECTED CEN case still 404; after DB-backdated
  expires_at (2h past): GET 404, notes 404, absent from list,
  status=approved effective=false.
- Transitions: deny 200, re-deny 422, approve-then-revoke 200, re-revoke
  422, unknown id 404, bad uuid 422; officers see own requests,
  SUPERVISOR/ADMINISTRATOR see all.

## Known limits

- No background expiry job (inline check is the design; a job is a
  future option, not needed for correctness).
- Enforcement covers the case funnel only; entity search / network /
  dashboard remain jurisdiction-scoped by their own untouched machinery.
- Case-references are numbers, not ids: case renumbering would orphan
  exceptions (no renumbering path exists today).
- The `expired` status value in the model comment is never written —
  expiry is derived at read time.
