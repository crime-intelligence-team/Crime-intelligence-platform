from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_officer, require_step_up_auth
from app.models.entities import Officer
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/api/v1/cases", tags=["cases"])


@router.get("", response_model=PaginatedResponse[dict])
def list_cases(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
):
    return PaginatedResponse(items=[], total=0, page=page, page_size=page_size)


@router.post("")
def create_case(officer: Officer = Depends(get_current_officer)):
    return {"id": "stub-case-id", "_stub": True}


@router.get("/{case_id}")
def get_case(case_id: str, officer: Officer = Depends(get_current_officer)):
    return {"id": case_id, "classification": "restricted_operational", "_stub": True}


@router.post("/{case_id}/notes")
def add_note(case_id: str, officer: Officer = Depends(get_current_officer)):
    """Visibility tiers per brief 7.7: private / case_team / supervisory_chain / inter_unit_approved."""
    return {"id": "stub-note-id", "case_id": case_id, "_stub": True}


@router.post("/{case_id}/attachments")
def add_attachment(case_id: str, officer: Officer = Depends(get_current_officer)):
    return {"id": "stub-attachment-id", "case_id": case_id, "_stub": True}


@router.post("/{case_id}/export")
def export_case(case_id: str, officer: Officer = Depends(require_step_up_auth)):
    """Every export: policy redaction applied, classification labeled, initiator/time recorded (brief 7.11)."""
    return {"export_id": "stub-export-id", "case_id": case_id, "_stub": True}
