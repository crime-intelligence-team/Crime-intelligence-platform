"""Attachment endpoint (006 §1 / 999 §2.12): was a stub with no
auth-visibility gate and no storage. Proves upload/list/download against
a real local-disk backend — case visibility gating, classification
ceiling, content-type allowlist, size limit, path-traversal-safe
filenames, tier-based list/download exclusion, and the download audit
entry — against a live Postgres (no Neo4j needed).
"""

import io
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
        select(District).where(District.code == "IT-ATTACH")
    ).scalar_one_or_none()
    if district is None:
        district = District(
            name="IT Attachment District",
            code="IT-ATTACH",
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
    helpers.make_officer("it_attach_admin", Role.ADMINISTRATOR)
    return helpers.login(c, "it_attach_admin")


@pytest.fixture(scope="module")
def supervisor_headers(c):
    # SUPERVISOR: unrestricted jurisdiction (so it can see the admin's
    # case regardless of district), has case:write, and its ceiling
    # (PROTECTED) sits below SEALED -- exactly what the ceiling-rejection
    # test needs.
    helpers.make_officer("it_attach_supervisor", Role.SUPERVISOR)
    return helpers.login(c, "it_attach_supervisor")


def _create_case(c, headers, district_id: str) -> str:
    res = c.post(
        "/api/v1/cases",
        json={
            "case_number": f"IT-ATTACH-{uuid.uuid4().hex[:10].upper()}",
            "title": "Attachment test fixture",
            "district_id": district_id,
            "classification": "open_operational",
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _upload(c, headers, case_id: str, name: str, content: bytes, content_type: str, classification: str | None = None):
    data = {}
    if classification is not None:
        data["classification"] = classification
    return c.post(
        f"/api/v1/cases/{case_id}/attachments",
        files={"file": (name, io.BytesIO(content), content_type)},
        data=data,
        headers=headers,
    )


def test_upload_list_and_download_roundtrip(c, admin_headers, district_id):
    case_id = _create_case(c, admin_headers, district_id)
    body = b"hello attachment world"
    up = _upload(c, admin_headers, case_id, "notes.txt", body, "text/plain")
    assert up.status_code == 201, up.text
    payload = up.json()
    assert payload["filename"] == "notes.txt"
    assert payload["content_type"] == "text/plain"
    assert payload["size_bytes"] == len(body)
    attachment_id = payload["id"]

    listed = c.get(f"/api/v1/cases/{case_id}/attachments", headers=admin_headers)
    assert listed.status_code == 200
    assert any(a["id"] == attachment_id for a in listed.json())

    downloaded = c.get(
        f"/api/v1/cases/{case_id}/attachments/{attachment_id}/download", headers=admin_headers
    )
    assert downloaded.status_code == 200
    assert downloaded.content == body
    assert downloaded.headers["content-type"].startswith("text/plain")
    assert "notes.txt" in downloaded.headers.get("content-disposition", "")


def test_upload_rejects_case_not_found(c, admin_headers):
    res = _upload(c, admin_headers, str(uuid.uuid4()), "f.txt", b"x", "text/plain")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "case_not_found"


def test_upload_rejects_unsupported_content_type(c, admin_headers, district_id):
    case_id = _create_case(c, admin_headers, district_id)
    res = _upload(c, admin_headers, case_id, "script.exe", b"MZ", "application/x-msdownload")
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "unsupported_content_type"


def test_upload_rejects_oversized_file(c, admin_headers, district_id, monkeypatch):
    case_id = _create_case(c, admin_headers, district_id)
    import app.services.attachment_service as attachment_service

    monkeypatch.setattr(attachment_service.settings, "ATTACHMENT_MAX_SIZE_BYTES", 10)
    res = _upload(c, admin_headers, case_id, "big.txt", b"x" * 100, "text/plain")
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "attachment_too_large"


def test_upload_rejects_classification_above_clearance(c, admin_headers, supervisor_headers, district_id):
    case_id = _create_case(c, admin_headers, district_id)
    res = _upload(
        c, supervisor_headers, case_id, "toosensitive.txt", b"x", "text/plain",
        classification="sealed",
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "classification_exceeds_clearance"


def test_sealed_attachment_excluded_from_lower_tier_viewer(
    c, admin_headers, supervisor_headers, district_id
):
    """Record-level tier exclusion (not field redaction, see module
    docstring): a SEALED attachment must be invisible to a SUPERVISOR
    (ceiling PROTECTED) in both list and download."""
    case_id = _create_case(c, admin_headers, district_id)
    up = _upload(
        c, admin_headers, case_id, "sealed.txt", b"top secret", "text/plain",
        classification="sealed",
    )
    assert up.status_code == 201, up.text
    attachment_id = up.json()["id"]

    listed = c.get(f"/api/v1/cases/{case_id}/attachments", headers=supervisor_headers)
    assert listed.status_code == 200
    assert attachment_id not in {a["id"] for a in listed.json()}

    downloaded = c.get(
        f"/api/v1/cases/{case_id}/attachments/{attachment_id}/download",
        headers=supervisor_headers,
    )
    assert downloaded.status_code == 404


def test_download_rejects_wrong_case(c, admin_headers, district_id):
    case_id_a = _create_case(c, admin_headers, district_id)
    case_id_b = _create_case(c, admin_headers, district_id)
    up = _upload(c, admin_headers, case_id_a, "a.txt", b"a", "text/plain")
    attachment_id = up.json()["id"]

    res = c.get(
        f"/api/v1/cases/{case_id_b}/attachments/{attachment_id}/download", headers=admin_headers
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "attachment_not_found"


def test_download_writes_audit_entry(c, admin_headers, district_id):
    case_id = _create_case(c, admin_headers, district_id)
    up = _upload(c, admin_headers, case_id, "audited.txt", b"audit me", "text/plain")
    attachment_id = up.json()["id"]

    c.get(f"/api/v1/cases/{case_id}/attachments/{attachment_id}/download", headers=admin_headers)

    audit_res = c.get(
        "/api/v1/admin/audit",
        params={"action": "attachment_downloaded"},
        headers=admin_headers,
    )
    assert audit_res.status_code == 200
    entries = audit_res.json()["items"]
    assert any(e["resource_id"] == attachment_id for e in entries)


def test_filename_is_sanitized_to_a_basename(c, admin_headers, district_id):
    case_id = _create_case(c, admin_headers, district_id)
    up = _upload(c, admin_headers, case_id, "../../etc/passwd", b"not actually passwd", "text/plain")
    assert up.status_code == 201, up.text
    assert up.json()["filename"] == "passwd"
