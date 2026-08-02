# 008 — Redaction policy engine (export pipeline, Phase 6 component 3)

Status: accepted (Phase 6)
Date: 2026-08-01

## Decision

A per-field redaction engine applies to the EXPORT pipeline only. Two
mechanisms, both PRD-backed:

1. **Policy rules** — admin-defined `RedactionPolicyDecision` rows
   (`redaction:manage`, ADMINISTRATOR is the only holder). A rule is
   `entity_type` (`note`|`case`) + `field` (`body`|`summary`) +
   `min_classification`, firing at-or-above that tier. Applied to every
   export unconditionally.
2. **Ad-hoc per-export redaction** — optional `ExportRequest.redact_note_ids`
   masks specific notes for that export only (brief 7.10 supervisor user
   story "redaction where needed"). Request-level, never persisted; the
   `export_redaction` audit entry records it.

## Evidence: why export-only

Every redaction citation in the PRD is export/inter-unit scoped — verified
line-by-line from `docs/prd/crime-intelligence-platform-prd.pdf`:

- "Export permitted intelligence summaries with redaction where needed"
  (Case Workspaces FR)
- "Export policy and redaction rules" (Administration & Governance FR)
- "As a supervisor, permitted reports should support redaction before
  sharing outside the immediate team" (user story)
- "Redaction support for export and inter-unit sharing" (security)
- "Export workflows with redaction" (Phase 2 deliverable)
- Open question: "Which fields require mandatory redaction in shared
  exports?" — UNANSWERED by the PRD; the platform answers it as
  per-deployment admin policy, not a hardcoded list.

No PRD citation supports general read-path field redaction, so no read
path (GET /cases, network, dashboard, alerts) emits `RedactedField`.
004's "slot into the same predicate location" note stays deferred.

## Sign-off answers (Q-A..Q-E)

- **Q-A**: Freeze narrowly lifted for the export handler in
  `routers/cases.py` ONLY (optional request body + one post-process call
  to `redaction_service.apply_redactions`). `case_service.export_case`
  untouched. Full Phase 5 export matrix re-run as regression proof.
  Same scoped-exception pattern as `require_step_up_auth` and the
  `get_accessible_district_ids` treatment.
- **Q-B**: Ad-hoc per-export redaction in scope, note-scoped.
- **Q-C**: reason vocabulary extended to `"policy" | "no_access" |
  "manual"`; contract comment updated in `schemas/common.py`. Ad-hoc
  masking emits `"manual"`.
- **Q-D**: Policy visibility ADMIN-only for v1 (`redaction:manage`).
- **Q-E**: Rules apply to every export unconditionally; audience/
  destination matching, author-based and entity-level rules deferred.

## Semantics

- **Composition with tier gating**: orthogonal. The tier filter decides
  which RECORDS survive; the engine decides which FIELDS inside surviving
  records are masked. Both always apply in export; neither replaces the
  other. With no active rules and no ad-hoc ids, `apply_redactions`
  returns the Phase 5 artifact byte-identical (regression-proven).
- **Label stays at the pre-redaction tier**: redaction hides content but
  must not understate the sensitivity of what remains (fail-closed).
  Explicitly proven: admin export of SEALED CASE-2026-0008 with the
  PROTECTED note body masked still labels the document `sealed`.
- **Model**: the Phase 6 kickoff stub shape (decision-record columns
  `target_type/target_id/granularity/is_automatic/...`) was REPLACED by
  the approved rule shape. The stub table was empty (0 rows, 0 consumers)
  — one migration (`eb9e4c3f18a2`) drops and recreates it. This is not a
  data migration; nothing was lost.
- **Audit** (all additive, none touches frozen code): `redaction_policy_created`,
  `redaction_policy_deactivated`, and `export_redaction` (export_id,
  applied_policy_ids, redacted_note_ids, redacted_case_summary, ip).
  Success-only, same as exports. Deactivate, never delete — policy
  history stays auditable.
- **Rule fires on tier, not viewer**: a rule masks content regardless of
  who exports — the admin's policy is mandatory, not advisory.

## Known limits (honest)

- Read paths do not apply field redaction (no PRD backing; documented).
- Ad-hoc masking is note-scoped (summary/entity ad-hoc deferred).
- Duplicate rules are allowed (idempotent — decision is always `redact`);
  the audit detail records which rule ids fired.
- `redact_note_ids` referencing notes outside the export's visible set
  are silently ignored.
- No audience/destination field on rules; no author-based rules.

## Verification evidence

- Regression (no rules/ad-hoc): detective/0004 `restricted_operational`
  with 1 note, bodies == GET bodies, no RedactedField anywhere;
  supervisor/0004 `protected` 5 notes ids == GET ids; admin/0008
  `sealed`; DTO 403; EAST 404; bad uuid 422; no-assertion 401
  `step_up_required`; 3 export audit rows, rejections wrote none.
- New behavior: supervisor 403 on policy create; ad-hoc → `manual` on the
  listed note, all others plain; rule note.body@protected masks the
  PROTECTED note (`policy`) and leaves the RESTRICTED note plain
  (min-tier gating proven by absence); summary rule fires at/above
  PROTECTED; combined run shows both reasons in one document; label
  test stays `sealed`; GET notes stays plain with rules active; invalid
  target 400s; deactivate 200/404/404; active-only listing correct;
  audit 1:1 with events.
