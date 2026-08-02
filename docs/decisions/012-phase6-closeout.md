# 012 — Phase 6 close-out (all six governance components)

Status: accepted (Phase 6 close-out)
Date: 2026-08-01

## 1. Component-by-component verification status

| # | Component | Doc | Status | Proof highlights (real output, re-run at close-out) |
|---|-----------|-----|--------|----------------------------------------------------|
| 1 | Step-up re-auth | 001 | VERIFIED | export & exception-approve 401 `step_up_required` without assertion, 200 with; forged 16-min-stale iat token → 401 `session_expired`; sliding `X-Refresh-Token` present on every 200 (curl + client both observed) |
| 2 | Alerts / priority | 007 | VERIFIED | `alerts` table; alert:read gating; 3 confidence_change alerts retrievable at close-out incl. per-dispute alert id; priority rank from Neo4j degree (V1 = 3 edges) |
| 3 | Redaction engine | 008 | VERIFIED | export-only engine; SEALED-label proof; export with **0 active rules** byte-comparable to pre-component-3 baseline (same classification/note bodies/initiator, no RedactedField wrappers) |
| 4 | Access exceptions | 009 | VERIFIED | table pre-existed from Sprint 1 (alembic resolution below); before/during/after re-run live: 404 → request 201 → step-up approve 200 effective → GET/notes/export/note-create 200 → backdated expiry 404 + effective=false; tier orthogonality 404; audit 13 rows 1:1 |
| 5 | Entity resolution | 011 | VERIFIED | reverse round-trip (search 2 → merge → search 1), absorbed detail 404, `merged_into_id` pointer query, protected-block 422 both directions, audit 5 rows 1:1 |
| 6 | Confidence review | 010 | VERIFIED | before/after direct query 85→10, verified→unconfirmed, status→disputed; exactly one confidence_change alert per accepted dispute (id in audit detail); reject/confirm untouched; target-existence 404 with zero orphan events |

## 2. Cross-component regression (full pass, real output)

One script (`closeout_regression.py`, /tmp on container) exercises every
phase in sequence against the running system, twice — run-to-run
identical except the script's own created case number/id:

- Sprint 1: `/auth/me` 200; sliding refresh header present; MFA stub
  401 `invalid_challenge` (unknown challenge); DTO zone scoring 403
  `permission_denied`; stale-iat 401 `session_expired`.
- Phase 2: districts (CEN), summary open_cases, zone scores (2 zones,
  unconfirmed).
- Phase 3: dashboard DTO 403 (role-gated), analyst 200 full payload.
- Phase 4: search, protected flag redacted (officer) vs raw 1
  (supervisor), V1 relationships 3 (graph-backed).
- Phase 5: case create 201, note create 201 (case_team), export 200.
- Phase 6: C4 active exception grants EAST GET 200; C5 merged person
  hidden (search total 1, detail 404); C6 confidence_change alerts
  retrievable (3).
- Cross: export EAST under an ACTIVE exception with 0 active redaction
  rules → 200 unmasked (exception + redaction neutrality); absorbed
  entity id → 404 not error; confidence review against the absorbed
  entity's STILL-LIVE mirror edge → 201 (mirror survives the merge;
  no 404, no crash — the deferred graph re-pointing means the mirror
  remains a valid writable target, documented in 006 §6 #12).

## 3. Close-out fixes (real problems found, fixed, re-verified)

1. **Leftover active redaction rule** — `redaction_policy_decisions`
   had one rule (`3c91ba06`, case/summary ≥ PROTECTED, redact) left
   ACTIVE from the component-3 test cycle. Deactivated via the real
   API (200, active=false); active rules = 0; export neutrality
   re-proven. Not a code bug — a leftover-state bug in the test
   cycle, caught only by the full-pass regression.
2. **`require_roles(ADMIN)` on entity resolution** — the only Phase 6
   endpoints not on `require_permissions()`. Added `entity:merge`
   (ADMINISTRATOR-only) to ROLE_PERMISSIONS; both endpoints now use
   `require_permissions("entity:merge")`. Verified: supervisor 403
   `permission_denied` (was `role_not_permitted`), admin behavior
   unchanged.
3. **Unguarded GET /access-exceptions/requests** — carried only
   authentication. Now gated `case:read` (held by every role; the
   own-vs-all filter remains in the service). Verified detective +
   supervisor both 200.

## 4. Explicitly deferred (live gaps, all tracked in 006 §6)

- Neo4j edge re-pointing on entity merge (011; 006 §6 #12).
- Confidence review writes are mirror-only; safe on every current read
  path because the graph carries no confidence properties (000) and
  `network_service._relationship_out` reads only the mirror (006 §6 #13).
- Redaction engine is export-only; all other read paths use the coarse
  tier gate (006 §6 #8/#15).
- MFA verify remains an OTP-placeholder stub (step-up re-auth is real —
  006 §6 #9).
- resurfaced_offender / new_inter_district_link alert types exist but
  have no ingestion path to fire (006 §6 #10).
- Open schema questions: Case.address_id, real case-team membership,
  officer hierarchy, inter_unit note-level workflow, case renumbering
  orphaning exceptions, entity resolution data-undo (006 §6 #1-4, #12-14).

## 5. Completion

Every in-scope Phase 1-6 backend feature is implemented and verified
with real output. **Estimated overall backend completion: ~92%** — the
remainder is the deferred engines / schema questions above (Neo4j
sync on merge, MFA TOTP, note-level inter-unit workflow, real
case-team/hierarchy/address_id schema), none of which block any
current read or write path. Phase 7 (new features) can start; the
deferred list above is the standing debt register.
