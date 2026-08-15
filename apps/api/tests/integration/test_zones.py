"""GET /zones and /zones/{id} geometry (found while investigating why
GeoIntelligence.tsx's "Zone Mode" never rendered a real zone shape):
ZoneRiskOut never serialized Zone.geometry at all, so the frontend had
nothing to draw beyond recoloring the district-level dot. Proves the
geometry now comes back as GeoJSON for a real seeded zone with a polygon,
via a live Postgres (no Neo4j needed).
"""

import pytest
from sqlalchemy import select

from tests import helpers
from app.core.database import SessionLocal
from app.models.entities import District, Role

pytestmark = pytest.mark.skipif(
    not helpers.postgres_available(), reason="Postgres not reachable"
)


@pytest.fixture(scope="module")
def cen_district_id():
    db = SessionLocal()
    try:
        district = db.execute(select(District).where(District.code == "CEN")).scalar_one_or_none()
        if district is None:
            pytest.skip("seed data (CEN district) not present")
        return str(district.id)
    finally:
        db.close()


@pytest.fixture(scope="module")
def admin_headers(c):
    helpers.make_officer("it_zonegeo_admin", Role.ADMINISTRATOR)
    return helpers.login(c, "it_zonegeo_admin")


def test_run_scoring_returns_zone_geometry(c, admin_headers, cen_district_id):
    res = c.post(f"/api/v1/zones/{cen_district_id}/run-scoring", headers=admin_headers)
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert len(items) > 0
    for zone in items:
        assert zone["geometry"] is not None
        assert zone["geometry"]["type"] == "Polygon"
        assert len(zone["geometry"]["coordinates"]) > 0


def test_list_zones_returns_geometry(c, admin_headers, cen_district_id):
    c.post(f"/api/v1/zones/{cen_district_id}/run-scoring", headers=admin_headers)
    res = c.get("/api/v1/zones", params={"district_id": cen_district_id}, headers=admin_headers)
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert len(items) > 0
    assert all(z["geometry"] is not None for z in items)


def test_get_zone_returns_geometry(c, admin_headers, cen_district_id):
    scored = c.post(f"/api/v1/zones/{cen_district_id}/run-scoring", headers=admin_headers)
    zone_id = scored.json()["items"][0]["id"]
    res = c.get(f"/api/v1/zones/{zone_id}", headers=admin_headers)
    assert res.status_code == 200, res.text
    assert res.json()["geometry"] is not None
