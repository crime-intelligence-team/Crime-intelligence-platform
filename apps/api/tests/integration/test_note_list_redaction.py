"""Redaction engine scope extension (999 §2.5 / 008): note.body redaction
was export-pipeline-only; GET /cases/{id}/notes returned plain bodies even
when an active policy would have masked the same field on export. Proves
redaction_service.apply_note_list_redactions wires the SAME note.body
policy vocabulary into the live list path — masked while a matching
active policy exists, plain again once deactivated, untouched by
non-matching policies — against a live Postgres (no Neo4j needed).
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
        select(District).where(District.code == "IT-NOTEREDACT")
    ).scalar_one_or_none()
    if district is None:
        district = District(
            name="IT Note Redaction District",
            code="IT-NOTEREDACT",
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
def admin_headers(c):
    helpers.make_officer("it_noteredact_admin", Role.ADMINISTRATOR)
    return helpers.login(c, "it_noteredact_admin")


def _create_case_with_note(c, headers, district_id: str, body: str) -> tuple[str, str]:
    case_res = c.post(
        "/api/v1/cases",
        json={
            "case_number": f"IT-NOTEREDACT-{uuid.uuid4().hex[:10].upper()}",
            "title": "Note redaction test fixture",
            "district_id": district_id,
            "classification": "open_operational",
        },
        headers=headers,
    )
    assert case_res.status_code == 201, case_res.text
    case_id = case_res.json()["id"]

    note_res = c.post(
        f"/api/v1/cases/{case_id}/notes",
        json={"body": body, "visibility": "case_team", "classification": "open_operational"},
        headers=headers,
    )
    assert note_res.status_code == 201, note_res.text
    return case_id, note_res.json()["id"]


def _create_policy(c, headers, entity_type: str, field: str, min_classification: str) -> str:
    res = c.post(
        "/api/v1/redactions/policies",
        json={
            "entity_type": entity_type,
            "field": field,
            "min_classification": min_classification,
            "reason": "IT note-list redaction test",
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _note_body_in_list(c, headers, case_id: str, note_id: str):
    res = c.get(f"/api/v1/cases/{case_id}/notes", headers=headers)
    assert res.status_code == 200
    match = next(n for n in res.json()["items"] if n["id"] == note_id)
    return match["body"]


def test_note_list_unredacted_with_no_matching_policy(c, admin_headers, district_id):
    case_id, note_id = _create_case_with_note(
        c, admin_headers, district_id, "plain body, no policy should touch this"
    )
    body = _note_body_in_list(c, admin_headers, case_id, note_id)
    assert body == "plain body, no policy should touch this"


def test_note_list_redacted_by_active_policy_then_restored_on_deactivate(
    c, admin_headers, district_id
):
    case_id, note_id = _create_case_with_note(
        c, admin_headers, district_id, "sensitive note body under an active policy"
    )
    # Sanity: unredacted before any policy exists.
    assert _note_body_in_list(c, admin_headers, case_id, note_id) == (
        "sensitive note body under an active policy"
    )

    policy_id = _create_policy(c, admin_headers, "note", "body", "open_operational")
    try:
        body = _note_body_in_list(c, admin_headers, case_id, note_id)
        assert isinstance(body, dict), body
        assert body["redacted"] is True
        assert body["reason"] == "policy"
    finally:
        deactivate_res = c.post(
            f"/api/v1/redactions/policies/{policy_id}/deactivate", headers=admin_headers
        )
        assert deactivate_res.status_code == 200

    body_after = _note_body_in_list(c, admin_headers, case_id, note_id)
    assert body_after == "sensitive note body under an active policy"


def test_note_list_untouched_by_non_matching_policy_field(c, admin_headers, district_id):
    """A policy on a DIFFERENT entity_type/field (case.summary) must never
    mask note.body — the vocabulary match is exact, not a blanket switch."""
    case_id, note_id = _create_case_with_note(
        c, admin_headers, district_id, "unaffected by an unrelated policy"
    )
    policy_id = _create_policy(c, admin_headers, "case", "summary", "open_operational")
    try:
        body = _note_body_in_list(c, admin_headers, case_id, note_id)
        assert body == "unaffected by an unrelated policy"
    finally:
        c.post(f"/api/v1/redactions/policies/{policy_id}/deactivate", headers=admin_headers)


def test_note_list_redaction_writes_audit_entry(c, admin_headers, district_id):
    case_id, note_id = _create_case_with_note(
        c, admin_headers, district_id, "audited redaction body"
    )
    policy_id = _create_policy(c, admin_headers, "note", "body", "open_operational")
    try:
        _note_body_in_list(c, admin_headers, case_id, note_id)  # triggers the audit write
        audit_res = c.get(
            "/api/v1/admin/audit",
            params={"action": "note_list_redaction"},
            headers=admin_headers,
        )
        assert audit_res.status_code == 200
        entries = audit_res.json()["items"]
        assert any(e["resource_id"] == case_id for e in entries)
    finally:
        c.post(f"/api/v1/redactions/policies/{policy_id}/deactivate", headers=admin_headers)
