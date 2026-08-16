"""Dev seed data: districts, zones, addresses, officers, open case.

Run from inside the cip-api container:
    docker exec cip-api python -m scripts.seed_dev_data
"""

import math
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
from app.services.risk_service import persist_zone_score

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

# Additional cities so the India map isn't just one corner of Delhi.
# Each entry gets one district, split into a north/south zone pair, with
# ADDRESSES_PER_ZONE addresses scattered across each zone's half.
ADDRESSES_PER_ZONE = 6

OTHER_CITIES = [
    {
        "district_name": "Mumbai District",
        "code": "MUM",
        "population": 12_400_000,
        "bbox": (72.8400, 19.0400, 72.9100, 19.1100),
        "zone_names": ("Mumbai-Bandra", "Mumbai-Dadar"),
    },
    {
        "district_name": "Bangalore District",
        "code": "BLR",
        "population": 8_400_000,
        "bbox": (77.5600, 12.9350, 77.6300, 13.0050),
        "zone_names": ("Bangalore-Whitefield", "Bangalore-Koramangala"),
    },
    {
        "district_name": "Chennai District",
        "code": "CHN",
        "population": 7_100_000,
        "bbox": (80.2350, 13.0450, 80.3050, 13.1150),
        "zone_names": ("Chennai-AnnaNagar", "Chennai-TNagar"),
    },
    {
        "district_name": "Kolkata District",
        "code": "KOL",
        "population": 4_500_000,
        "bbox": (88.3300, 22.5350, 88.4000, 22.6050),
        "zone_names": ("Kolkata-SaltLake", "Kolkata-ParkStreet"),
    },
    {
        "district_name": "Hyderabad District",
        "code": "HYD",
        "population": 6_800_000,
        "bbox": (78.4500, 17.3500, 78.5200, 17.4200),
        "zone_names": ("Hyderabad-Secunderabad", "Hyderabad-BanjaraHills"),
    },
]


def _multipolygon_wkt(bbox: tuple[float, float, float, float]) -> str:
    min_lon, min_lat, max_lon, max_lat = bbox
    return (
        f"SRID=4326;MULTIPOLYGON((({min_lon} {min_lat}, {max_lon} {min_lat}, "
        f"{max_lon} {max_lat}, {min_lon} {max_lat}, {min_lon} {min_lat})))"
    )


def _polygon_wkt(bbox: tuple[float, float, float, float]) -> str:
    min_lon, min_lat, max_lon, max_lat = bbox
    return (
        f"SRID=4326;POLYGON(({min_lon} {min_lat}, {max_lon} {min_lat}, "
        f"{max_lon} {max_lat}, {min_lon} {max_lat}, {min_lon} {min_lat}))"
    )


def _split_bbox_north_south(
    bbox: tuple[float, float, float, float],
) -> tuple[tuple[float, float, float, float], tuple[float, float, float, float]]:
    min_lon, min_lat, max_lon, max_lat = bbox
    mid_lat = (min_lat + max_lat) / 2
    north = (min_lon, mid_lat, max_lon, max_lat)
    south = (min_lon, min_lat, max_lon, mid_lat)
    return north, south


def _scatter_points(bbox: tuple[float, float, float, float], count: int) -> list[tuple[float, float]]:
    """count points spread across bbox in a simple grid, so ST_Contains-based
    zone scoring sees a realistic (non-collinear) address distribution."""
    min_lon, min_lat, max_lon, max_lat = bbox
    cols = math.ceil(math.sqrt(count))
    rows = math.ceil(count / cols)
    points = []
    for i in range(count):
        row, col = divmod(i, cols)
        lon = min_lon + (col + 0.5) / cols * (max_lon - min_lon)
        lat = min_lat + (row + 0.5) / rows * (max_lat - min_lat)
        points.append((round(lon, 4), round(lat, 4)))
    return points


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

        other_districts: list[District] = []
        for city in OTHER_CITIES:
            district = District(
                name=city["district_name"],
                code=city["code"],
                geometry=_multipolygon_wkt(city["bbox"]),
                population=city["population"],
                classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
            )
            db.add(district)
            db.flush()
            other_districts.append(district)

            north_bbox, south_bbox = _split_bbox_north_south(city["bbox"])
            north_name, south_name = city["zone_names"]
            for zone_name, zone_bbox in ((north_name, north_bbox), (south_name, south_bbox)):
                zone = Zone(
                    district_id=district.id,
                    name=zone_name,
                    geometry=_polygon_wkt(zone_bbox),
                    classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                )
                db.add(zone)
                db.flush()
                zones_by_name[zone_name] = zone
                for lon, lat in _scatter_points(zone_bbox, ADDRESSES_PER_ZONE):
                    db.add(
                        Address(
                            raw_text=f"Address near {zone_name} at {lon},{lat}",
                            geocoded_point=f"SRID=4326;POINT({lon} {lat})",
                            district_id=district.id,
                            classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                            source_name="dev-seed",
                            source_timestamp=datetime.now(timezone.utc),
                            mapping_schema_version="dev-1",
                        )
                    )
        db.flush()

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

        # Run scoring for every zone now, not just Central/East, so the map
        # isn't barren until someone manually clicks "Run Zone Scoring" per
        # district (list_zone_scores omits zones with no persisted score).
        for zone in zones_by_name.values():
            persist_zone_score(db, zone)

        all_district_names = [central.name, east.name] + [d.name for d in other_districts]
        total_addresses = 20 + len(OTHER_CITIES) * 2 * ADDRESSES_PER_ZONE

        print("Seeded:")
        print(f"  districts: {', '.join(all_district_names)}")
        print(f"  zones: {', '.join(zones_by_name.keys())}")
        print(f"  officers: {', '.join(o.official_id for o in officers)} (password: Password1!)")
        print(f"  addresses: {total_addresses}")
        print(f"  zone risk scores: {len(zones_by_name)} (all zones pre-scored)")
        print(f"  cases: CASE-2026-0001 (open, central-north id ref exists)")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
