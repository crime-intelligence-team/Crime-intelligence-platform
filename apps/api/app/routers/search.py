"""Global search aggregator (Phase 5 hardening). One endpoint, three
permission-gated sections. The endpoint requires search:basic; a section
is included only when the caller also holds its underlying permission
(case:read for cases, entity:read for entities, map:view for districts) —
an analyst searching does not get case hits, a district officer searching
does not get out-of-district district hits, etc.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.core.permissions import get_officer_permissions
from app.models.entities import Officer
from app.schemas.search import SearchResponse, SearchSection
from app.services import search_service

router = APIRouter(prefix="/api/v1/search", tags=["search"])

VALID_TYPES = ("cases", "entities", "districts")

# Section -> permission the caller must hold for that section to run.
SECTION_PERMISSIONS = {
    "cases": "case:read",
    "entities": "entity:read",
    "districts": "map:view",
}


@router.get("", response_model=SearchResponse)
def global_search(
    q: str = Query(..., min_length=1, max_length=100),
    types: str | None = Query(None, description="Comma-separated subset of cases,entities,districts"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("search:basic")),
    db: Session = Depends(get_db),
):
    if not q.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_search_query",
                    "message": "Search query must not be empty",
                }
            },
        )

    requested = set(types.split(",")) if types else set(VALID_TYPES)
    invalid = requested - set(VALID_TYPES)
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_search_type",
                    "message": "Search type is not valid",
                    "details": {"valid_types": sorted(VALID_TYPES), "invalid": sorted(invalid)},
                }
            },
        )

    permissions = set(get_officer_permissions(officer))
    response = SearchResponse(query=q)

    if "cases" in requested and "case:read" in permissions:
        items, total = search_service.search_cases(db, officer, q, page, page_size)
        response.cases = SearchSection(items=items, total=total)
    if "entities" in requested and "entity:read" in permissions:
        items, total = search_service.search_entities(db, officer, q, page, page_size)
        response.entities = SearchSection(items=items, total=total)
    if "districts" in requested and "map:view" in permissions:
        items, total = search_service.search_districts(db, officer, q, page, page_size)
        response.districts = SearchSection(items=items, total=total)

    return response
