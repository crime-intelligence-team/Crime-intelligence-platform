import json
from datetime import datetime, timezone
from uuid import UUID

from geoalchemy2 import functions as geo_func
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.base import band_for_score
from app.models.entities import Address, Case, Officer, Zone, ZoneRiskScore
from app.schemas.common import ClassificationLevel, Confidence, ConfidenceBand
from app.schemas.map import ZoneRiskOut, ZoneTopFactor
from app.services.district_service import get_accessible_district_ids
from app.utils.geometry import geometry_to_geojson

MIN_ADDRESS_FLOOR = 5
REFERENCE_DENSITY_PER_KM2 = 1000.0

# Active (non-closed) cases are the strongest available risk signal — a zone
# with real casework outweighs one that's merely address-dense. 3+ active
# cases saturates the case component; below that it scales linearly.
CASE_REFERENCE_COUNT = 3
CASE_WEIGHT = 0.7
ADDRESS_WEIGHT = 0.3


class ZoneNotFoundError(Exception):
    """Raised when a zone does not exist, or the officer has no access to it."""


def _interpretation_for_score(score: int) -> str:
    if score < 40:
        return "low"
    if score < 70:
        return "elevated"
    return "priority_watch"


def _score_to_output(zone: Zone, score: int, band: ConfidenceBand, top_factors: list[ZoneTopFactor]) -> ZoneRiskOut:
    interpretation = _interpretation_for_score(score)
    return ZoneRiskOut(
        id=str(zone.id),
        district_id=str(zone.district_id),
        name=zone.name,
        score=score,
        confidence=Confidence(score=score, band=band),
        top_factors=top_factors,
        run_timestamp=datetime.now(timezone.utc).isoformat(),
        recommended_interpretation=interpretation,
        analyst_review_status=None,
        classification=ClassificationLevel(zone.classification.value),
        geometry=geometry_to_geojson(zone.geometry),
    )


def _active_case_count(db: Session, zone_geom) -> int:
    """Active (status != closed) cases whose linked address falls inside the
    zone — same ST_Contains containment case_service._resolve_zone_id uses
    to derive a case's zone, just counted in aggregate here."""
    return (
        db.query(func.count(Case.id))
        .join(Address, Case.address_id == Address.id)
        .filter(Case.status != Case.STATUS_CLOSED)
        .filter(geo_func.ST_Contains(zone_geom, Address.geocoded_point))
        .scalar()
    ) or 0


def compute_zone_score(db: Session, zone: Zone) -> ZoneRiskOut:
    """Pure computation — no DB writes. Returns the provisional score for a zone."""
    if zone.geometry is None:
        return _score_to_output(
            zone,
            score=0,
            band=ConfidenceBand.UNCONFIRMED,
            top_factors=[
                ZoneTopFactor(
                    name="address_density",
                    weight=1.0,
                    description="Zone geometry missing; score cannot be computed.",
                )
            ],
        )

    zone_geom = zone.geometry
    address_count = (
        db.query(func.count(Address.id))
        .filter(geo_func.ST_Contains(zone_geom, Address.geocoded_point))
        .scalar()
    )
    area_m2 = db.query(func.ST_Area(geo_func.ST_Transform(zone_geom, 3857))).scalar()
    area_km2 = (area_m2 or 0.0) / 1_000_000.0

    density = (address_count or 0) / area_km2 if area_km2 > 0 else 0.0
    address_component = min(100, round(density / REFERENCE_DENSITY_PER_KM2 * 100))

    active_case_count = _active_case_count(db, zone_geom)
    case_component = min(100, round(active_case_count / CASE_REFERENCE_COUNT * 100))

    score = min(100, round(ADDRESS_WEIGHT * address_component + CASE_WEIGHT * case_component))

    if (address_count or 0) < MIN_ADDRESS_FLOOR:
        band = ConfidenceBand.UNCONFIRMED
    else:
        band = ConfidenceBand(band_for_score(score).value)
        # Address density alone is a weak proxy — cap at probable unless
        # there's at least one real active case backing the score up.
        if band == ConfidenceBand.VERIFIED and active_case_count == 0:
            band = ConfidenceBand.PROBABLE

    top_factors = [
        ZoneTopFactor(
            name="active_case_count",
            weight=CASE_WEIGHT,
            description=(
                f"{active_case_count} active (non-closed) case(s) geolocated in this zone — "
                "the primary risk signal."
            ),
        ),
        ZoneTopFactor(
            name="address_density",
            weight=ADDRESS_WEIGHT,
            description=(
                f"Address density secondary signal: {address_count} addresses in "
                f"{area_km2:.2f} km²."
            ),
        ),
    ]
    return _score_to_output(zone, score=score, band=band, top_factors=top_factors)


