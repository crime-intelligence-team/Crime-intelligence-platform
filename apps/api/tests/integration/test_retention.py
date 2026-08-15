"""Retention-eligibility policies (governance gap: no purge/archive
mechanism existed for case/entity/note data). Flag-only — verifies policy
CRUD, permission gating, vocabulary validation, and that candidate
counts/lists correctly reflect entity age plus the case status=closed
gate, computed inline against a live Postgres (no background job).
"""

import uuid
from datetime import datetime, timedelta, timezone

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
        select(District).where(District.code == "IT-RETENTION")
    ).scalar_one_or_none()
    if district is None:
        district = District(
            name="IT Retention District",
            code="IT-RETENTION",
            classification=ClassificationLevel.OPEN_OPERATIONAL,
        )
        db.add(district)
        db.flush()
        db.commit()
    return district


@pytest.fixture(scope="module")
def admin_headers(c):
    helpers.make_officer("it_retention_admin", Role.ADMINISTRATOR)
    return helpers.login(c, "it_retention_admin")


@pytest.fixture(scope="module")
def officer_headers(c):
    helpers.make_officer("it_retention_officer", Role.DISTRICT_OFFICER)
    return helpers.login(c, "it_retention_officer")


@pytest.fixture(scope="module")
def district_id():
    db = SessionLocal()
    try:
        return _get_or_create_district(db).id
    finally:
        db.close()


def _make_case(district_id, status: str, age_days: int) -> str:
    """Inserts a case directly (bypassing the API) so created_at can be
    backdated — retention eligibility depends on real age, which the API
    can't produce since created_at is a server default."""
    db = SessionLocal()
    try:
        case = Case(
            case_number=f"IT-RETENTION-{uuid.uuid4().hex[:10].upper()}",
            title="Retention test fixture",
            status=status,
            district_id=district_id,
            classification=ClassificationLevel.OPEN_OPERATIONAL,
        )
        db.add(case)
        db.flush()
        case.created_at = datetime.now(timezone.utc) - timedelta(days=age_days)
        db.commit()
        db.refresh(case)
        return str(case.id)
    finally:
        db.close()


def _deactivate(c, headers, policy_id: str):
    c.post(f"/api/v1/retention-policies/{policy_id}/deactivate", headers=headers)


# ── Permission gating (system:configure, Administrator only) ────────────────

def test_create_policy_requires_admin(c, officer_headers):
    res = c.post(
        "/api/v1/retention-policies",
        json={"entity_type": "case", "retention_days": 30, "reason": "test"},
        headers=officer_headers,
    )
    assert res.status_code == 403


def test_list_policies_requires_admin(c, officer_headers):
    res = c.get("/api/v1/retention-policies", headers=officer_headers)
    assert res.status_code == 403


def test_candidates_requires_admin(c, officer_headers):
    res = c.get(f"/api/v1/retention-policies/{uuid.uuid4()}/candidates", headers=officer_headers)
    assert res.status_code == 403


# ── Vocabulary validation ────────────────────────────────────────────────────

def test_create_policy_rejects_invalid_entity_type(c, admin_headers):
    res = c.post(
        "/api/v1/retention-policies",
        json={"entity_type": "bogus", "retention_days": 30, "reason": "test"},
        headers=admin_headers,
    )
    assert res.status_code == 422
    body = res.json()
    assert body["error"]["code"] == "invalid_entity_type"
    assert "case" in body["error"]["details"]["valid_entity_types"]


# ── CRUD + not-found paths ────────────────────────────────────────────────────

