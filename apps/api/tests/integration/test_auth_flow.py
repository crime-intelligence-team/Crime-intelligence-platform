"""Auth flow against a live Postgres (skips where the DB is unreachable).

These tests self-provision their officers, so they do not depend on seed
scripts — only on a migrated schema (CI runs alembic upgrade head first).
"""

import pytest

from tests import helpers
from app.models.entities import Role

pytestmark = pytest.mark.skipif(
    not helpers.postgres_available(), reason="Postgres not reachable"
)


@pytest.fixture(scope="module")
def c():
    return helpers.client()


def test_login_and_me(c):
    helpers.make_officer("it_admin", Role.ADMINISTRATOR)
    headers = helpers.login(c, "it_admin")
    res = c.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["username"] == "it_admin"
    assert body["role"] == "administrator"
    assert "entity:merge" in body["permissions"]
    assert "audit:view" in body["permissions"]


def test_wrong_password_returns_error_envelope(c):
    helpers.make_officer("it_wrong_pw", Role.ANALYST)
    res = c.post(
        "/api/v1/auth/login",
        json={"username_or_official_id": "it_wrong_pw", "password": "nope"},
    )
    assert res.status_code == 401
    body = res.json()
    assert "error" in body
    assert body["error"]["code"] == "invalid_credentials"


def test_me_requires_auth(c):
    res = c.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert "error" in res.json()


def test_unknown_role_cannot_merge(c):
    """Analyst is gated out of entity:merge — the admin-only surface."""
    helpers.make_officer("it_analyst", Role.ANALYST)
    headers = helpers.login(c, "it_analyst")
    body = c.get("/api/v1/auth/me", headers=headers).json()
    assert "entity:merge" not in body["permissions"]
