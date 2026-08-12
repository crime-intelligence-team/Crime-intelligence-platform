from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.schemas.dashboard import DashboardResponse
from app.services import dashboard_service

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/{region_id}", response_model=DashboardResponse)
def get_dashboard(
    region_id: str,
    hotspot_window: str = Query("30d"),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("dashboard:view")),
    db: Session = Depends(get_db),
):
    try:
        region_uuid = UUID(region_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Region ID is not a valid UUID",
                    "details": None,
                }
            },
        )
    if hotspot_window not in dashboard_service.TREND_WINDOWS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_window",
                    "message": "hotspot_window is not a valid window",
                    "details": {"valid_windows": sorted(dashboard_service.TREND_WINDOWS)},
                }
            },
        )
    result = dashboard_service.get_dashboard(
        db=db, region_id=region_uuid, officer=officer, hotspot_window=hotspot_window
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "region_not_found",
                    "message": "Region not found or not accessible to this officer",
                    "details": None,
                }
            },
        )
    return result