def test_create_list_deactivate_policy(c, admin_headers):
    res = c.post(
        "/api/v1/retention-policies",
        json={"entity_type": "person", "retention_days": 3650, "reason": "IT lifecycle test"},
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text
    policy = res.json()
    assert policy["entity_type"] == "person"
    assert policy["retention_days"] == 3650
    assert policy["active"] is True
    assert isinstance(policy["candidate_count"], int)

    listed = c.get("/api/v1/retention-policies", headers=admin_headers)
    assert listed.status_code == 200
    ids = {p["id"] for p in listed.json()["items"]}
    assert policy["id"] in ids

    res = c.post(f"/api/v1/retention-policies/{policy['id']}/deactivate", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["active"] is False

    # Re-deactivating an already-inactive policy 404s — soft state, never re-armed.
    res = c.post(f"/api/v1/retention-policies/{policy['id']}/deactivate", headers=admin_headers)
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "retention_policy_not_found"


def test_deactivate_unknown_policy_404(c, admin_headers):
    res = c.post(f"/api/v1/retention-policies/{uuid.uuid4()}/deactivate", headers=admin_headers)
    assert res.status_code == 404


def test_candidates_unknown_policy_404(c, admin_headers):
    res = c.get(f"/api/v1/retention-policies/{uuid.uuid4()}/candidates", headers=admin_headers)
    assert res.status_code == 404


# ── Eligibility semantics: the core inline age/status computation ───────────

def test_closed_case_past_window_is_candidate(c, admin_headers, district_id):
    case_id = _make_case(district_id, status=Case.STATUS_CLOSED, age_days=10)

    res = c.post(
        "/api/v1/retention-policies",
        json={"entity_type": "case", "retention_days": 5, "reason": "IT eligibility test"},
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text
    policy = res.json()
    assert policy["candidate_count"] >= 1

    candidates = c.get(f"/api/v1/retention-policies/{policy['id']}/candidates", headers=admin_headers)
    assert candidates.status_code == 200
    candidate_ids = {row["id"] for row in candidates.json()["items"]}
    assert case_id in candidate_ids

    _deactivate(c, admin_headers, policy["id"])


def test_open_case_past_window_is_never_a_candidate(c, admin_headers, district_id):
    """entity_type == "case" additionally requires status == closed — an
    old but still-open/under-investigation case must never be flagged
    regardless of age."""
    case_id = _make_case(district_id, status=Case.STATUS_OPEN, age_days=999)

    res = c.post(
        "/api/v1/retention-policies",
        json={"entity_type": "case", "retention_days": 5, "reason": "IT open-case exclusion test"},
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text
    policy = res.json()

    candidates = c.get(f"/api/v1/retention-policies/{policy['id']}/candidates", headers=admin_headers)
    candidate_ids = {row["id"] for row in candidates.json()["items"]}
    assert case_id not in candidate_ids

    _deactivate(c, admin_headers, policy["id"])


def test_closed_case_within_window_is_not_a_candidate(c, admin_headers, district_id):
    case_id = _make_case(district_id, status=Case.STATUS_CLOSED, age_days=1)

    res = c.post(
        "/api/v1/retention-policies",
        json={"entity_type": "case", "retention_days": 30, "reason": "IT within-window test"},
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text
    policy = res.json()

    candidates = c.get(f"/api/v1/retention-policies/{policy['id']}/candidates", headers=admin_headers)
    candidate_ids = {row["id"] for row in candidates.json()["items"]}
    assert case_id not in candidate_ids

    _deactivate(c, admin_headers, policy["id"])


def test_candidate_list_includes_age_and_label(c, admin_headers, district_id):
    case_id = _make_case(district_id, status=Case.STATUS_CLOSED, age_days=15)

    res = c.post(
        "/api/v1/retention-policies",
        json={"entity_type": "case", "retention_days": 5, "reason": "IT candidate-shape test"},
        headers=admin_headers,
    )
    policy = res.json()

    candidates = c.get(f"/api/v1/retention-policies/{policy['id']}/candidates", headers=admin_headers)
    row = next(r for r in candidates.json()["items"] if r["id"] == case_id)
    assert row["age_days"] >= 15
    assert "IT-RETENTION-" in row["label"]

    _deactivate(c, admin_headers, policy["id"])


def test_deactivated_policy_candidates_remain_visible(c, admin_headers, district_id):
    """Deactivation is a soft state flag on the policy row, not a purge —
    the candidate computation is unaffected by it and stays queryable for
    audit/history purposes (flag-only design: nothing is ever purged)."""
    case_id = _make_case(district_id, status=Case.STATUS_CLOSED, age_days=10)

    res = c.post(
        "/api/v1/retention-policies",
        json={"entity_type": "case", "retention_days": 5, "reason": "IT post-deactivation visibility test"},
        headers=admin_headers,
    )
    policy = res.json()
    _deactivate(c, admin_headers, policy["id"])

    candidates = c.get(f"/api/v1/retention-policies/{policy['id']}/candidates", headers=admin_headers)
    assert candidates.status_code == 200
    candidate_ids = {row["id"] for row in candidates.json()["items"]}
    assert case_id in candidate_ids
