from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.schemas.common import PaginatedResponse
from app.schemas.dashboard import Alert, PriorityEntity
from app.services import alert_service

router = APIRouter(prefix="/api/v1", tags=["alerts"])


@router.get("/alerts", response_model=PaginatedResponse[Alert])
def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("alert:read")),
    db: Session = Depends(get_db),
):
    """Intelligence-feed alerts (Phase 6 component 2): tier + jurisdiction
    gated, newest first. Served here rather than through the dashboard
    (dashboard_service.py is untouched); the dashboard stub remains
    unchanged (decision 007)."""
    items, total = alert_service.list_alerts(
        db=db, officer=officer, page=page, page_size=page_size
    )
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/priority-entities", response_model=PaginatedResponse[PriorityEntity])
def list_priority_entities(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("alert:read")),
    db: Session = Depends(get_db),
):
    """Computed-on-read priority entities (Phase 6 component 2): protected
    persons, case-linked entities, and entities at/above the degree
    threshold, ranked protected > case-linked > degree. Fail-closed 503
    when the graph is unreachable (a degraded list would silently omit
    the linked-entity signals)."""
    try:
        items, total = alert_service.priority_entities(
            db=db, officer=officer, page=page, page_size=page_size
        )
    except alert_service.GraphUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "graph_unavailable",
                    "message": "Graph unavailable; priority entities cannot be computed",
                    "details": None,
                }
            },
        )
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)
