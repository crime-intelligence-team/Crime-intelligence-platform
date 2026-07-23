# Crime Intelligence Platform — Backend (Phase 0)

## What's here

Phase 0 scaffold: repo structure, Docker services (Postgres+PostGIS, Neo4j,
FastAPI), SQLAlchemy models for the core entities + governance tables,
Pydantic schemas encoding the classification/confidence contract rules,
and stub routers for the full endpoint surface in the brief's §8 — so the
OpenAPI contract exists and the frontend can build against it immediately.

Everything here was written and syntax-checked in a sandbox without
network access, so it has **not been run yet**. Do this first:

## First run (do this, not me — I don't have network access in my sandbox)

```bash
cd Crime-intelligence-platform
cp apps/api/.env.example apps/api/.env
docker compose up --build
```

Then in another terminal, check it actually came up:

```bash
curl http://localhost:8000/health
# expect: {"status":"ok","environment":"development"}
```

If that works, generate the OpenAPI contract file the frontend team will use:

```bash
docker compose exec api python export_openapi.py
docker compose cp api:/app/openapi.json ./docs/openapi.json
```

Commit `docs/openapi.json` — that's the artifact that unblocks frontend.

## Database migrations

No migrations exist yet — this is the very next task. Once models are
confirmed stable:

```bash
docker compose exec api alembic revision --autogenerate -m "initial schema"
docker compose exec api alembic upgrade head
```

## If docker compose fails

Most likely causes, in order of likelihood:

1. Ports 5432 / 7474 / 7687 / 8000 already in use locally — stop other
   Postgres/Neo4j instances or change the port mapping in `docker-compose.yml`.
2. `requirements.txt` version conflicts — I pinned versions based on what's
   current as of my training, worth double-checking `pip install` doesn't
   throw resolver errors before assuming the code itself is broken.
3. GeoAlchemy2/PostGIS — the `postgis/postgis` image handles the extension
   automatically, but if you swap to a bare `postgres` image you'll need
   `CREATE EXTENSION postgis;` manually.

## What's stubbed vs. real

- **Real:** repo structure, model schema, Pydantic contract shapes, RBAC
  dependency wiring, Docker orchestration, Alembic setup.
- **Stub (returns placeholder data):** every route body. They're shape-correct
  against `docs/decisions.md` and the brief's §8, but none of them touch the
  database yet. That's Phase 1 onward — see the plan in chat / `docs/decisions.md`.

## Next task after this runs successfully

Phase 1: real auth — password verification against `Officer.hashed_password`,
real MFA challenge issuance, real JWT in `/auth/login` + `/auth/mfa/verify`,
and audit logging on every auth event. Everything downstream assumes this
layer is real, so it goes first.
