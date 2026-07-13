from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_officer
from app.models.entities import Officer
from app.schemas.dashboard import DashboardResponse, KpiStrip

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/{region_id}", response_model=DashboardResponse)
def get_dashboard(region_id: str, officer: Officer = Depends(get_current_officer)):
    """
    Phase 0 stub. Phase 3: real aggregation — critically, redaction filtering
    must run BEFORE aggregation so no hidden record is inferable from a count.
    """
    return DashboardResponse(
        region_id=region_id,
        kpis=KpiStrip(total_incidents=0, active_gangs=0, open_cases=0, high_priority_entities=0),
        trends=[],
        hotspots=[],
        priority_entities=[],
        alerts=[],
    )
