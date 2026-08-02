from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions, require_step_up_auth
from app.models.entities import Officer
from app.models.governance import AccessExceptionRequest
from app.schemas.access_exceptions import (
    AccessExceptionRequestCreate,
    AccessExceptionRequestResponse,
)
from app.services import access_exception_service

router = APIRouter(prefix="/api/v1/access-exceptions", tags=["access-exceptions"])


def _to_response(req: AccessExceptionRequest) -> AccessExceptionRequestResponse:
    now = datetime.now(timezone.utc)
    effective = (
        req.status == access_exception_service.APPROVED
        and req.expires_at is not None
        and req.expires_at > now
    )
    return AccessExceptionRequestResponse(
        id=str(req.id),
        case_reference=req.case_reference,
        operational_reason=req.operational_reason,
        requested_duration_hours=req.requested_duration_hours,
        status=req.status,
        requested_by_id=str(req.requested_by_id),
        reviewed_by_id=str(req.reviewed_by_id) if req.reviewed_by_id else None,
        reviewed_at=req.reviewed_at.isoformat() if req.reviewed_at else None,
        expires_at=req.expires_at.isoformat() if req.expires_at else None,
        effective=effective,
        created_at=req.created_at.isoformat() if req.created_at else None,
    )


@router.post(
    "/requests",
    response_model=AccessExceptionRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def request_exception(
    payload: AccessExceptionRequestCreate,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:read")),
    db: Session = Depends(get_db),
):
    """Request cross-district access to ONE case (brief 7.2). Gated on
    case:read (the minimum a meaningful request implies); the case must
    EXIST by number (404), but visibility is deliberately NOT required —
    requesting access to an out-of-jurisdiction case is the point."""
    try:
        return _to_response(
            access_exception_service.request_exception(
                db=db, officer=officer, payload=payload
            )
        )
    except access_exception_service.CaseReferenceNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "case_not_found",
                    "message": "Case reference does not match any existing case number",
                }
            },
        )
    except access_exception_service.InvalidDurationError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_duration",
                    "message": "requested_duration_hours must be a whole number of hours between 1 and 8760",
                }
            },
        )
    except access_exception_service.DuplicateActiveRequestError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "duplicate_exception_request",
                    "message": "An active exception request already exists for this case",
                }
            },
        )


@router.get("/requests", response_model=list[AccessExceptionRequestResponse])
def list_exceptions(
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:read")),
    db: Session = Depends(get_db),
):
    """Officers see their own requests; exception:approve holders
    (SUPERVISOR/ADMINISTRATOR) see all."""
    return [
        _to_response(r)
        for r in access_exception_service.list_requests(db=db, officer=officer)
    ]


def _transition_endpoint(target: str):
    step_up = target == "approve"
    past_participle = {"approve": "approved", "deny": "denied", "revoke": "revoked"}[target]

    def endpoint(
        request_id: str,
        officer: Officer = Depends(
            require_step_up_auth if step_up else get_current_officer
        ),
        _pm: Officer = Depends(require_permissions("exception:approve")),
        db: Session = Depends(get_db),
    ):
        try:
            request_uuid = UUID(request_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": {
                        "code": "invalid_uuid",
                        "message": "Request ID is not a valid UUID",
                    }
                },
            )
        try:
            req = getattr(access_exception_service, f"{target}_exception")(
                db=db, officer=officer, request_id=request_uuid
            )
        except access_exception_service.AccessExceptionNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "access_exception_not_found",
                        "message": "Access exception request not found",
                    }
                },
            )
        except access_exception_service.CannotReviewOwnRequestError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": {
                        "code": "cannot_review_own_request",
                        "message": "A reviewer cannot act on their own exception request",
                    }
                },
            )
        except access_exception_service.InvalidTransitionError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": {
                        "code": "invalid_transition",
                        "message": f"Request is not in a state that can be {past_participle}",
                    }
                },
            )
        return _to_response(req)

    endpoint.__name__ = f"{target}_exception"
    return endpoint


router.post(
    "/requests/{request_id}/approve",
    response_model=AccessExceptionRequestResponse,
)(_transition_endpoint("approve"))

router.post(
    "/requests/{request_id}/deny",
    response_model=AccessExceptionRequestResponse,
)(_transition_endpoint("deny"))

router.post(
    "/requests/{request_id}/revoke",
    response_model=AccessExceptionRequestResponse,
)(_transition_endpoint("revoke"))
