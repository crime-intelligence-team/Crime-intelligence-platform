from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.models.governance import EntityResolutionEvent
from app.schemas.entity_resolution import MergeRequest, MergeResponse
from app.services import entity_resolution_service

router = APIRouter(prefix="/api/v1/entity-resolution", tags=["entity-resolution"])


def _to_response(event: EntityResolutionEvent) -> MergeResponse:
    return MergeResponse(
        id=str(event.id),
        primary_entity_id=str(event.primary_entity_id),
        absorbed_entity_id=str(event.absorbed_entity_id),
        entity_type=event.entity_type,
        status="merged" if event.reversed_at is None else "reversed",
    )


@router.post(
    "/merge",
    response_model=MergeResponse,
    status_code=status.HTTP_201_CREATED,
)
def merge_entities(
    payload: MergeRequest,
    officer: Officer = Depends(require_permissions("entity:merge")),
    db: Session = Depends(get_db),
):
    """Merge a duplicate person into a surviving one (brief 7.8, reduced
    scope — persons only; docs/decisions/011). ADMINISTRATOR-only; graph
    re-pointing deferred."""
    try:
        return _to_response(
            entity_resolution_service.merge_entities(db=db, officer=officer, payload=payload)
        )
    except entity_resolution_service.InvalidEntityTypeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_entity_type",
                    "message": "Entity type not supported for merge",
                    "details": {"valid_types": ["person"]},
                }
            },
        )
    except entity_resolution_service.SameEntityError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "same_entity",
                    "message": "Primary and absorbed entity must differ",
                }
            },
        )
    except entity_resolution_service.EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "entity_not_found",
                    "message": "One of the entities does not exist",
                }
            },
        )
    except entity_resolution_service.ProtectedSubjectMergeBlockedError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "protected_subject_merge_blocked",
                    "message": "Protected subjects cannot be merged (as primary or absorbed)",
                }
            },
        )
    except entity_resolution_service.PrimaryAlreadyAbsorbedError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "primary_already_absorbed",
                    "message": "The proposed primary entity is itself an absorbed entity",
                }
            },
        )
    except entity_resolution_service.AlreadyMergedError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "already_merged",
                    "message": "The absorbed entity is already merged",
                }
            },
        )


@router.post("/merge/{event_id}/reverse", response_model=MergeResponse)
def reverse_merge(
    event_id: str,
    officer: Officer = Depends(require_permissions("entity:merge")),
    db: Session = Depends(get_db),
):
    """Reverse a merge: absorbed regains independent visibility. Merged
    field copies stay (011). ADMINISTRATOR-only."""
    try:
        return _to_response(
            entity_resolution_service.reverse_merge(db=db, officer=officer, event_id=UUID(event_id))
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Event ID is not a valid UUID",
                }
            },
        )
    except entity_resolution_service.ResolutionEventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "entity_resolution_event_not_found",
                    "message": "Resolution event does not exist",
                }
            },
        )
    except entity_resolution_service.AlreadyReversedError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "already_reversed",
                    "message": "This merge is already reversed",
                }
            },
        )
