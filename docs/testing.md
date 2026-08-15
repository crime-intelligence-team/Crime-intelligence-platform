# Testing

The backend test suite lives in `apps/api/tests`. It is split into two
layers so that pure logic is testable anywhere and API behaviour is tested
against a real database.

## Layout

```
apps/api/tests/
  helpers.py              shared utilities (test client, officer provisioning, login)
  unit/                   pure domain logic — no database required
    test_permissions.py       role -> permission matrix gates
    test_classification.py    tier gating + confidence score bands
    test_redaction_vocabulary.py  redaction entity/field vocabulary
    test_risk.py              zone interpretation boundaries
    test_confidence_review.py confidence review vocabulary
    test_case_number.py       case-number format validation
  integration/            API-level tests against a live Postgres
    test_health.py            /health (runs even without a DB)
    test_auth_flow.py         login -> /auth/me, permission surfaces, error envelope
    test_search_api.py        global search aggregator (Phase 5)
    test_audit_api.py         audit log gating + shape (Phase 5)
```

## Running

```bash
cd apps/api
python -m pytest tests/unit          # fast, no infrastructure
python -m pytest                     # integration tests skip if Postgres is down
```

The integration modules use `pytest.mark.skipif` on a connectivity probe,
so a clean checkout without a database still yields a green (mostly
skipped) run. They require a **migrated** schema (run
`alembic upgrade head` first) but not the seed scripts — each test
provisions its own officers via `tests/helpers.make_officer`.

## CI

`.github/workflows/ci.yml`:

- **backend** — starts PostGIS + Neo4j services, installs
  `apps/api/requirements.txt`, runs `alembic upgrade head`, then
  `python -m pytest -v`.
- **frontend** — installs `apps/web` deps, runs `npx tsc -b` then
  `npm run build`.

The integration tests assume the `cip`/`cip_dev_password`/`cip` database
credentials (the repo defaults) exposed on `localhost:5432`.
