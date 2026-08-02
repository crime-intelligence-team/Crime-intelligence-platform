from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.schemas.common import ClassificationLevel, Confidence, ConfidenceBand, PaginatedResponse
from app.schemas.map import DistrictDetail, DistrictQuickSummary, DistrictSummary, ZoneRiskOut, ZoneTopFactor
from app.services import district_service, risk_service

router = APIRouter(prefix="/api/v1", tags=["map"])


@router.get("/districts", response_model=PaginatedResponse[DistrictSummary])
def list_districts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("map:view")),
    db: Session = Depends(get_db),
):
    items = district_service.list_districts(db=db, officer=officer)
    return PaginatedResponse(items=items, total=len(items), page=page, page_size=page_size)


@router.get("/districts/{district_id}", response_model=DistrictDetail)
def get_district(
    district_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("map:view")),
    db: Session = Depends(get_db),
):
    try:
        district_uuid = UUID(district_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "District ID is not a valid UUID",
                    "details": None,
                }
            },
        )
    district = district_service.get_district(db=db, district_id=district_uuid, officer=officer)
    if district is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "district_not_found",
                    "message": "District not found",
                    "details": None,
                }
            },
        )
    return district


@router.get("/districts/{district_id}/summary", response_model=DistrictQuickSummary)
def get_district_summary(
    district_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("map:view")),
    db: Session = Depends(get_db),
):
    try:
        district_uuid = UUID(district_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "District ID is not a valid UUID",
                    "details": None,
                }
            },
        )
    summary = district_service.get_district_summary(db=db, district_id=district_uuid, officer=officer)
    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "district_not_found",
                    "message": "District not found",
                    "details": None,
                }
            },
        )
    return summary


@router.get("/zones", response_model=PaginatedResponse[ZoneRiskOut])
def list_zones(
    district_id: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("map:view")),
    db: Session = Depends(get_db),
):
    try:
        district_uuid = UUID(district_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "District ID is not a valid UUID",
                    "details": None,
                }
            },
        )
    items = risk_service.list_zone_scores(db=db, district_id=district_uuid, officer=officer)
    return PaginatedResponse(items=items, total=len(items), page=page, page_size=page_size)


@router.get("/zones/{zone_id}", response_model=ZoneRiskOut)
def get_zone(
    zone_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("map:view")),
    db: Session = Depends(get_db),
):
    try:
        zone_uuid = UUID(zone_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Zone ID is not a valid UUID",
                    "details": None,
                }
            },
        )
    try:
        result = risk_service.get_zone_score(db=db, zone_id=zone_uuid, officer=officer)
    except risk_service.ZoneNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "zone_not_found",
                    "message": "Zone not found",
                    "details": None,
                }
            },
        )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "zone_not_scored",
                    "message": "Zone has no risk score yet; trigger a scoring run first",
                    "details": None,
                }
            },
        )
    return result


@router.post("/zones/{district_id}/run-scoring", response_model=PaginatedResponse[ZoneRiskOut])
def run_zone_scoring(
    district_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("risk:compute")),
    db: Session = Depends(get_db),
):
    """Synchronous scoring run for every zone in the district. Writes one ZoneRiskScore row per zone."""
    try:
        district_uuid = UUID(district_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "District ID is not a valid UUID",
                    "details": None,
                }
            },
        )
    items = risk_service.run_zone_scoring(db=db, district_id=district_uuid, officer=officer)
    return PaginatedResponse(items=items, total=len(items), page=1, page_size=len(items) or 1)
