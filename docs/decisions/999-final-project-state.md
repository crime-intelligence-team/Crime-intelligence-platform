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

5. **Redaction engine scope** — engine runs only on case export;
   every other read path (dashboard, entity detail, note lists, search)
   uses the coarse classification-tier gate (008; 006 §6 #8/#15).
6. **MFA (TOTP)** — real step-up re-auth exists (`require_step_up_auth`,
   password re-check + purpose=step_up token); the OTP challenge is
   still a placeholder stub (006 §6 #9).
7. **Alert triggers** — live trigger: `confidence_change` only;
   `resurfaced_offender` / `new_inter_district_link` are
   schema-supported but have no ingestion path (007; 006 §6 #10).

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
- **OTP provider is fake** — login MFA and step-up both validate the
  same placeholder provider; parity is the property, not real TOTP (006
  §6 #9).
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
alert types exist but only 1 (confidence_change) can fire today**,
**the redaction engine serves 1 of ~6 read paths (export)**, **MFA is
real as step-up but TOTP is stubbed**, **merge hides absorbed entities
but does not re-point the graph**, and **attachments/pinned views were
never in scope**. Nothing deferred breaks a current read or write path;
the master list in §2 is the standing debt register, and the two
concurrency races found in Phase 7 were fixed and re-tested with the
same harness that proved them.