def persist_zone_score(db: Session, zone: Zone) -> ZoneRiskOut:
    """Computes and persists one scoring run. Only called from an explicit trigger."""
    output = compute_zone_score(db, zone)
    db.add(
        ZoneRiskScore(
            zone_id=zone.id,
            score=output.score,
            confidence_band=output.confidence.band.value,
            top_factors=json.dumps([f.model_dump() for f in output.top_factors]),
            run_timestamp=datetime.now(timezone.utc),
            recommended_interpretation=output.recommended_interpretation,
            analyst_review_status=None,
        )
    )
    db.commit()
    return output


def run_zone_scoring(db: Session, district_id: UUID, officer: Officer) -> list[ZoneRiskOut]:
    """Synchronous scoring run for all zones in a district. Deliberate: no background queue this phase."""
    accessible = get_accessible_district_ids(officer)
    if accessible is not None and district_id not in accessible:
        return []
    zones = db.query(Zone).filter(Zone.district_id == district_id).all()
    return [persist_zone_score(db, zone) for zone in zones]


def get_zone_score(db: Session, zone_id: UUID, officer: Officer) -> ZoneRiskOut | None:
    """Latest persisted run for a zone. None means the zone exists but has no score yet."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if zone is None:
        raise ZoneNotFoundError(zone_id)
    accessible = get_accessible_district_ids(officer)
    if accessible is not None and zone.district_id not in accessible:
        raise ZoneNotFoundError(zone_id)
    row = (
        db.query(ZoneRiskScore)
        .filter(ZoneRiskScore.zone_id == zone_id)
        .order_by(ZoneRiskScore.run_timestamp.desc())
        .first()
    )
    if row is None:
        return None
    return _row_to_output(zone, row)


def list_zone_scores(db: Session, district_id: UUID, officer: Officer) -> list[ZoneRiskOut]:
    """Latest persisted run per zone in a district. Unscored zones are omitted.

    Intentional: district-does-not-exist, out-of-jurisdiction, and zero-zones all
    return an empty list rather than distinct errors, so the API does not leak
    whether a district ID is valid to an officer without access to it.
    """
    accessible = get_accessible_district_ids(officer)
    if accessible is not None and district_id not in accessible:
        return []
    rows = (
        db.query(ZoneRiskScore, Zone)
        .join(Zone, ZoneRiskScore.zone_id == Zone.id)
        .filter(Zone.district_id == district_id)
        .order_by(ZoneRiskScore.zone_id, ZoneRiskScore.run_timestamp.desc())
        .distinct(ZoneRiskScore.zone_id)
        .all()
    )
    return [_row_to_output(zone, row) for row, zone in rows]


def list_zone_score_history(
    db: Session,
    zone_id: UUID,
    officer: Officer,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[ZoneRiskOut]:
    """Every persisted scoring run for a zone, newest first, optionally bounded
    to a run_timestamp range. The score itself has no time dimension (pure
    address density — see compute_zone_score) so this browses historical
    snapshots rather than filtering the scoring model."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if zone is None:
        raise ZoneNotFoundError(zone_id)
    accessible = get_accessible_district_ids(officer)
    if accessible is not None and zone.district_id not in accessible:
        raise ZoneNotFoundError(zone_id)
    query = db.query(ZoneRiskScore).filter(ZoneRiskScore.zone_id == zone_id)
    if date_from:
        query = query.filter(ZoneRiskScore.run_timestamp >= date_from)
    if date_to:
        query = query.filter(ZoneRiskScore.run_timestamp <= date_to)
    rows = query.order_by(ZoneRiskScore.run_timestamp.desc()).all()
    return [_row_to_output(zone, row) for row in rows]


def _row_to_output(zone: Zone, row: ZoneRiskScore) -> ZoneRiskOut:
    top_factors = [
        ZoneTopFactor(**factor)
        for factor in json.loads(row.top_factors or "[]")
    ]
    return ZoneRiskOut(
        id=str(zone.id),
        district_id=str(zone.district_id),
        name=zone.name,
        score=row.score,
        confidence=Confidence(score=row.score, band=ConfidenceBand(row.confidence_band)),
        top_factors=top_factors,
        run_timestamp=row.run_timestamp.isoformat(),
        recommended_interpretation=row.recommended_interpretation,
        analyst_review_status=row.analyst_review_status,
        classification=ClassificationLevel(zone.classification.value),
        score_id=str(row.id),
        geometry=geometry_to_geojson(zone.geometry),
    )
