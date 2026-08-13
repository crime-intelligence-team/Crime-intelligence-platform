from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.models.governance import RetentionPolicy
from app.schemas.common import PaginatedResponse
from app.schemas.retention import RetentionCandidate, RetentionPolicyCreate, RetentionPolicyResponse
from app.services import retention_service

router = APIRouter(prefix="/api/v1/retention-policies", tags=["retention"])


@router.post("", response_model=RetentionPolicyResponse, status_code=status.HTTP_201_CREATED)
def create_retention_policy(
    payload: RetentionPolicyCreate,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("system:configure")),
    db: Session = Depends(get_db),
):
    """Define a retention-eligibility window for an entity type
    (Administrator only — system:configure). Flag-only: see
    RetentionPolicy's model docstring — this never deletes or archives
    anything, it only surfaces a candidate list for human review."""
    try:
        return retention_service.create_retention_policy(db=db, officer=officer, payload=payload)
    except retention_service.InvalidEntityTypeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_entity_type",
                    "message": "entity_type is not valid",
                    "details": {"valid_entity_types": sorted(RetentionPolicy.RETENTION_ENTITY_TYPES)},
                }
            },
        )


@router.get("", response_model=PaginatedResponse[RetentionPolicyResponse])
def list_retention_policies(
    active: bool | None = Query(None),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("system:configure")),
    db: Session = Depends(get_db),
):
    items = retention_service.list_retention_policies(db=db, active_only=active)
    return PaginatedResponse(items=items, total=len(items), page=1, page_size=max(len(items), 1))


@router.post("/{policy_id}/deactivate", response_model=RetentionPolicyResponse)
def deactivate_retention_policy(
    policy_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("system:configure")),
    db: Session = Depends(get_db),
):
    """Soft deactivate, never delete — same idiom as redactions/data sources."""
    try:
        policy_uuid = UUID(policy_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "invalid_uuid", "message": "Policy ID is not a valid UUID"}},
        )
    try:
        return retention_service.deactivate_retention_policy(db=db, officer=officer, policy_id=policy_uuid)
    except retention_service.RetentionPolicyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "retention_policy_not_found",
                    "message": "Retention policy not found or already inactive",
                }
            },
        )


@router.get("/{policy_id}/candidates", response_model=PaginatedResponse[RetentionCandidate])
def list_candidates(
    policy_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("system:configure")),
    db: Session = Depends(get_db),
):
    """Records currently past this policy's retention window — flag-only,
    for a human to review; this endpoint never deletes or archives them."""
    try:
        policy_uuid = UUID(policy_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "invalid_uuid", "message": "Policy ID is not a valid UUID"}},
        )
    try:
        items = retention_service.list_candidates(db=db, policy_id=policy_uuid)
    except retention_service.RetentionPolicyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "retention_policy_not_found", "message": "Retention policy not found"}},
        )
    return PaginatedResponse(items=items, total=len(items), page=1, page_size=max(len(items), 1))
