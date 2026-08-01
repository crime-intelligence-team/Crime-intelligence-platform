from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.schemas.common import PaginatedResponse
from app.schemas.network import EntitySummary
from app.services import network_service

router = APIRouter(prefix="/api/v1", tags=["network"])


@router.get("/entities/search", response_model=PaginatedResponse[EntitySummary])
def search_entities(
    q: str = Query(...),
    type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("entity:read")),
    db: Session = Depends(get_db),
):
    if type is not None and type not in network_service.VALID_ENTITY_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_entity_type",
                    "message": "Entity type is not valid",
                    "details": {"valid_types": sorted(network_service.VALID_ENTITY_TYPES)},
                }
            },
        )
    items, total = network_service.search_entities(
        db=db, officer=officer, q=q, entity_type=type, page=page, page_size=page_size
    )
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/entities/{entity_id}")
def get_entity(
    entity_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("entity:read")),
):
    return {"id": entity_id, "classification": "restricted_operational", "_stub": True}


@router.get("/entities/{entity_id}/relationships", response_model=PaginatedResponse[dict])
def get_entity_relationships(
    entity_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("relationship:view")),
):
    return PaginatedResponse(items=[], total=0, page=page, page_size=page_size)


@router.get("/relationships/{relationship_id}")
def get_relationship(
    relationship_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("relationship:view")),
):
    """Edge detail with evidence — confidence + classification always present."""
    return {"id": relationship_id, "classification": "restricted_operational", "_stub": True}
