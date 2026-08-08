from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.schemas.officers import OfficerManagerUpdate, OfficerSummary
from app.services import officer_service

router = APIRouter(prefix="/api/v1/officers", tags=["officers"])


@router.get("", response_model=list[OfficerSummary])
def list_officers(
    _pm: Officer = Depends(require_permissions("officer:view")),
    db: Session = Depends(get_db),
):
    """Full roster, unscoped by district/classification (006 §4 / 999 §2.3
    follow-up): the officer directory itself carries no per-record
    visibility tiers anywhere in the codebase."""
    return officer_service.list_officers(db)


@router.patch("/{officer_id}/manager", response_model=OfficerSummary)
def set_officer_manager(
    officer_id: str,
    payload: OfficerManagerUpdate,
    request: Request,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("officer:manage")),
    db: Session = Depends(get_db),
):
    try:
        officer_uuid = UUID(officer_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Officer ID is not a valid UUID",
                }
            },
        )
    ip_address = request.client.host if request.client else None
    try:
        return officer_service.set_manager(
            db=db,
            officer=officer,
            officer_id=officer_uuid,
            manager_id=payload.manager_id,
            ip_address=ip_address,
        )
    except officer_service.OfficerNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "officer_not_found",
                    "message": "Officer not found",
                }
            },
        )
    except officer_service.ManagerNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "manager_not_found",
                    "message": "manager_id does not reference a real officer",
                }
            },
        )
    except officer_service.CannotBeOwnManagerError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "cannot_be_own_manager",
                    "message": "An officer cannot be their own manager",
                }
            },
        )
    except officer_service.ManagerCycleError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "manager_cycle",
                    "message": "The proposed manager is already a subordinate of this officer",
                }
            },
        )
