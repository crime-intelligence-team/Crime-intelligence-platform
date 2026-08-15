from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.models.governance import DataSource
from app.schemas.common import PaginatedResponse
from app.schemas.data_sources import DataSourceCreate, DataSourceResponse
from app.services import data_source_service

router = APIRouter(prefix="/api/v1/data-sources", tags=["data-sources"])


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
def create_data_source(
    payload: DataSourceCreate,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("system:configure")),
    db: Session = Depends(get_db),
):
    """Register a provenance data source (Administrator only —
    system:configure). See DataSource's model docstring for why this
    registry exists and what it does/doesn't reconcile against."""
    try:
        return data_source_service.create_data_source(db=db, officer=officer, payload=payload)
    except data_source_service.InvalidSourceTypeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_source_type",
                    "message": "source_type is not valid",
                    "details": {"valid_source_types": sorted(DataSource.SOURCE_TYPES)},
                }
            },
        )
    except data_source_service.InvalidCadenceError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_cadence",
                    "message": "cadence is not valid",
                    "details": {"valid_cadences": sorted(DataSource.CADENCES)},
                }
            },
        )
    except data_source_service.DataSourceNameTakenError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "data_source_name_taken",
                    "message": "A data source with this name is already registered",
                }
            },
        )


@router.get("", response_model=PaginatedResponse[DataSourceResponse])
def list_data_sources(
    active: bool | None = Query(None),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("system:configure")),
    db: Session = Depends(get_db),
):
    items = data_source_service.list_data_sources(db=db, active_only=active)
    return PaginatedResponse(items=items, total=len(items), page=1, page_size=max(len(items), 1))


@router.post("/{source_id}/deactivate", response_model=DataSourceResponse)
def deactivate_data_source(
    source_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("system:configure")),
    db: Session = Depends(get_db),
):
    """Soft deactivate, never delete — registry history stays auditable,
    same idiom as redactions' policy deactivation."""
    try:
        source_uuid = UUID(source_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Data source ID is not a valid UUID",
                }
            },
        )
    try:
        return data_source_service.deactivate_data_source(
            db=db, officer=officer, source_id=source_uuid
        )
    except data_source_service.DataSourceNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "data_source_not_found",
                    "message": "Data source not found or already inactive",
                }
            },
        )
