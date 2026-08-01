# 010 — Confidence review / feedback loop (Phase 6 component 6)

Status: accepted (Phase 6)
Date: 2026-08-01

## Decision

A real confidence-review loop (brief 7.9) replacing the admin stubs:

- **Submit** (`POST /admin/confidence-review`) is now gated
  `confidence:review` — closes the Sprint-1 sweep gap where submit had
  NO permission gate (any authenticated officer could write a review).
  Both submit and decision are `confidence:review` (SUPERVISOR /
  ADMINISTRATOR hold it).
- **Targets**: `edge` (RelationshipEdgeRef) or `zone_score`
  (ZoneRiskScore) only. The stub's broader vocabulary (source /
  entity_resolution / alert) has no writable path this phase and is
  rejected at submit (422 invalid_target_type).
- **Mirror-only write path**: an ACCEPTED dispute writes the proposed
  score to the relational target — `confidence_score` +
  `confidence_band` (via band_for_score) and `verification_status =
  "disputed"` for edges. **Neo4j edge-property sync is explicitly
  DEFERRED and UNBUILT**: the graph keeps its old property until a later
  phase; a reader using the graph and a reader using the mirrors will
  disagree on this edge's confidence (the known, flagged gap).
- An accepted CONFIRM validates the current score by recorded review —
  no write, no alert.
- A REJECTED dispute changes nothing.

## The confidence_change Alert trigger (real, not vocabulary-only)

An accepted edge/zone-score dispute fires **exactly one** Alert of type
`confidence_change` via `alert_service.create_alert` (the write path
component 2 reserved). This is the one Alert type with genuine brief
support ("significant changes") and a real trigger; resurfaced_offender
and new_inter_district_link remain schema-supported but untriggered
(no ingestion path — 007).

Alert enrichment is honest about the schema: mirrors carry no endpoint
columns (007), so `entity_type`/`entity_id` stay NULL and the summary
names the relationship (id prefix + old/new score + reviewer).
`district_id` resolves from the edge's linked case when present (the
edge used in verification is case-linked to CEN → alert district CEN).
Alert `classification` = the target's own tier — so tier gating applies
naturally (the verification alert is RESTRICTED_OPERATIONAL; the
pre-existing component-2 fixture confidence_change alert is PROTECTED
and stays invisible to ANALYST — gating proven by absence).

## Model / migration

`ConfidenceReviewEvent` reshaped from the kickoff stub via drop+recreate
(`f8a2b7d64c03`, zero rows, zero consumers — same precedent as
`eb9e4c3f18a2`): `original_score`/`proposed_score` became Integer (the
targets hold ints), target vocabulary narrowed in the SERVICE (the
column stays String). review_status: pending | accepted | rejected |
escalated — escalate is not a v1 decision path (422).

## Inferred rules (flagged, not brief-specified)

- Reviewers may not decide on their own submissions (422
  `cannot_review_own_submission`) — same governance rule as access
  exceptions (009).
- `proposed_score` must be 0-100 for disputes (422 invalid_score);
  confirms ignore it.
- Decisions are accept | reject (422 otherwise); only pending reviews
  are decidable (422 invalid_transition).
- Target-existence is validated at SUBMIT: a nonexistent edge/zone-score
  id fails 404 `confidence_target_not_found` and creates NO event row
  (verified: zero orphan rows after the 404 submits).
- Accepted disputes set edges to verification_status `disputed` —
  inferred; the vocabulary {unverified, under_review, verified,
  disputed} existed before this component.

## Audit

`confidence_review_submitted` / `confidence_review_accepted` /
`confidence_review_rejected` — 6 rows for the verification run, 1:1
with events; detail carries target, action, original/proposed scores,
decision, and the fired alert id.

## Verification evidence (real output)

- Submit gate: DTO 403 permission_denied (no confidence:review).
- Validation: nonexistent edge 404 + zero orphan events; bad target_type
  422; bad action 422; score 500 422.
- Dispute path (rel-e1-phase4, 85/verified/verified, case-linked CEN):
  submit 201 pending (original 85, proposed 30); self-decision 422;
  admin accept 200; direct DB query shows the mirror now
  30/unconfirmed/**disputed**; re-decision 422.
- Reject path: dispute 85→10 rejected — target unchanged
  (85/verified/verified) in direct DB query.
- Confirm path: confirm accepted — target unchanged (60/probable) in
  direct DB query.
- Alert: exactly one confidence_change row matching the review's
  target (direct DB count = 1; the other visible confidence_change is
  the pre-existing component-2 PROTECTED fixture). GET /alerts:
  supervisor sees both (tier PROTECTED), analyst sees exactly one (the
  new RESTRICTED one — tier gating by absence), DTO 403 (no alert:read).

## Known limits (honest)

- Neo4j edge-property sync UNBUILT: graph and mirror disagree on a
  disputed edge's confidence until a later phase.
- No zone-score fixture exists, so the zone_score write path is
  implemented but unexercised by real data (flagged; same
  honest-coverage standard as every phase).
- `escalate` review status exists in the vocabulary but has no decision
  path (422).
- Reversal of a mistaken accepted dispute is a new dispute, not an undo.
