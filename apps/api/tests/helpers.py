"""Shared test helpers.

`postgres_available()` drives the integration-test skip: the API suite is
self-contained per test (fixtures insert their own officers), but it needs
a reachable Postgres with a migrated schema. Locally (no DB / stub driver)
the integration modules skip; in CI the postgres service provides it.
"""

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.database import SessionLocal, engine
from app.core.security import hash_password
from app.graph.driver import get_driver
from app.main import app
from app.models.entities import Officer, Role


def postgres_available() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("select 1"))
        return True
    except Exception:
        return False


def graph_available() -> bool:
    try:
        get_driver().verify_connectivity()
        return True
    except Exception:
        return False


def client() -> TestClient:
    return TestClient(app)


def make_officer(
    username: str,
    role: Role,
    password: str = "Password1!",
    manager_id=None,
) -> Officer:
    """Idempotently create an MFA-disabled officer for API tests.
    manager_id (re)applies on every call, including to a pre-existing
    officer, so module-scoped fixtures stay correct across reruns."""
    db = SessionLocal()
    try:
        officer = db.query(Officer).filter(Officer.username == username).first()
        if officer is None:
            officer = Officer(
                official_id=f"IT-{username.upper()}",
                username=username,
                hashed_password=hash_password(password),
                full_name=f"IT {username}",
                role=role,
                manager_id=manager_id,
                mfa_enabled=0,
                is_active=1,
            )
            db.add(officer)
            db.commit()
            db.refresh(officer)
        elif officer.manager_id != manager_id:
            officer.manager_id = manager_id
            db.commit()
            db.refresh(officer)
        return officer
    finally:
        db.close()


def login(c: TestClient, username: str, password: str = "Password1!") -> dict[str, str]:
    """Return an Authorization header for a direct (MFA-disabled) login."""
    res = c.post(
        "/api/v1/auth/login",
        json={"username_or_official_id": username, "password": password},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["mfa_required"] is False, body
    return {"Authorization": f"Bearer {body['access_token']}"}
