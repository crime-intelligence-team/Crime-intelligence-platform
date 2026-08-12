from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions, require_step_up_auth
from app.models.entities import Case, Note, Officer
from app.schemas.cases import (
    AttachmentSummary,
    CaseCreate,
    CaseDetail,
    CaseStatusUpdate,
    CaseSummary,
    CaseTeamMemberOut,
    ExportRequest,
    ExportResponse,
    NoteCreate,
    NoteSummary,
    TeamMemberAdd,
)
from app.schemas.common import ClassificationLevel, PaginatedResponse
from app.services import attachment_service, case_service, redaction_service

router = APIRouter(prefix="/api/v1/cases", tags=["cases"])


@router.get("", response_model=PaginatedResponse[CaseSummary])
def list_cases(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:read")),
    db: Session = Depends(get_db),
):
    if status_filter is not None and status_filter not in Case.VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_status",
                    "message": "Case status is not valid",
                    "details": {"valid_statuses": sorted(Case.VALID_STATUSES)},
                }
            },
        )
    items, total = case_service.list_cases(
        db=db, officer=officer, page=page, page_size=page_size, status=status_filter
    )
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=CaseDetail, status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreate,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:write")),
    db: Session = Depends(get_db),
):
    try:
        return case_service.create_case(db=db, officer=officer, payload=payload)
    except case_service.InvalidCaseNumberError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_case_number",
                    "message": "Case number must be 3-32 characters of letters, digits, or hyphens",
                }
            },
        )
    except case_service.InvalidCaseStatusError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_status",
                    "message": "Case status is not valid",
                    "details": {"valid_statuses": sorted(Case.VALID_STATUSES)},
                }
            },
        )
    except case_service.CaseNumberTakenError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "case_number_taken",
                    "message": "A case with this case number already exists",
                }
            },
        )
    except case_service.DistrictNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "district_not_found",
                    "message": "District does not exist",
                }
            },
        )
    except case_service.DistrictNotInJurisdictionError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "district_not_in_jurisdiction",
                    "message": "District is outside this officer's jurisdiction",
                }
            },
        )
    except case_service.AddressNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "address_not_found",
                    "message": "address_id does not reference a real address",
                }
            },
        )
    except case_service.ClassificationExceedsClearanceError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "classification_exceeds_clearance",
                    "message": "Case classification exceeds this officer's clearance",
                }
            },
        )


@router.get("/{case_id}", response_model=CaseDetail)
def get_case(
    case_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:read")),
    db: Session = Depends(get_db),
):
    try:
        case_uuid = UUID(case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Case ID is not a valid UUID",
                }
            },
        )
    result = case_service.get_case(db=db, officer=officer, case_id=case_uuid)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "case_not_found",
                    "message": "Case not found or not accessible to this officer",
                }
            },
        )
    return result


@router.patch("/{case_id}/status", response_model=CaseDetail)
def update_case_status(
    case_id: str,
    payload: CaseStatusUpdate,
    request: Request,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:write")),
    db: Session = Depends(get_db),
):
    try:
        case_uuid = UUID(case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Case ID is not a valid UUID",
                }
            },
        )
    ip_address = request.client.host if request.client else None
    try:
        result = case_service.update_case_status(
            db=db,
            officer=officer,
            case_id=case_uuid,
            new_status=payload.status,
            ip_address=ip_address,
        )
    except case_service.InvalidCaseStatusError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_status",
                    "message": "Case status is not valid",
                    "details": {"valid_statuses": sorted(Case.VALID_STATUSES)},
                }
            },
        )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "case_not_found",
                    "message": "Case not found or not accessible to this officer",
                }
            },
        )
    return result


def _case_uuid_or_422(case_id: str) -> UUID:
    try:
        return UUID(case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Case ID is not a valid UUID",
                }
            },
        )


def _case_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "error": {
                "code": "case_not_found",
                "message": "Case not found or not accessible to this officer",
            }
        },
    )


@router.post("/{case_id}/pin", response_model=CaseSummary)
def pin_case(
    case_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:read")),
    db: Session = Depends(get_db),
):
    result = case_service.pin_case(db=db, officer=officer, case_id=_case_uuid_or_422(case_id))
    if result is None:
        raise _case_not_found()
    return result


