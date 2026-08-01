from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.schemas.cases import RedactionPolicyCreate, RedactionPolicyResponse
from app.schemas.common import PaginatedResponse
from app.services import redaction_service

router = APIRouter(prefix="/api/v1/redactions", tags=["redactions"])


def _to_response(policy) -> RedactionPolicyResponse:
    return RedactionPolicyResponse(
        id=str(policy.id),
        entity_type=policy.entity_type,
        field=policy.field,
        min_classification=policy.min_classification,
        decision=policy.decision,
        reason=policy.reason,
        active=policy.active,
        created_by_id=str(policy.created_by_id),
        created_at=policy.created_at.isoformat() if policy.created_at else None,
    )


@router.post(
    "/policies",
    response_model=RedactionPolicyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_policy(
    payload: RedactionPolicyCreate,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("redaction:manage")),
    db: Session = Depends(get_db),
):
    """Admin-defined export redaction rule (brief 7.10; PRD open question
    "which fields require mandatory redaction in shared exports?" answered
    as per-deployment config). redaction:manage is ADMINISTRATOR-only."""
    try:
        return _to_response(
            redaction_service.create_policy(db=db, officer=officer, payload=payload)
        )
    except redaction_service.InvalidRedactionTargetError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "invalid_redaction_target",
                    "message": "Redaction target is not valid",
                    "details": {
                        "valid_targets": sorted(
                            {"note.body", "case.summary"}
                        )
                    },
                }
            },
        )


@router.get(
    "/policies",
    response_model=PaginatedResponse[RedactionPolicyResponse],
)
def list_policies(
    active: bool | None = Query(None),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("redaction:manage")),
    db: Session = Depends(get_db),
):
    """Policy visibility is ADMIN-only for v1 (decision 008 Q-D)."""
    items = redaction_service.list_policies(db=db, active_only=active)
    return PaginatedResponse(
        items=[_to_response(p) for p in items],
        total=len(items),
        page=1,
        page_size=max(len(items), 1),
    )


@router.post("/policies/{policy_id}/deactivate", response_model=RedactionPolicyResponse)
def deactivate_policy(
    policy_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("redaction:manage")),
    db: Session = Depends(get_db),
):
    """Soft deactivate, never delete — policy history stays auditable."""
    try:
        policy_uuid = UUID(policy_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Policy ID is not a valid UUID",
                }
            },
        )
    try:
        policy = redaction_service.deactivate_policy(
            db=db, officer=officer, policy_id=policy_uuid
        )
    except redaction_service.RedactionPolicyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "redaction_policy_not_found",
                    "message": "Redaction policy not found or already inactive",
                }
            },
        )
    return _to_response(policy)
