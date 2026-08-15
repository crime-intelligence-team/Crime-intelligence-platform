# Crime Intelligence Platform — Backend

FastAPI + PostGIS + Neo4j crime-intelligence platform (Sprint 1, Phases 2–6:
districts/zones, dashboard, entities/relationships, cases/notes/export,
governance: step-up re-auth, alerts, redaction engine, access exceptions,
entity resolution, confidence review).

The full setup below is **verified on a clean checkout** (Phase 7,
component 1): fresh clone → empty volumes → build → migrations from empty
DB → seeds → one end-to-end request per phase.

## Prerequisites

- Docker with Compose v2 (`docker compose version`)
- A local `psql` client is optional (only needed for ad-hoc DB queries);
  `docker exec cip-postgres psql -U cip -d cip` works for that.

## Verified setup (from a clean checkout)

```bash
git clone <repo> Crime-intelligence-platform
cd Crime-intelligence-platform
cp apps/api/.env.example apps/api/.env        # REQUIRED — compose fails without it
docker compose up --build                     # postgres (healthy) + neo4j (healthy) + api
```

Wait until both DBs report healthy and `cip-api` is up, then:

```bash
curl http://localhost:8000/health
# expect: {"status":"ok", ...}
```

## Migrations

Run from the host against the empty Postgres (the compose `api` service
mounts the code, but alembic is invoked here for a clean log):

```bash
cd apps/api
DATABASE_URL=postgresql+psycopg2://cip:cip_dev_password@localhost:5432/cip \
  alembic upgrade head
```

Expected (empty DB, in order):

```
Running upgrade  -> d8b860383935, initial_models
Running upgrade d8b860383935 -> b3a7c11e4d92, add_alerts
Running upgrade b3a7c11e4d92 -> eb9e4c3f18a2, redaction_policy_decisions
Running upgrade eb9e4c3f18a2 -> f8a2b7d64c03, confidence_review_events
Running upgrade f8a2b7d64c03 -> a9c4e8d2f1b5, entity_resolution_events
```

## Seed data (in this order — later scripts resolve earlier rows by name)

```bash
docker exec cip-api python -m scripts.seed_dev_data              # districts, zones, 20 addresses, ADM/ANL/DTO officers, CASE-2026-0001
docker exec cip-api python -m scripts.seed_phase4_test_data      # SUP-0001 supervisor, PROTECTED address, protected person
docker exec cip-api python -m scripts.seed_phase4_relationships  # Neo4j nodes/edges + Postgres mirror rows (rel-e1..e5)
docker exec cip-api python -m scripts.seed_phase6_priority       # 2 vehicles + graph edges + mirrors (alert priority demo)
docker exec cip-api python -m scripts.seed_phase6_merge          # duplicate persons P1/P2 + protected + neutral (merge demo)
```

All officer passwords are `Password1!` (admin/ADM-0001, analyst/ANL-0001,
officer/DTO-0001, supervisor/SUP-0001, detective/DET-0001). Login field is
`username_or_official_id` (username works).

## Testing

The backend test suite has two layers (`apps/api/tests`, see
`docs/testing.md`):

- **Unit tests** (`tests/unit`) — pure domain logic (permission matrix,
  classification/score bands, redaction vocabulary, risk interpretation,
  case-number format). No database required:
  ```bash
  cd apps/api
  python -m pytest tests/unit
  ```
- **Integration tests** (`tests/integration`) — API-level auth, global
  search, and audit-log gating against a live Postgres. They self-provision
  their officers (no seed dependency) and **skip automatically** when the
  database is unreachable:
  ```bash
  cd apps/api && alembic upgrade head   # needs Postgres up first
  python -m pytest
  ```

CI (`.github/workflows/ci.yml`) runs the full backend suite against
Postgres + Neo4j services and typechecks/builds the frontend
(`apps/web`: `npx tsc -b && npm run build`).

## Smoke test (one request per phase)

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username_or_official_id":"admin","password":"Password1!"}'   # Sprint 1
curl http://localhost:8000/api/v1/districts -H "Authorization: Bearer $TOKEN"                          # Phase 2
curl http://localhost:8000/api/v1/dashboard/<CENTRAL_DISTRICT_ID> -H "Authorization: Bearer $TOKEN"    # Phase 3
curl 'http://localhost:8000/api/v1/entities/search?q=Phase4' -H "Authorization: Bearer $TOKEN"         # Phase 4
curl -X POST http://localhost:8000/api/v1/cases -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"case_number":"CASE-2026-9001","title":"smoke","district_id":"<EAST_DISTRICT_ID>"}'            # Phase 5
curl 'http://localhost:8000/api/v1/search?q=Smuggling' -H "Authorization: Bearer $TOKEN"                # Phase 5 (global search)
curl http://localhost:8000/api/v1/admin/audit -H "Authorization: Bearer $TOKEN"                         # Phase 5 (audit log, supervisor+)
# Phase 6: access exceptions (request + step-up approve), entity merge, confidence review
```

## API conventions

- Base path: `/api/v1` (map and network routers mount directly under it:
  `/districts`, `/entities/search`, … — not `/map/...`, `/network/...`).
- Error envelope: `{"error": {"code", "message", "details"}}`.
- Sensitive operations (case export, exception approval) require a fresh
  step-up assertion: `POST /auth/step-up` then send it as
  `X-Step-Up-Token` (see `docs/decisions/006`).
- All product decisions and deferred items live in `docs/decisions/`
  (001–012).
