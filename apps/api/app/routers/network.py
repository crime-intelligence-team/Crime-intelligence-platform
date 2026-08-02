from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.graph.driver import get_session
from app.models.entities import Officer
from app.schemas.common import PaginatedResponse
from app.schemas.network import EntityDetail, EntitySummary, RelationshipOut
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


@router.get("/entities/{entity_id}", response_model=EntityDetail)
def get_entity(
    entity_id: str,
    request: Request,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("entity:read")),
    db: Session = Depends(get_db),
):
    try:
        entity_uuid = UUID(entity_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Entity ID is not a valid UUID",
                }
            },
        )
    result = network_service.get_entity(
        db=db,
        entity_id=entity_uuid,
        officer=officer,
        ip_address=request.client.host if request.client else None,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "entity_not_found",
                    "message": "Entity not found or not accessible to this officer",
                }
            },
        )
    return result


@router.get("/entities/{entity_id}/relationships", response_model=PaginatedResponse[RelationshipOut])
def get_entity_relationships(
    entity_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("relationship:view")),
    db: Session = Depends(get_db),
    graph_session=Depends(get_session),
):
    try:
        entity_uuid = UUID(entity_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Entity ID is not a valid UUID",
                }
            },
        )
    try:
        result = network_service.get_entity_relationships(
            db=db,
            graph_session=graph_session,
            entity_id=entity_uuid,
            officer=officer,
            page=page,
            page_size=page_size,
        )
    except network_service.GraphUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "graph_unavailable",
                    "message": "Relationship graph is temporarily unavailable",
                }
            },
        )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "entity_not_found",
                    "message": "Entity not found or not accessible to this officer",
                }
            },
        )
    items, total = result
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/relationships/{relationship_id}", response_model=RelationshipOut)
def get_relationship(
    relationship_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("relationship:view")),
    db: Session = Depends(get_db),
    graph_session=Depends(get_session),
):
    """Edge detail with evidence — confidence + classification always present,
    from the Postgres mirror only (decision 000). relationship_id is an
    opaque string passed as a bound parameter to both stores."""
    try:
        result = network_service.get_relationship(
            db=db,
            graph_session=graph_session,
            relationship_id=relationship_id,
            officer=officer,
        )
    except network_service.GraphUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "graph_unavailable",
                    "message": "Relationship graph is temporarily unavailable",
                }
            },
        )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "relationship_not_found",
                    "message": "Relationship not found or not accessible to this officer",
                }
            },
        )
    return result
