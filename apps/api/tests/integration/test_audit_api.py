"""Audit log endpoint (Phase 5) — gated audit:view, paginated, newest first.

Also covers the PRD security-section context fields added by migration
c1f4a8e6b2d7: actor_role/actor_district_id (snapshotted at write time,
never resolved later via a join — see AuditLogEntry's docstring), module,
and success, plus the module/success/date_from/date_to list filters.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from tests import helpers
from app.core.database import SessionLocal
from app.models.base import ClassificationLevel
from app.models.entities import District, Officer, Role

pytestmark = pytest.mark.skipif(
    not helpers.postgres_available(), reason="Postgres not reachable"
)


def _get_or_create_district(db) -> District:
    district = db.execute(
        select(District).where(District.code == "IT-AUDIT")
    ).scalar_one_or_none()
    if district is None:
        district = District(
            name="IT Audit District",
            code="IT-AUDIT",
            classification=ClassificationLevel.OPEN_OPERATIONAL,
        )
        db.add(district)
        db.flush()
        db.commit()
    return district


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
        for field in (
            "id", "action", "actor_name", "actor_role", "actor_district_id",
            "actor_district_name", "module", "success",
            "resource_type", "resource_id", "created_at",
        ):
            assert field in entry


def test_login_audit_entry_captures_role_and_module(c):
    """A login writes module="auth" and stamps the officer's CURRENT role/
    district onto the row (not left to be resolved by a later join)."""
    username = f"it_audit_ctx_{uuid.uuid4().hex[:8]}"
    db = SessionLocal()
    district = _get_or_create_district(db)
    district_id, district_name = str(district.id), district.name
    officer = helpers.make_officer(username, Role.DETECTIVE)
    officer = db.merge(officer)
    officer.home_district_id = district.id
    db.commit()
    db.close()

    helpers.make_officer("it_audit_ctx_viewer", Role.SUPERVISOR)
    viewer_headers = helpers.login(c, "it_audit_ctx_viewer")
    subject_headers = helpers.login(c, username)

    db = SessionLocal()
    officer_id = str(db.execute(select(Officer.id).where(Officer.username == username)).scalar_one())
    db.close()

    body = c.get(
        "/api/v1/admin/audit",
        params={"actor_id": officer_id, "action": "login", "page_size": 1},
        headers=viewer_headers,
    ).json()
    assert body["items"], body
    entry = body["items"][0]
    assert entry["module"] == "auth"
    assert entry["success"] is True
    assert entry["actor_role"] == Role.DETECTIVE.value
    assert entry["actor_district_id"] == district_id
    assert entry["actor_district_name"] == district_name


def test_role_change_does_not_rewrite_historical_audit_entry(c):
    """The bug this migration fixes: a role/district change AFTER an audit
    entry was written must never alter what that entry reports — it was a
    live join before, now it's a stamped snapshot. Uses a fresh, uniquely
    named officer each run so the starting role is deterministic regardless
    of leftover state from a previous test run."""
    username = f"it_audit_rewrite_{uuid.uuid4().hex[:8]}"
    helpers.make_officer(username, Role.DISTRICT_OFFICER)
    helpers.make_officer("it_audit_rewrite_viewer", Role.SUPERVISOR)
    viewer_headers = helpers.login(c, "it_audit_rewrite_viewer")

    helpers.login(c, username)  # first login, role=DISTRICT_OFFICER

    db = SessionLocal()
    officer = db.execute(
        select(Officer).where(Officer.username == username)
    ).scalar_one()
    officer_id = str(officer.id)
    officer.role = Role.ADMINISTRATOR
    db.commit()
    db.close()

    helpers.login(c, username)  # second login, role=ADMINISTRATOR (now)

    body = c.get(
        "/api/v1/admin/audit",
        params={"actor_id": officer_id, "action": "login", "page_size": 10},
        headers=viewer_headers,
    ).json()
    entries = sorted(body["items"], key=lambda e: e["created_at"])
    assert len(entries) >= 2, entries
    assert entries[0]["actor_role"] == Role.DISTRICT_OFFICER.value
    assert entries[-1]["actor_role"] == Role.ADMINISTRATOR.value


def test_failed_login_writes_success_false(c):
    officer = helpers.make_officer("it_audit_fail", Role.ANALYST)
    helpers.make_officer("it_audit_fail_viewer", Role.SUPERVISOR)
    viewer_headers = helpers.login(c, "it_audit_fail_viewer")

    res = c.post(
        "/api/v1/auth/login",
        json={"username_or_official_id": "it_audit_fail", "password": "WrongPassword!"},
    )
    assert res.status_code == 401

    body = c.get(
        "/api/v1/admin/audit",
        params={
            "actor_id": str(officer.id), "action": "login_failed",
            "success": False, "page_size": 10,
        },
        headers=viewer_headers,
    ).json()
    assert body["total"] >= 1
    assert all(e["success"] is False for e in body["items"])


def test_audit_module_filter(c):
    helpers.make_officer("it_audit_module_viewer", Role.SUPERVISOR)
    viewer_headers = helpers.login(c, "it_audit_module_viewer")

    body = c.get(
        "/api/v1/admin/audit",
        params={"module": "auth", "page_size": 20},
        headers=viewer_headers,
    ).json()
    assert body["total"] >= 1
    assert all(e["module"] == "auth" for e in body["items"])


def test_audit_date_range_filter(c):
    officer = helpers.make_officer("it_audit_daterange", Role.ANALYST)
    helpers.make_officer("it_audit_daterange_viewer", Role.SUPERVISOR)
    viewer_headers = helpers.login(c, "it_audit_daterange_viewer")
    helpers.login(c, "it_audit_daterange")  # writes a fresh "login" entry

    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    body = c.get(
        "/api/v1/admin/audit",
        params={"actor_id": str(officer.id), "action": "login", "date_from": future, "page_size": 10},
        headers=viewer_headers,
    ).json()
    assert body["total"] == 0, body

    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    body = c.get(
        "/api/v1/admin/audit",
        params={"actor_id": str(officer.id), "action": "login", "date_from": past, "page_size": 10},
        headers=viewer_headers,
    ).json()
    assert body["total"] >= 1, body
