"""Real officer hierarchy (999 §2.3 / 006 §4): supervisory_chain note
visibility was a role-collapse (any SUPERVISOR/ADMINISTRATOR could see any
supervisory_chain note), flagged as "weaker than a chain implies." Proves
GET /officers, PATCH /officers/{id}/manager (incl. self/cycle rejection),
and that a supervisory_chain note is visible to a real transitive manager
but NOT to an unrelated supervisor — against a live Postgres (no Neo4j
needed).
"""

import uuid

import pytest
from sqlalchemy import select

from tests import helpers
from app.core.database import SessionLocal
from app.models.base import ClassificationLevel
from app.models.entities import District, Role
from app.services import officer_service

pytestmark = pytest.mark.skipif(
    not helpers.postgres_available(), reason="Postgres not reachable"
)


def _get_or_create_district(db) -> District:
    district = db.execute(
        select(District).where(District.code == "IT-HIER")
    ).scalar_one_or_none()
    if district is None:
        district = District(
            name="IT Hierarchy District",
            code="IT-HIER",
            classification=ClassificationLevel.OPEN_OPERATIONAL,
        )
        db.add(district)
        db.flush()
        db.commit()
    return district


@pytest.fixture(scope="module")
def district_id():
    db = SessionLocal()
    try:
        return str(_get_or_create_district(db).id)
    finally:
        db.close()


@pytest.fixture(scope="module")
def admin(c):
    return helpers.make_officer("it_hier_admin", Role.ADMINISTRATOR)


@pytest.fixture(scope="module")
def admin_headers(c, admin):
    return helpers.login(c, "it_hier_admin")


@pytest.fixture(scope="module")
def grand_manager(c):
    return helpers.make_officer("it_hier_grand_manager", Role.SUPERVISOR)


@pytest.fixture(scope="module")
def manager(c, grand_manager):
    return helpers.make_officer("it_hier_manager", Role.SUPERVISOR, manager_id=grand_manager.id)


@pytest.fixture(scope="module")
def manager_headers(c, manager):
    return helpers.login(c, "it_hier_manager")


@pytest.fixture(scope="module")
def report(c, manager):
    # SUPERVISOR (not DETECTIVE/DISTRICT_OFFICER): unrestricted jurisdiction
    # and case:write/note:create, so this officer can create its own case
    # and post its own note without a home_district_id detour. Author role
    # is irrelevant to the supervisory_chain check under test — only the
    # VIEWER'S role and manager_id ancestry matter (case_service._note_visible).
    return helpers.make_officer("it_hier_report", Role.SUPERVISOR, manager_id=manager.id)


@pytest.fixture(scope="module")
def report_headers(c, report):
    return helpers.login(c, "it_hier_report")


@pytest.fixture(scope="module")
def unrelated_supervisor(c):
    return helpers.make_officer("it_hier_unrelated_supervisor", Role.SUPERVISOR)


@pytest.fixture(scope="module")
def unrelated_supervisor_headers(c, unrelated_supervisor):
    return helpers.login(c, "it_hier_unrelated_supervisor")


@pytest.fixture(scope="module")
def analyst_headers(c):
    helpers.make_officer("it_hier_analyst", Role.ANALYST)
    return helpers.login(c, "it_hier_analyst")


def test_get_subordinate_officer_ids_transitive(grand_manager, manager, report):
    db = SessionLocal()
    try:
        subs = officer_service.get_subordinate_officer_ids(db, grand_manager.id)
        assert manager.id in subs
        assert report.id in subs
    finally:
        db.close()


def test_list_officers_requires_permission(c, admin_headers, analyst_headers):
    res = c.get("/api/v1/officers", headers=admin_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    res = c.get("/api/v1/officers", headers=analyst_headers)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "permission_denied"


def test_set_manager_requires_officer_manage(c, admin_headers, unrelated_supervisor_headers, report):
    # SUPERVISOR has officer:view but not officer:manage.
    res = c.patch(
        f"/api/v1/officers/{report.id}/manager",
        json={"manager_id": None},
        headers=unrelated_supervisor_headers,
    )
    assert res.status_code == 403


def test_set_manager_success(c, admin_headers, unrelated_supervisor, manager, report):
    res = c.patch(
        f"/api/v1/officers/{report.id}/manager",
        json={"manager_id": str(unrelated_supervisor.id)},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["manager_id"] == str(unrelated_supervisor.id)

    # restore report -> manager (the chain later tests in this module,
    # notably the supervisory_chain visibility test, depend on).
    res2 = c.patch(
        f"/api/v1/officers/{report.id}/manager",
        json={"manager_id": str(manager.id)},
        headers=admin_headers,
    )
    assert res2.status_code == 200
    assert res2.json()["manager_id"] == str(manager.id)


def test_set_manager_self_rejected(c, admin_headers, report):
    res = c.patch(
        f"/api/v1/officers/{report.id}/manager",
        json={"manager_id": str(report.id)},
        headers=admin_headers,
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "cannot_be_own_manager"


def test_set_manager_nonexistent_manager_rejected(c, admin_headers, report):
    res = c.patch(
        f"/api/v1/officers/{report.id}/manager",
        json={"manager_id": str(uuid.uuid4())},
        headers=admin_headers,
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "manager_not_found"


def test_set_manager_nonexistent_officer_rejected(c, admin_headers):
    res = c.patch(
        f"/api/v1/officers/{uuid.uuid4()}/manager",
        json={"manager_id": None},
        headers=admin_headers,
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "officer_not_found"


def test_set_manager_cycle_rejected(c, admin_headers, grand_manager, report):
    # report's chain is report -> manager -> grand_manager. Assigning
    # grand_manager's manager to report would close a cycle.
    res = c.patch(
        f"/api/v1/officers/{grand_manager.id}/manager",
        json={"manager_id": str(report.id)},
        headers=admin_headers,
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "manager_cycle"


def _create_case(c, headers, district_id: str) -> dict:
    res = c.post(
        "/api/v1/cases",
        json={
            "case_number": f"IT-HIER-{uuid.uuid4().hex[:10].upper()}",
            "title": "Hierarchy test fixture",
            "district_id": district_id,
            "classification": "open_operational",
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_supervisory_chain_note_visible_to_real_manager_not_unrelated_supervisor(
    c,
    admin_headers,
    report_headers,
    manager_headers,
    unrelated_supervisor_headers,
    district_id,
):
    """The actual point of this feature: grand_manager -> manager -> report.
    A supervisory_chain note authored by report must be visible to manager
    (direct) and grand_manager (transitive, via /notes as manager's own
    chain-holder role) but invisible to an unrelated supervisor with no
    ancestry relationship to report."""
    case = _create_case(c, report_headers, district_id)
    note_res = c.post(
        f"/api/v1/cases/{case['id']}/notes",
        json={"body": "supervisory chain visibility test", "visibility": "supervisory_chain"},
        headers=report_headers,
    )
    assert note_res.status_code == 201, note_res.text

    def _sees_note(headers) -> bool:
        res = c.get(f"/api/v1/cases/{case['id']}/notes", headers=headers)
        assert res.status_code == 200
        return "supervisory chain visibility test" in [n["body"] for n in res.json()["items"]]

    assert _sees_note(manager_headers) is True
    assert _sees_note(unrelated_supervisor_headers) is False
