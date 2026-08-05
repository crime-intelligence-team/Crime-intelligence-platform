"""Real case-team membership (999 §2.2 / decision 006 §4): case_team note
visibility was lead-officer-or-author only because no membership table
existed. Proves GET/POST/DELETE /cases/{id}/team, and that a note tier'd
case_team becomes visible to an added member (previously invisible),
against a live Postgres (no Neo4j needed).
"""

import uuid

import pytest
from sqlalchemy import select

from tests import helpers
from app.core.database import SessionLocal
from app.models.base import ClassificationLevel
from app.models.entities import District, Role

pytestmark = pytest.mark.skipif(
    not helpers.postgres_available(), reason="Postgres not reachable"
)


def _get_or_create_district(db) -> District:
    district = db.execute(
        select(District).where(District.code == "IT-TEAM")
    ).scalar_one_or_none()
    if district is None:
        district = District(
            name="IT Case Team District",
            code="IT-TEAM",
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
def lead_headers(c):
    # ADMINISTRATOR: unrestricted jurisdiction, so create_case's
    # district-in-jurisdiction check passes without setting home_district_id.
    helpers.make_officer("it_team_lead", Role.ADMINISTRATOR)
    return helpers.login(c, "it_team_lead")


@pytest.fixture(scope="module")
def member_officer(c):
    # SUPERVISOR: also unrestricted jurisdiction (so the case itself is
    # visible regardless of team membership) and has note:read, but is NOT
    # automatically on any case team and doesn't match supervisory_chain
    # visibility either — a clean subject for the case_team-only check.
    return helpers.make_officer("it_team_member", Role.SUPERVISOR)


@pytest.fixture(scope="module")
def member_headers(c, member_officer):
    return helpers.login(c, "it_team_member")


def _create_case(c, headers, district_id: str) -> dict:
    res = c.post(
        "/api/v1/cases",
        json={
            "case_number": f"IT-TEAM-{uuid.uuid4().hex[:10].upper()}",
            "title": "Case team test fixture",
            "district_id": district_id,
            "classification": "open_operational",
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_team_list_includes_lead_as_synthetic_entry(c, lead_headers, district_id):
    case = _create_case(c, lead_headers, district_id)
    res = c.get(f"/api/v1/cases/{case['id']}/team", headers=lead_headers)
    assert res.status_code == 200
    members = res.json()
    assert len(members) == 1
    assert members[0]["officer_id"] == case["lead_officer_id"]
    assert members[0]["is_lead"] is True
    assert members[0]["added_at"] is None


def test_add_and_list_team_member(c, lead_headers, member_officer, district_id):
    case = _create_case(c, lead_headers, district_id)
    res = c.post(
        f"/api/v1/cases/{case['id']}/team",
        json={"officer_id": str(member_officer.id)},
        headers=lead_headers,
    )
    assert res.status_code == 201, res.text
    added = res.json()
    assert added["officer_id"] == str(member_officer.id)
    assert added["is_lead"] is False
    assert added["added_at"] is not None

    res = c.get(f"/api/v1/cases/{case['id']}/team", headers=lead_headers)
    assert res.status_code == 200
    ids = {m["officer_id"] for m in res.json()}
    assert ids == {case["lead_officer_id"], str(member_officer.id)}


def test_add_lead_officer_rejected(c, lead_headers, district_id):
    case = _create_case(c, lead_headers, district_id)
    res = c.post(
        f"/api/v1/cases/{case['id']}/team",
        json={"officer_id": case["lead_officer_id"]},
        headers=lead_headers,
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "already_team_member"


def test_add_duplicate_member_rejected(c, lead_headers, member_officer, district_id):
    case = _create_case(c, lead_headers, district_id)
    res1 = c.post(
        f"/api/v1/cases/{case['id']}/team",
        json={"officer_id": str(member_officer.id)},
        headers=lead_headers,
    )
    assert res1.status_code == 201

    res2 = c.post(
        f"/api/v1/cases/{case['id']}/team",
        json={"officer_id": str(member_officer.id)},
        headers=lead_headers,
    )
    assert res2.status_code == 409
    assert res2.json()["error"]["code"] == "already_team_member"


def test_add_nonexistent_officer_rejected(c, lead_headers, district_id):
    case = _create_case(c, lead_headers, district_id)
    res = c.post(
        f"/api/v1/cases/{case['id']}/team",
        json={"officer_id": str(uuid.uuid4())},
        headers=lead_headers,
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "officer_not_found"


def test_remove_team_member(c, lead_headers, member_officer, district_id):
    case = _create_case(c, lead_headers, district_id)
    c.post(
        f"/api/v1/cases/{case['id']}/team",
        json={"officer_id": str(member_officer.id)},
        headers=lead_headers,
    )
    res = c.delete(
        f"/api/v1/cases/{case['id']}/team/{member_officer.id}", headers=lead_headers
    )
    assert res.status_code == 200, res.text

    listing = c.get(f"/api/v1/cases/{case['id']}/team", headers=lead_headers)
    ids = {m["officer_id"] for m in listing.json()}
    assert str(member_officer.id) not in ids


def test_remove_nonmember_rejected(c, lead_headers, member_officer, district_id):
    case = _create_case(c, lead_headers, district_id)
    res = c.delete(
        f"/api/v1/cases/{case['id']}/team/{member_officer.id}", headers=lead_headers
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "team_member_not_found"


def test_remove_lead_officer_rejected(c, lead_headers, district_id):
    case = _create_case(c, lead_headers, district_id)
    res = c.delete(
        f"/api/v1/cases/{case['id']}/team/{case['lead_officer_id']}", headers=lead_headers
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "cannot_remove_lead_officer"


def test_re_add_after_remove_creates_fresh_row(c, lead_headers, member_officer, district_id):
    case = _create_case(c, lead_headers, district_id)
    c.post(
        f"/api/v1/cases/{case['id']}/team",
        json={"officer_id": str(member_officer.id)},
        headers=lead_headers,
    )
    c.delete(f"/api/v1/cases/{case['id']}/team/{member_officer.id}", headers=lead_headers)

    res = c.post(
        f"/api/v1/cases/{case['id']}/team",
        json={"officer_id": str(member_officer.id)},
        headers=lead_headers,
    )
    assert res.status_code == 201, res.text


def test_added_member_can_see_case_team_note(
    c, lead_headers, member_officer, member_headers, district_id
):
    """The actual point of this whole feature: a case_team note is invisible
    to an officer who is neither lead nor author nor team member, and
    becomes visible the moment they're added — proving _note_visible's new
    team_officer_ids branch, not just the CRUD endpoints in isolation."""
    case = _create_case(c, lead_headers, district_id)

    note_res = c.post(
        f"/api/v1/cases/{case['id']}/notes",
        json={"body": "case_team visibility test note", "visibility": "case_team"},
        headers=lead_headers,
    )
    assert note_res.status_code == 201, note_res.text

    before = c.get(f"/api/v1/cases/{case['id']}/notes", headers=member_headers)
    assert before.status_code == 200
    assert "case_team visibility test note" not in [
        n["body"] for n in before.json()["items"]
    ]

    add_res = c.post(
        f"/api/v1/cases/{case['id']}/team",
        json={"officer_id": str(member_officer.id)},
        headers=lead_headers,
    )
    assert add_res.status_code == 201, add_res.text

    after = c.get(f"/api/v1/cases/{case['id']}/notes", headers=member_headers)
    assert after.status_code == 200
    assert "case_team visibility test note" in [
        n["body"] for n in after.json()["items"]
    ]
