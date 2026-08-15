"""Case-status vocabulary widening (999 §2.4 / decision 006 §6 #11):
{open, closed} -> {open, under_investigation, pending_review, closed},
plus the first status-mutation path (PATCH /cases/{id}/status — status
was create-only before this). Against a live Postgres (no Neo4j needed).
"""

import uuid

import pytest
from sqlalchemy import select

from tests import helpers
from app.core.database import SessionLocal
from app.models.base import ClassificationLevel
from app.models.entities import Case, District, Role

pytestmark = pytest.mark.skipif(
    not helpers.postgres_available(), reason="Postgres not reachable"
)


def _get_or_create_district(db) -> District:
    district = db.execute(
        select(District).where(District.code == "IT-CASE")
    ).scalar_one_or_none()
    if district is None:
        district = District(
            name="IT Case Status District",
            code="IT-CASE",
            classification=ClassificationLevel.OPEN_OPERATIONAL,
        )
        db.add(district)
        db.flush()
        db.commit()
    return district


@pytest.fixture(scope="module")
def admin_headers(c):
    helpers.make_officer("it_case_status_admin", Role.ADMINISTRATOR)
    return helpers.login(c, "it_case_status_admin")


@pytest.fixture(scope="module")
def district_id():
    db = SessionLocal()
    try:
        return str(_get_or_create_district(db).id)
    finally:
        db.close()


def _create_case(c, headers, district_id: str, status: str = "open") -> dict:
    res = c.post(
        "/api/v1/cases",
        json={
            "case_number": f"IT-STATUS-{uuid.uuid4().hex[:10].upper()}",
            "title": "Case status test fixture",
            "district_id": district_id,
            "status": status,
            "classification": "open_operational",
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_create_case_accepts_widened_statuses(c, admin_headers, district_id):
    for value in ("under_investigation", "pending_review"):
        case = _create_case(c, admin_headers, district_id, status=value)
        assert case["status"] == value


def test_create_case_rejects_invalid_status(c, admin_headers, district_id):
    res = c.post(
        "/api/v1/cases",
        json={
            "case_number": f"IT-STATUS-{uuid.uuid4().hex[:10].upper()}",
            "title": "Case status test fixture",
            "district_id": district_id,
            "status": "bogus",
            "classification": "open_operational",
        },
        headers=admin_headers,
    )
    assert res.status_code == 422
    body = res.json()
    assert body["error"]["code"] == "invalid_status"
    assert set(body["error"]["details"]["valid_statuses"]) == {
        "open", "under_investigation", "pending_review", "closed",
    }


def test_list_cases_filters_by_new_status(c, admin_headers, district_id):
    case = _create_case(c, admin_headers, district_id, status="pending_review")
    res = c.get(
        "/api/v1/cases", params={"status": "pending_review"}, headers=admin_headers
    )
    assert res.status_code == 200
    ids = {item["id"] for item in res.json()["items"]}
    assert case["id"] in ids


def test_status_transition_endpoint(c, admin_headers, district_id):
    case = _create_case(c, admin_headers, district_id, status="open")

    res = c.patch(
        f"/api/v1/cases/{case['id']}/status",
        json={"status": "under_investigation"},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "under_investigation"

    res = c.patch(
        f"/api/v1/cases/{case['id']}/status",
        json={"status": "closed"},
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "closed"

    detail = c.get(f"/api/v1/cases/{case['id']}", headers=admin_headers)
    assert detail.status_code == 200
    assert detail.json()["status"] == "closed"


def test_status_transition_idempotent_noop(c, admin_headers, district_id):
    case = _create_case(c, admin_headers, district_id, status="open")
    res = c.patch(
        f"/api/v1/cases/{case['id']}/status",
        json={"status": "open"},
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "open"


def test_status_transition_invalid_value(c, admin_headers, district_id):
    case = _create_case(c, admin_headers, district_id, status="open")
    res = c.patch(
        f"/api/v1/cases/{case['id']}/status",
        json={"status": "bogus"},
        headers=admin_headers,
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "invalid_status"


def test_status_transition_case_not_found(c, admin_headers):
    res = c.patch(
        f"/api/v1/cases/{uuid.uuid4()}/status",
        json={"status": "closed"},
        headers=admin_headers,
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "case_not_found"


def test_dashboard_open_cases_counts_non_open_active_statuses(c, admin_headers, district_id):
    before = c.get(f"/api/v1/dashboard/{district_id}", headers=admin_headers)
    assert before.status_code == 200
    before_open = before.json()["kpis"]["open_cases"]

    _create_case(c, admin_headers, district_id, status="under_investigation")

    after = c.get(f"/api/v1/dashboard/{district_id}", headers=admin_headers)
    assert after.status_code == 200
    after_open = after.json()["kpis"]["open_cases"]

    assert after_open == before_open + 1