@router.delete("/{case_id}/pin", response_model=CaseSummary)
def unpin_case(
    case_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:read")),
    db: Session = Depends(get_db),
):
    result = case_service.unpin_case(db=db, officer=officer, case_id=_case_uuid_or_422(case_id))
    if result is None:
        raise _case_not_found()
    return result


@router.get("/{case_id}/team", response_model=list[CaseTeamMemberOut])
def list_team_members(
    case_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:read")),
    db: Session = Depends(get_db),
):
    result = case_service.list_team_members(
        db=db, officer=officer, case_id=_case_uuid_or_422(case_id)
    )
    if result is None:
        raise _case_not_found()
    return result


@router.post(
    "/{case_id}/team", response_model=CaseTeamMemberOut, status_code=status.HTTP_201_CREATED
)
def add_team_member(
    case_id: str,
    payload: TeamMemberAdd,
    request: Request,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:write")),
    db: Session = Depends(get_db),
):
    ip_address = request.client.host if request.client else None
    try:
        result = case_service.add_team_member(
            db=db,
            officer=officer,
            case_id=_case_uuid_or_422(case_id),
            member_officer_id=payload.officer_id,
            ip_address=ip_address,
        )
    except case_service.OfficerNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "officer_not_found",
                    "message": "officer_id does not reference a real officer",
                }
            },
        )
    except case_service.AlreadyTeamMemberError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "already_team_member",
                    "message": "Officer is already on this case's team",
                }
            },
        )
    if result is None:
        raise _case_not_found()
    return result


@router.delete("/{case_id}/team/{member_officer_id}", response_model=CaseTeamMemberOut)
def remove_team_member(
    case_id: str,
    member_officer_id: str,
    request: Request,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:write")),
    db: Session = Depends(get_db),
):
    try:
        member_uuid = UUID(member_officer_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "officer ID is not a valid UUID",
                }
            },
        )
    ip_address = request.client.host if request.client else None
    try:
        result = case_service.remove_team_member(
            db=db,
            officer=officer,
            case_id=_case_uuid_or_422(case_id),
            member_officer_id=member_uuid,
            ip_address=ip_address,
        )
    except case_service.CannotRemoveLeadOfficerError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "cannot_remove_lead_officer",
                    "message": "The lead officer can't be removed from the team this way",
                }
            },
        )
    except case_service.TeamMemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "team_member_not_found",
                    "message": "Officer has no active team membership on this case",
                }
            },
        )
    if result is None:
        raise _case_not_found()
    return result


@router.get("/{case_id}/notes", response_model=PaginatedResponse[NoteSummary])
def list_notes(
    case_id: str,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("note:read")),
    db: Session = Depends(get_db),
):
    try:
        case_uuid = UUID(case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Case ID is not a valid UUID",
                }
            },
        )
    result = case_service.list_notes(
        db=db, officer=officer, case_id=case_uuid, page=page, page_size=page_size
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "case_not_found",
                    "message": "Case not found or not accessible to this officer",
                }
            },
        )
    items, total = result
    ip_address = request.client.host if request.client else None
    items = redaction_service.apply_note_list_redactions(
        db=db, officer=officer, case_id=case_id, notes=items, ip_address=ip_address
    )
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/{case_id}/notes", response_model=NoteSummary, status_code=status.HTTP_201_CREATED)
def add_note(
    case_id: str,
    payload: NoteCreate,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("note:create")),
    db: Session = Depends(get_db),
):
    """Visibility tiers per brief 7.7 — enforcement semantics in
    case_service._note_visible; minimum-viable interpretations flagged in
    docs/decisions/006."""
    try:
        case_uuid = UUID(case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Case ID is not a valid UUID",
                }
            },
        )
    try:
        result = case_service.create_note(
            db=db, officer=officer, case_id=case_uuid, payload=payload
        )
    except case_service.InvalidVisibilityError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_visibility",
                    "message": "Note visibility is not valid",
                    "details": {
                        "valid_visibilities": sorted(Note.VALID_VISIBILITIES)
                    },
                }
            },
        )
    except case_service.InvalidFindingStateError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_finding_state",
                    "message": "Note finding state is not valid",
                    "details": {"valid_states": sorted(Note.FINDING_STATES)},
                }
            },
        )
    except case_service.ClassificationExceedsClearanceError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "classification_exceeds_clearance",
                    "message": "Note classification exceeds this officer's clearance",
                }
            },
        )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "case_not_found",
                    "message": "Case not found or not accessible to this officer",
                }
            },
        )
    return result


