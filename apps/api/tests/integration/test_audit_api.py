"""Audit log endpoint (Phase 5) — gated audit:view, paginated, newest first."""

import pytest

from tests import helpers
from app.models.entities import Role

pytestmark = pytest.mark.skipif(
    not helpers.postgres_available(), reason="Postgres not reachable"
)


def test_analyst_cannot_view_audit(c):
    helpers.make_officer("it_audit_analyst", Role.ANALYST)
    headers = helpers.login(c, "it_audit_analyst")
    res = c.get("/api/v1/admin/audit", headers=headers)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "permission_denied"


def test_supervisor_can_view_audit(c):
    helpers.make_officer("it_audit_supervisor", Role.SUPERVISOR)
    headers = helpers.login(c, "it_audit_supervisor")
    res = c.get("/api/v1/admin/audit", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert "items" in body and "total" in body and "page" in body and "page_size" in body
    # the login itself writes an audit entry, so the log is never empty here
    assert body["total"] >= 1
    assert isinstance(body["items"], list)


def test_audit_entry_shape(c):
    helpers.make_officer("it_audit_supervisor2", Role.SUPERVISOR)
    headers = helpers.login(c, "it_audit_supervisor2")
    body = c.get("/api/v1/admin/audit", params={"page_size": 5}, headers=headers).json()
    if body["items"]:
        entry = body["items"][0]
        for field in ("id", "action", "actor_name", "resource_type", "resource_id", "created_at"):
            assert field in entry
