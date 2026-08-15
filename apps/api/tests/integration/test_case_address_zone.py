"""Case<->zone linkage (999 §2.1 / 006 §3): Case.address_id never existed
and create_case never populated or depended on one. Proves address_id is
settable at creation, validated (422 address_not_found for a bad id), and
that zone_id on CaseDetail is a fresh spatial-containment lookup (not a
stored column) against a live Postgres/PostGIS (no Neo4j needed).
"""

import uuid

import pytest
from sqlalchemy import select

from tests import helpers
from app.core.database import SessionLocal
from app.models.base import ClassificationLevel
from app.models.entities import Address, District, Role, Zone

pytestmark = pytest.mark.skipif(
    not helpers.postgres_available(), reason="Postgres not reachable"
)

# A zone polygon and two addresses: one inside it, one well outside.
ZONE_WKT = "SRID=4326;POLYGON((10 10, 20 10, 20 20, 10 20, 10 10))"
POINT_INSIDE_WKT = "SRID=4326;POINT(15 15)"
POINT_OUTSIDE_WKT = "SRID=4326;POINT(50 50)"


def _get_or_create_district(db) -> District:
    district = db.execute(
        select(District).where(District.code == "IT-ADDRZONE")
    ).scalar_one_or_none()
    if district is None:
        district = District(
            name="IT Address-Zone District",
            code="IT-ADDRZONE",
            classification=ClassificationLevel.OPEN_OPERATIONAL,
        )
        db.add(district)
        db.flush()
        db.commit()
    return district


def _get_or_create_zone(db, district_id) -> Zone:
    zone = db.execute(
        select(Zone).where(Zone.name == "IT Address-Zone Zone")
    ).scalar_one_or_none()
    if zone is None:
        zone = Zone(
            district_id=district_id,
            name="IT Address-Zone Zone",
            geometry=ZONE_WKT,
            classification=ClassificationLevel.OPEN_OPERATIONAL,
        )
        db.add(zone)
        db.flush()
        db.commit()
    return zone


def _get_or_create_address(db, raw_text: str, point_wkt: str | None, district_id) -> Address:
    address = db.execute(
        select(Address).where(Address.raw_text == raw_text)
    ).scalar_one_or_none()
    if address is None:
        address = Address(
            raw_text=raw_text,
            geocoded_point=point_wkt,
            district_id=district_id,
            classification=ClassificationLevel.OPEN_OPERATIONAL,
        )
        db.add(address)
        db.flush()
        db.commit()
    return address


@pytest.fixture(scope="module")
def district_id():
    db = SessionLocal()
    try:
        return str(_get_or_create_district(db).id)
    finally:
        db.close()


@pytest.fixture(scope="module")
def zone_id(district_id):
    db = SessionLocal()
    try:
        return str(_get_or_create_zone(db, district_id).id)
    finally:
        db.close()


@pytest.fixture(scope="module")
def address_inside_id(district_id):
    db = SessionLocal()
    try:
        return str(
            _get_or_create_address(db, "IT-ADDRZONE inside point", POINT_INSIDE_WKT, district_id).id
        )
    finally:
        db.close()


@pytest.fixture(scope="module")
def address_outside_id(district_id):
    db = SessionLocal()
    try:
        return str(
            _get_or_create_address(db, "IT-ADDRZONE outside point", POINT_OUTSIDE_WKT, district_id).id
        )
    finally:
        db.close()


@pytest.fixture(scope="module")
def address_no_point_id(district_id):
    db = SessionLocal()
    try:
        return str(
            _get_or_create_address(db, "IT-ADDRZONE no geocode", None, district_id).id
        )
    finally:
        db.close()


@pytest.fixture(scope="module")
def admin_headers(c):
    helpers.make_officer("it_addrzone_admin", Role.ADMINISTRATOR)
    return helpers.login(c, "it_addrzone_admin")


def _create_case(c, headers, district_id: str, address_id: str | None = None) -> dict:
    payload = {
        "case_number": f"IT-ADDRZONE-{uuid.uuid4().hex[:10].upper()}",
        "title": "Case address/zone test fixture",
        "district_id": district_id,
        "classification": "open_operational",
    }
    if address_id is not None:
        payload["address_id"] = address_id
    res = c.post("/api/v1/cases", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_case_without_address_has_null_address_and_zone(c, admin_headers, district_id):
    case = _create_case(c, admin_headers, district_id)
    assert case["address_id"] is None
    assert case["zone_id"] is None


def test_case_with_address_inside_zone_resolves_zone(
    c, admin_headers, district_id, address_inside_id, zone_id
):
    case = _create_case(c, admin_headers, district_id, address_id=address_inside_id)
    assert case["address_id"] == address_inside_id
    assert case["zone_id"] == zone_id


def test_case_with_address_outside_zone_has_null_zone(
    c, admin_headers, district_id, address_outside_id
):
    case = _create_case(c, admin_headers, district_id, address_id=address_outside_id)
    assert case["address_id"] == address_outside_id
    assert case["zone_id"] is None


def test_case_with_ungeocoded_address_has_null_zone(
    c, admin_headers, district_id, address_no_point_id
):
    case = _create_case(c, admin_headers, district_id, address_id=address_no_point_id)
    assert case["address_id"] == address_no_point_id
    assert case["zone_id"] is None


def test_case_with_nonexistent_address_rejected(c, admin_headers, district_id):
    res = c.post(
        "/api/v1/cases",
        json={
            "case_number": f"IT-ADDRZONE-{uuid.uuid4().hex[:10].upper()}",
            "title": "Bad address ref",
            "district_id": district_id,
            "classification": "open_operational",
            "address_id": str(uuid.uuid4()),
        },
        headers=admin_headers,
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "address_not_found"


def test_zone_resolved_fresh_on_get(c, admin_headers, district_id, address_inside_id, zone_id):
    """zone_id isn't stored on the case row — GET after create resolves it
    the same way, proving the read path, not just the create response."""
    case = _create_case(c, admin_headers, district_id, address_id=address_inside_id)
    res = c.get(f"/api/v1/cases/{case['id']}", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["zone_id"] == zone_id
