"""Dev seed data: districts, zones, addresses, officers, open case.

Run from inside the cip-api container:
    docker exec cip-api python -m scripts.seed_dev_data
"""

import sys
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.base import ClassificationLevel
from app.models.entities import (
    Address,
    Case,
    District,
    Officer,
    Role,
    Zone,
)

GEO_DISTRICT_CENTRAL = (
    "SRID=4326;MULTIPOLYGON(((77.2090 28.6139, 77.2490 28.6139, "
    "77.2490 28.6539, 77.2090 28.6539, 77.2090 28.6139)))"
)
GEO_DISTRICT_EAST = (
    "SRID=4326;MULTIPOLYGON(((77.2900 28.6100, 77.3400 28.6100, "
    "77.3400 28.6600, 77.2900 28.6600, 77.2900 28.6100)))"
)

ZONES = {
    "central": [
        ("Central-North", "SRID=4326;POLYGON((77.2090 28.6339, 77.2490 28.6339, 77.2490 28.6539, 77.2090 28.6539, 77.2090 28.6339))"),
        ("Central-South", "SRID=4326;POLYGON((77.2090 28.6139, 77.2490 28.6139, 77.2490 28.6339, 77.2090 28.6339, 77.2090 28.6139))"),
    ],
    "east": [
        ("East-Industrial", "SRID=4326;POLYGON((77.2900 28.6350, 77.3400 28.6350, 77.3400 28.6600, 77.2900 28.6600, 77.2900 28.6350))"),
        ("East-Residential", "SRID=4326;POLYGON((77.2900 28.6100, 77.3400 28.6100, 77.3400 28.6350, 77.2900 28.6350, 77.2900 28.6100))"),
    ],
}

ADDRESS_POINTS_CENTRAL_NORTH = [
    "77.2100 28.6340", "77.2150 28.6350", "77.2200 28.6360", "77.2250 28.6370",
    "77.2300 28.6380", "77.2350 28.6390", "77.2400 28.6400", "77.2450 28.6410",
]
ADDRESS_POINTS_CENTRAL_SOUTH = [
    "77.2110 28.6140", "77.2160 28.6150", "77.2210 28.6160", "77.2260 28.6170",
]
ADDRESS_POINTS_EAST_INDUSTRIAL = [
    "77.2950 28.6360", "77.3000 28.6370", "77.3050 28.6380", "77.3100 28.6390",
    "77.3150 28.6400", "77.3200 28.6410",
]
ADDRESS_POINTS_EAST_RESIDENTIAL = [
    "77.2960 28.6110", "77.3010 28.6120",
]

SEED_OFFICERS = [
    {
        "official_id": "ADM-0001",
        "username": "admin",
        "password": "Password1!",
        "full_name": "Ava Administrator",
        "role": Role.ADMINISTRATOR,
        "unit": "Command",
        "home_district_code": None,
    },
    {
        "official_id": "ANL-0001",
        "username": "analyst",
        "password": "Password1!",
        "full_name": "Noah Analyst",
        "role": Role.ANALYST,
        "unit": "Analysis",
        "home_district_code": None,
    },
    {
        "official_id": "DTO-0001",
        "username": "officer",
        "password": "Password1!",
        "full_name": "Ravi Officer",
        "role": Role.DISTRICT_OFFICER,
        "unit": "Central District",
        "home_district_code": "CEN",
    },
]


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.execute(select(District)).first()
        if existing is not None:
            print("Seed data already present; aborting (drop tables to reseed).")
            return

        central = District(
            name="Central District",
            code="CEN",
            geometry=GEO_DISTRICT_CENTRAL,
            population=850000,
            classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
        )
        east = District(
            name="East District",
            code="EAST",
            geometry=GEO_DISTRICT_EAST,
            population=620000,
            classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
        )
        db.add_all([central, east])
        db.flush()

        zones_by_name: dict[str, Zone] = {}
        for district, zone_specs in ((central, ZONES["central"]), (east, ZONES["east"])):
            for zone_name, wkt in zone_specs:
                zone = Zone(
                    district_id=district.id,
                    name=zone_name,
                    geometry=wkt,
                    classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                )
                db.add(zone)
                zones_by_name[zone_name] = zone
        db.flush()

        def add_addresses(points, zone_name):
            for point in points:
                lon, lat = point.split(" ")
                db.add(
                    Address(
                        raw_text=f"Address near {zone_name} at {lon},{lat}",
                        geocoded_point=f"SRID=4326;POINT({lon} {lat})",
                        district_id=zones_by_name[zone_name].district_id,
                        classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                        source_name="dev-seed",
                        source_timestamp=datetime.now(timezone.utc),
                        mapping_schema_version="dev-1",
                    )
                )

        add_addresses(ADDRESS_POINTS_CENTRAL_NORTH, "Central-North")
        add_addresses(ADDRESS_POINTS_CENTRAL_SOUTH, "Central-South")
        add_addresses(ADDRESS_POINTS_EAST_INDUSTRIAL, "East-Industrial")
        add_addresses(ADDRESS_POINTS_EAST_RESIDENTIAL, "East-Residential")

        central_north_id = zones_by_name["Central-North"].id
        officers = []
        for spec in SEED_OFFICERS:
            home_district_id = None
            if spec["home_district_code"]:
                home_district_id = db.execute(
                    select(District).where(District.code == spec["home_district_code"])
                ).scalar_one().id
            officers.append(
                Officer(
                    official_id=spec["official_id"],
                    username=spec["username"],
                    hashed_password=hash_password(spec["password"]),
                    full_name=spec["full_name"],
                    role=spec["role"],
                    unit=spec["unit"],
                    home_district_id=home_district_id,
                    mfa_enabled=0,
                    is_active=1,
                )
            )
        db.add_all(officers)
        db.flush()

        db.add(
            Case(
                case_number="CASE-2026-0001",
                title="Smuggling ring investigation",
                summary="Dev seed case to exercise district summary endpoint.",
                status="open",
                district_id=central.id,
                lead_officer_id=officers[0].id,
                classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                source_name="dev-seed",
                source_timestamp=datetime.now(timezone.utc),
                mapping_schema_version="dev-1",
            )
        )
        db.commit()

        print("Seeded:")
        print(f"  districts: {central.name}, {east.name}")
        print(f"  zones: {', '.join(zones_by_name.keys())}")
        print(f"  officers: {', '.join(o.official_id for o in officers)} (password: Password1!)")
        print(f"  addresses: 20")
        print(f"  cases: CASE-2026-0001 (open, central-north id ref exists)")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
