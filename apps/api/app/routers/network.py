from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/api/v1", tags=["network"])


@router.get("/entities/search", response_model=PaginatedResponse[dict])
def search_entities(
    q: str = Query(...),
    type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("entity:read")),
):
    """Phase 4 stub — real impl fans out to Neo4j + Postgres, permission-filtered."""
    return PaginatedResponse(items=[], total=0, page=page, page_size=page_size)


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