@router.post(
    "/{case_id}/attachments", response_model=AttachmentSummary, status_code=status.HTTP_201_CREATED
)
async def add_attachment(
    case_id: str,
    file: UploadFile = File(...),
    classification: str = Form(ClassificationLevel.RESTRICTED_OPERATIONAL.value),
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:write")),
    db: Session = Depends(get_db),
):
    """006 §1 / 999 §2.12: replaces the prior stub (no auth-visibility
    gate, no storage). Local-disk storage — see attachment_service."""
    case_uuid = _case_uuid_or_422(case_id)
    content = await file.read()
    try:
        result = attachment_service.create_attachment(
            db=db,
            officer=officer,
            case_id=case_uuid,
            filename=file.filename or "unnamed",
            content_type=file.content_type or "application/octet-stream",
            content=content,
            classification=classification,
        )
    except attachment_service.InvalidClassificationError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_classification",
                    "message": "classification is not a valid tier",
                }
            },
        )
    except attachment_service.ClassificationExceedsClearanceError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "classification_exceeds_clearance",
                    "message": "Attachment classification exceeds this officer's clearance",
                }
            },
        )
    except attachment_service.UnsupportedContentTypeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "unsupported_content_type",
                    "message": "File type is not permitted",
                }
            },
        )
    except attachment_service.AttachmentTooLargeError:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": {
                    "code": "attachment_too_large",
                    "message": "File exceeds the maximum allowed size",
                }
            },
        )
    if result is None:
        raise _case_not_found()
    return result


@router.get("/{case_id}/attachments", response_model=list[AttachmentSummary])
def list_attachments(
    case_id: str,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:read")),
    db: Session = Depends(get_db),
):
    result = attachment_service.list_attachments(
        db=db, officer=officer, case_id=_case_uuid_or_422(case_id)
    )
    if result is None:
        raise _case_not_found()
    return result


@router.get("/{case_id}/attachments/{attachment_id}/download")
def download_attachment(
    case_id: str,
    attachment_id: str,
    request: Request,
    officer: Officer = Depends(get_current_officer),
    _pm: Officer = Depends(require_permissions("case:read")),
    db: Session = Depends(get_db),
):
    try:
        attachment_uuid = UUID(attachment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Attachment ID is not a valid UUID",
                }
            },
        )
    ip_address = request.client.host if request.client else None
    attachment = attachment_service.get_attachment_for_download(
        db=db,
        officer=officer,
        case_id=_case_uuid_or_422(case_id),
        attachment_id=attachment_uuid,
        ip_address=ip_address,
    )
    path = attachment_service.storage_file_path(attachment.id) if attachment else None
    if attachment is None or not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "attachment_not_found",
                    "message": "Attachment not found or not accessible to this officer",
                }
            },
        )
    return FileResponse(
        path=path, media_type=attachment.content_type, filename=attachment.filename
    )


@router.post("/{case_id}/export", response_model=ExportResponse)
def export_case(
    case_id: str,
    request: Request,
    payload: ExportRequest | None = None,
    officer: Officer = Depends(require_step_up_auth),
    _pm: Officer = Depends(require_permissions("export:case")),
    db: Session = Depends(get_db),
):
    """Every export: policy redaction applied, classification labeled,
    initiator/time recorded (brief 7.11). The document is the case plus
    the notes visible to the exporting officer, labeled with the highest
    tier of the included content; each export writes an AuditLogEntry
    (who/what/when) and is rejected only by the unchanged step-up + export
    permission gates.

    Phase 6 component 3 (decision 008 Q-A, freeze narrowly lifted for this
    handler ONLY): the request gains an OPTIONAL ExportRequest body
    (ad-hoc redact_note_ids) and the artifact passes through
    redaction_service.apply_redactions — which post-processes the result
    of the untouched case_service.export_case and returns it byte-identical
    when no rule fires and no ad-hoc ids are given."""
    try:
        case_uuid = UUID(case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Case ID is not a valid UUID",
                }
            },
        )
    ip_address = request.client.host if request.client else None
    result = case_service.export_case(
        db=db, officer=officer, case_id=case_uuid, ip_address=ip_address
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "case_not_found",
                    "message": "Case not found or not accessible to this officer",
                }
            },
        )
    return redaction_service.apply_redactions(
        db=db,
        officer=officer,
        export=result,
        redact_note_ids=payload.redact_note_ids if payload else None,
        ip_address=ip_address,
    )
