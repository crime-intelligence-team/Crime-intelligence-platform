from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_officer, require_roles, require_step_up_auth
from app.models.entities import Officer, Role
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# --- Access exceptions (brief 7.2) ---------------------------------------

@router.get("/access-exceptions", response_model=PaginatedResponse[dict])
def list_access_exceptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(require_roles(Role.SUPERVISOR, Role.ADMINISTRATOR)),
):
    return PaginatedResponse(items=[], total=0, page=page, page_size=page_size)


@router.post("/access-exceptions")
def request_access_exception(officer: Officer = Depends(get_current_officer)):
    """Any authenticated officer can request; only supervisors/admins approve."""
    return {"id": "stub-exception-id", "status": "pending", "_stub": True}


@router.post("/access-exceptions/{exception_id}/decision")
def decide_access_exception(
    exception_id: str,
    officer: Officer = Depends(require_step_up_auth),
):
    """Approve/deny — requires step-up auth per brief 7.1."""
    return {"id": exception_id, "status": "stub-decision", "_stub": True}


# --- Entity resolution (brief 7.8) ---------------------------------------

@router.get("/entity-resolution/candidates", response_model=PaginatedResponse[dict])
def list_merge_candidates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(require_roles(Role.ANALYST, Role.SUPERVISOR, Role.ADMINISTRATOR)),
):
    return PaginatedResponse(items=[], total=0, page=page, page_size=page_size)


@router.post("/entity-resolution/{candidate_id}/merge")
def merge_entities(
    candidate_id: str,
    officer: Officer = Depends(require_roles(Role.ANALYST, Role.SUPERVISOR, Role.ADMINISTRATOR)),
):
    """Merge history must remain reversible/auditable, never a silent overwrite (brief 7.8)."""
    return {"id": candidate_id, "status": "merged", "_stub": True}


# --- Confidence review / feedback loop (brief 7.9) ------------------------

@router.post("/confidence-review")
def submit_confidence_review(officer: Officer = Depends(get_current_officer)):
    return {"id": "stub-review-id", "status": "pending", "_stub": True}


@router.post("/confidence-review/{review_id}/decision")
def decide_confidence_review(
    review_id: str,
    officer: Officer = Depends(require_roles(Role.SUPERVISOR, Role.ADMINISTRATOR)),
):
    return {"id": review_id, "status": "stub-decision", "_stub": True}


# --- Redaction policy engine (brief 7.10) ---------------------------------

@router.get("/redaction-decisions", response_model=PaginatedResponse[dict])
def list_redaction_decisions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(require_roles(Role.ADMINISTRATOR)),
):
    return PaginatedResponse(items=[], total=0, page=page, page_size=page_size)
