# 999 — Final Project State (Phase 7, consolidated)

Status: final. This doc is the single consolidated state for the
Crime Intelligence Platform backend at the end of Phase 7 (hardening).
It supersedes the per-phase lists in 006 §6, 009, 010, 011, 012 only
for *reading* the current state; those docs remain the authoritative
decision records for *why*.

## 1. Per-phase status

| Phase | Scope | Status |
|---|---|---|
| Sprint 1 | Models, auth (login/logout/me, JWT, MFA stub), PostGIS/Neo4j services, districts/zones, error envelope | COMPLETE, verified |
| Phase 2 | Zone risk scoring + risk:compute, jurisdiction scoping (002) | COMPLETE, verified |
| Phase 3 | Dashboard (region KPIs, classification-gated trends), alert/priority stubs (001) | COMPLETE, verified |
| Phase 4 | Entity search/detail/relationships, graph store split (000), relationship gating (005) | COMPLETE, verified |
| Phase 5 | Cases (create/detail/notes/attachments-stub/export), note visibility tiers, dashboard gating | COMPLETE, verified |
| Phase 6 | 6 components: step-up re-auth (real), alerts/priority (real, degree-based), redaction engine (export-only), access exceptions (real, case-scoped), entity resolution (persons only, graph re-point deferred), confidence review (mirror-only) | COMPLETE, verified (close-out 012) |
| Phase 7 | Hardening: clean-checkout build proof (component 1), concurrency checks (component 2), this doc (component 3) | COMPLETE |

Migrations, empty DB → head (verified on a fresh clone, in order):
`d8b860383935` → `b3a7c11e4d92` → `eb9e4c3f18a2` → `f8a2b7d64c03` →
`a9c4e8d2f1b5` → `7d2c1e4f9b3a` (concurrency guard, Phase 7). 20 tables.

### Phase 7 component 1 — clean-checkout proof (real output, fresh clone)

Verified on a fresh `git clone` at commit 652a43e with wiped volumes:
`docker compose up --build` (postgres/neo4j healthy) → migrations from
empty DB in the exact order above → `GET /health` 200 → seeds applied →
one real request per phase, all green:

- Sprint 1: `POST /auth/login` + `GET /auth/me` (admin/administrator).
- Phase 2: `GET /districts` → CEN + EAST with geometry.
- Phase 3: `GET /dashboard/{CEN}` → KPIs/trends.
- Phase 4: `GET /entities/search?q=Phase4` → person; `GET /entities/{id}/relationships` → 6 edges (4 phase-4 + 2 vehicle), tier/band-filtered.
- Phase 5: case create 201 → note 201 → export 200 (step-up-gated, redaction engine output).
- Phase 6: access exception 404→request→step-up approve (`effective: true`)→200; entity merge `merged`, search total 1; confidence dispute→accept (mirror 85→40, exactly one `confidence_change` alert); redaction policies 200.

Setup gaps found and fixed (seed-only + README, no runtime code):

1. Fresh clone had no `apps/api/.env` — `docker compose config` fails
   hard. Documented: `cp apps/api/.env.example apps/api/.env` (README).
2. `seed_phase4_relationships.py` hardcoded entity UUIDs; the companion
   seeds create rows with random UUIDs, so on a clean checkout the graph
   attached to phantom nodes and every relationship list was empty
   (and confidence review had no reachable target). Fixed: resolve ids
   by name/raw-text lookup at seed time.
3. Phase 6 fixture scripts (merge, priority) existed only in /tmp —
   checked in as `seed_phase6_merge.py`, `seed_phase6_priority.py`
   (priority fixture also id-resolves; both idempotent).
4. README rewritten with the verified clone→run sequence.

### Phase 7 component 2 — concurrency checks (real output)

| Check | Result | Action |
|---|---|---|
| Zone scoring, 3 concurrent runs | 200×3, exactly 3 rows per zone, deterministic scores, no errors | None needed |
| 2 concurrent approvals, same pending request | BOTH 200 / effective true, 2 audit rows (race) | Fixed + re-tested |
| 2 concurrent merges, same absorbed person | BOTH 201, 2 events (race) | Fixed + re-tested |

Fixes (approved; migration shown in full before applying):

- `access_exception_service._transition`: `SELECT ... FOR UPDATE` on the
  request row. Re-test: one 200 `approved`, one 422 `invalid_transition`,
  exactly one `exception_approved` audit row.
- `entity_resolution_service.merge_entities`: `SELECT ... FOR UPDATE` on
  both person rows, plus partial unique index
  `entity_resolution_events(absorbed_entity_id) WHERE reversed_at IS NULL`
  (migration `7d2c1e4f9b3a`; reversal frees the row for re-merge).
  Re-test: one 201 `merged`, one 422 `already_merged`, exactly one event.

## 2. Open questions and deferred surface (deduplicated master list)

Grouped by kind; origins in parentheses. Nothing on this list blocks a
current read or write path.

### Schema questions (need a migration to resolve)

1. **Case.address_id / case↔zone linkage** — never built; create_case
   does not populate or depend on it (006 §3).
