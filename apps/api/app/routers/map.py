from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.schemas.common import ClassificationLevel, Confidence, ConfidenceBand, PaginatedResponse
from app.schemas.map import DistrictDetail, DistrictQuickSummary, DistrictSummary, ZoneRiskOut, ZoneTopFactor

router = APIRouter(prefix="/api/v1", tags=["map"])


@router.get("/districts", response_model=PaginatedResponse[DistrictSummary])
def list_districts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("map:view")),
):
    """Phase 0 stub. Phase 2: real PostGIS query, geometry as GeoJSON, scoped by jurisdiction."""
    return PaginatedResponse(items=[], total=0, page=page, page_size=page_size)


@router.get("/districts/{district_id}", response_model=DistrictDetail)
def get_district(
    district_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("map:view")),
):
    return DistrictDetail(
        id=district_id,
        name="stub-district",
        code="STB",
        classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
        geometry={"type": "MultiPolygon", "coordinates": []},
        population=None,
    )


@router.get("/districts/{district_id}/summary", response_model=DistrictQuickSummary)
def get_district_summary(
    district_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("map:view")),
):
    return DistrictQuickSummary(
        district_id=district_id,
        open_cases=0,
        active_alerts=0,
        priority_entities=0,
        classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
    )


@router.get("/zones", response_model=PaginatedResponse[ZoneRiskOut])
def list_zones(
    district_id: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("map:view")),
):
    """Phase 2: real scoring engine output. Field naming avoids 'verdict' per brief 7.4."""
    return PaginatedResponse(items=[], total=0, page=page, page_size=page_size)


@router.get("/zones/{zone_id}", response_model=ZoneRiskOut)
def get_zone(
    zone_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("map:view")),
):
    return ZoneRiskOut(
        id=zone_id,
        district_id="stub-district-id",
        name="stub-zone",
        score=0,
        confidence=Confidence(score=0, band=ConfidenceBand.UNCONFIRMED),
        top_factors=[ZoneTopFactor(name="stub_factor", weight=0.0, description="placeholder")],
        run_timestamp="1970-01-01T00:00:00Z",
        recommended_interpretation="low",
        analyst_review_status=None,
        classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
    )
