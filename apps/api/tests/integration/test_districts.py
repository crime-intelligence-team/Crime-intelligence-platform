"""GET /districts regression: DistrictSummary.geometry was typed as a
required dict, but District.geometry is a nullable column (a district can
exist before its boundary polygon is drawn) and geometry_to_geojson
already returns None for that case. Any geometry-less district 500'd the
ENTIRE list for every officer — found via live browser testing, not by
any feature's own test suite, since no prior test exercised this
endpoint at all. Proves a geometry-less district no longer breaks the
list and its own geometry comes back null.
"""

import pytest
from sqlalchemy import select

from tests import helpers
from app.core.database import SessionLocal
from app.models.base import ClassificationLevel
from app.models.entities import District, Role

pytestmark = pytest.mark.skipif(
    not helpers.postgres_available(), reason="Postgres not reachable"
)


@pytest.fixture(scope="module")
def geometryless_district_id():
    db = SessionLocal()
    try:
        district = db.execute(
            select(District).where(District.code == "IT-NOGEOM")
        ).scalar_one_or_none()
        if district is None:
            district = District(
                name="IT No-Geometry District",
                code="IT-NOGEOM",
                classification=ClassificationLevel.OPEN_OPERATIONAL,
            )
            db.add(district)
            db.flush()
            db.commit()
        return str(district.id)
    finally:
        db.close()


@pytest.fixture(scope="module")
def logged_in_admin(c):
    helpers.make_officer("it_nogeom_admin", Role.ADMINISTRATOR)
    return helpers.login(c, "it_nogeom_admin")


def test_district_list_survives_a_geometryless_district(
    c, logged_in_admin, geometryless_district_id
):
    res = c.get("/api/v1/districts", headers=logged_in_admin)
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    match = next(d for d in items if d["id"] == geometryless_district_id)
    assert match["geometry"] is None


def test_district_detail_survives_no_geometry(c, logged_in_admin, geometryless_district_id):
    res = c.get(f"/api/v1/districts/{geometryless_district_id}", headers=logged_in_admin)
    assert res.status_code == 200, res.text
    assert res.json()["geometry"] is None