2. **Real case-team membership** — no junction table; `case_team`
   visibility is minimum-viable lead-or-author (006 §4).
3. **Real officer hierarchy** — no `manager_id`/org table; supervisory
   note tier is role-collapsed to SUPERVISOR/ADMINISTRATOR (006 §4).
4. **Case-status vocabulary** — only `{open, closed}`; no wider
   vocabulary (006 §6 #11).

### Deferred engines / seams (explicitly later-phase)

5. **Redaction engine scope** — engine runs on case export and
   entity detail (follow-up component 2); the remaining read paths
   (dashboard, note lists, search/list labels) use the coarse
   classification-tier gate (008; 006 §6 #8/#15).
6. **MFA (TOTP)** — resolved as part of the Phase 7 follow-up
   (component 1): real RFC 6238 enrollment, challenge and step-up; see
   the TOTP follow-up section below.
7. **Alert triggers** — live trigger: `confidence_change` only. The two
   PRD 180 triggers stay untriggered for two SEPARATE reasons, never one
   combined line (007; 006 §6 #10):
   - `resurfaced_offender` is schema-blocked: the model carries no
     longitudinal activity timeline (persons have only `created_at`;
     graph edges have `effective_from`/`effective_to`; nothing records
     last-seen or disappearance), so "resurfacing" has no observable
     state to fire on. Would need a NEW activity-timeline schema
     (e.g. sightings/last-seen events) — not an ingestion path on the
     current schema.
   - `new_inter_district_link` is event-source-blocked: no edge-creation
     path exists at runtime (`RelationshipEdgeRef` rows are created only
     by seed scripts — verified across services/routers), and the only
     entity with a `district_id` is Address — persons, vehicles, devices
     and organizations carry no district attribute, and mirrors do not
     store endpoints. Would need a NEW edge-creation event source plus a
     district model for non-address entities.
   Both remain listed in the vocabulary (007) and fire on nothing until
   the respective schema/event work lands.

### Live gaps (real, current-state, not latent bugs)

8. **Neo4j edge re-pointing on merge** — absorbed person's graph edges
   survive and remain reachable by the absorbed id (which 404s through
   the API); mirrors of those edges are real data and remain writable
   (confidence review works against them). Re-pointing at query time is
   open work (011; 006 §6 #12).
9. **Confidence writes are mirror-only** — safe on every current read
   path because the graph carries no confidence properties (000) and
   reads come exclusively from `RelationshipEdgeRef`; a future feature
   storing confidence on Neo4j must sync or re-derive (010; 006 §6 #13).
10. **Merge reversal has no data undo** — reversal un-marks visibility
    and stamps `reversed_at`; field copies stay on the primary.
    Recovery = reversal + manual split (011; 006 §6 #14).
11. **Exceptions are case-scoped and case-number-bound** — case-scoped
    only (district-scoped deliberately not built); links by string case
    reference, never notes; case renumbering would orphan them (009).
12. **Attachment endpoint is a stub** — zero PRD occurrences; needs a
    storage decision to revisit (006 §1).

## 3. Non-bug limitations (working as built)

- **Zone scoring is synchronous** — the request blocks on the run; no
  job/queue layer exists (003; 006 §6 #7).
- **In-memory pagination** — relationship lists and confidence surfaces
  paginate in Python after full materialization; Cypher/SQL-level paging
  is future perf work, not a correctness issue.
- **OTP provider** — real TOTP (RFC 6238) since the follow-up
  (component 1): enrollment, login challenge and step-up all verify
  real codes via pyotp; no fake provider remains.
- **Dashboard is region-scoped only** — one region id, KPIs + trends;
  no cross-region or org-wide view.
- **Scoring inputs are density-only** — address density is the sole
  spatial input; no incident/gang data is wired (003).
- **`version: "3.9"` in docker-compose.yml** — obsolete attribute,
  ignored with a warning; harmless.

## 4. Verified setup (standalone)

The full sequence below was executed on a genuinely clean checkout
(Phase 7 component 1); README.md has the same steps with expected output.

```bash
git clone <repo> && cd Crime-intelligence-platform
cp apps/api/.env.example apps/api/.env        # REQUIRED — compose fails without it
docker compose up --build                     # wait: postgres + neo4j healthy, api up

curl http://localhost:8000/health             # {"status":"ok",...}

cd apps/api
DATABASE_URL=postgresql+psycopg2://cip:cip_dev_password@localhost:5432/cip \
  alembic upgrade head                        # 6 revisions, d8b860383935 -> 7d2c1e4f9b3a

# seeds, in order (later scripts resolve earlier rows by name):
docker exec cip-api python -m scripts.seed_dev_data
docker exec cip-api python -m scripts.seed_phase4_test_data
docker exec cip-api python -m scripts.seed_phase4_relationships
docker exec cip-api python -m scripts.seed_phase6_priority
docker exec cip-api python -m scripts.seed_phase6_merge

# officers: admin/ADM-0001, analyst/ANL-0001, officer/DTO-0001,
# supervisor/SUP-0001, detective/DET-0001 — all password Password1!
# login field: username_or_official_id; base path /api/v1;
# error envelope: {"error": {"code","message","details"}}
```

## 5. Honest completion

Every feature in the brief's in-scope surface through Phase 6 is
implemented, and Phase 7 re-verified the whole chain from a clean
checkout with real requests per phase. The earlier close-out estimate
(~92% backend) holds as a *surface* figure, but it must be read with
the honest breakdown: of the platform's richer behaviors, **3 of 3
alert types exist but only 1 (confidence_change) can fire today** (the
other two are blocked by distinct schema/event-source gaps — §2.7),
**the redaction engine serves 2 of ~6 read paths (export + entity
detail)**, **MFA is real TOTP end to end**, **merge hides absorbed
entities but does not re-point the graph**, and
**attachments/pinned views were never in scope**. Nothing deferred
breaks a current read or write path; the master list in §2 is the
standing debt register, and the two concurrency races found in Phase 7
were fixed and re-tested with the same harness that proved them.

## 6. Phase 7 follow-up (approved proposals, all verified)

Three follow-up components were agreed and built on top of the Phase 7
state; each was verified with real requests and real data, then
committed separately.

**6.1 Real TOTP MFA (component 1; commits c347612)** — the enrollment
stub from Phase 6 is replaced by RFC 6238 TOTP (pyotp, `valid_window=1`
clock drift).

- Schema: `officers.totp_secret` (base32) + `officers.totp_enrolled_at`
  (migration `5e3a9b8c1d4f`). The migration also runs the approved
  one-time correction `UPDATE officers SET mfa_enabled=0 WHERE
  totp_secret IS NULL`; at apply time the dangerous state
  (mfa_enabled=1 without a secret) was **0 rows**, and the UPDATE
  matched all 5 officers (all already 0) — a proven no-op, printed by
  the migration itself. The down-migration drops ONLY the two columns
  and never restores mfa_enabled (verified down/up live: columns 2 -> 0
  -> 2, mfa_enabled untouched). MFA now means "enrolled AND enabled".
- Endpoints: `POST /auth/mfa/enroll` (password re-auth; returns
  `totp_secret` + `otpauth_url`, no QR image — frontend renders),
  `POST /auth/mfa/confirm` (code must verify; only then
  `mfa_enabled=1`), `POST /auth/mfa/disable` (step-up-gated AND
  password re-check; clears secret + flag). Login challenge
  (`mfa/verify`) and step-up verify real codes.
- Verified flow (admin, real pyotp-generated codes): enroll with wrong
  password 401 / right 200; confirm with bad code 401 (still disabled)
  / real code 200 (enabled); login -> challenge; verify bad 401 / real
  200; step-up bad 400 / real 200; disable without step-up 401 (shared
  `require_step_up_auth` behavior, same as export), with step-up + bad
  password 401, with both 200 (disabled); post-disable login returns a
  direct token. Audit 1:1 (`mfa_enroll_failed` / `mfa_enroll_initiated`
  / `mfa_confirm_failed` / `mfa_enrolled` / `mfa_verification_failed` /
  `mfa_verified` / `mfa_disable_failed` / `mfa_disabled`).

**6.2 Entity-detail field redaction (component 2; commit 89e7205)** —
the export-only engine now also serves the entity detail read path,
same policy mechanics (`_matches` classification threshold, reason
vocabulary, only-success audit).

- Vocabulary extension (governance.py): new entity type `entity`
  (shared field `entity.label`) plus per-type fields — `person.aliases`
  (whole-field masking; per-item deferred indefinitely),
  `person.date_of_birth`, `organization.org_type`,
  `vehicle.registration_number/make/model/color`,
  `device.phone_number/imei/device_type`, `address.raw_text` (12
  fields in total, per the approved list). Unredactable by design:
  `id`, `type`, `classification`, `district_id`,
  `is_protected_subject` (the last stays tier-gated, orthogonal to
  field redaction).
- Read shape: the 12 fields are `T | RedactedField | None` in
  `EntityDetail`; `EntitySummary.label` stays `str` (search/list
  out of scope). `network_service.get_entity` passes every matched
  detail through `redaction_service.apply_entity_redactions`
  (one `entity_redaction` audit row per masked detail, listing masked
  fields + fired policy ids).
- Verified: with zero rules, 5 baseline fetches (person/raj/address/
  vehicle as admin + person as officer) are **byte-identical** to the
  pre-change captures; with all 12 rules at
  `restricted_operational`, person masks label+aliases+date_of_birth,
  address masks label+raw_text, vehicle masks
  label+registration_number+make+model (absent `color` stays absent),
  officer-tier `is_protected_subject` keeps its `no_access` redaction;
  search still returns plain labels. Rules were then deactivated and
  the byte-identical regression re-passed.

**6.3 Alert-trigger verdict (component 3, doc-only; this file §2.7)** —
the two untriggered PRD 180 alerts stay unbuilt, recorded as two
DISTINCT blockers: `resurfaced_offender` needs a new activity-timeline
schema (nothing records last-seen/disappearance), and
`new_inter_district_link` needs a new edge-creation event source (no
runtime path writes `RelationshipEdgeRef` today) plus a district model
for non-address entities. Neither is "one generic blocked" — they are
different missing systems with different fixes.
