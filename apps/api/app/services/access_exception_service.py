"""Cross-district access exception workflow (brief 7.2; docs/decisions/009).

Case-scoped grants: an approved, unexpired exception lets the requesting
officer see ONE case (by case_reference = case number) that their
jurisdiction would otherwise hide. Tier gating is NEVER affected — the
exception widens jurisdiction only; classification_filter still gates the
case. This is decision 002's reserved "second filter layer," enforced via
case_service's _visible_case_stmt funnel (sanctioned narrow lift).

Expiry is checked INLINE at read/enforcement time — no background job.
An approved exception past expires_at grants nothing; the status column
stays "approved" (expired is derived, visible via `effective` on the
response and documented in 009).

Audit (all additive): exception_requested, exception_approved,
exception_denied, exception_revoked — reviewer identity recorded on the
row and in the audit entry.
"""

import json
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import Case, Officer, Role
from app.models.governance import AccessExceptionRequest
from app.schemas.access_exceptions import AccessExceptionRequestCreate
from app.services import audit_service

PENDING = "pending"
APPROVED = "approved"
DENIED = "denied"
REVOKED = "revoked"


class CaseReferenceNotFoundError(Exception):
    """case_reference does not match any case number (404 at the router)."""


class InvalidDurationError(Exception):
    """requested_duration_hours is not a whole number of hours (422)."""


class DuplicateActiveRequestError(Exception):
    """Requester already has a pending or approved-unexpired request for
    this case (409; inferred rule — 009 flags it)."""


class AccessExceptionNotFoundError(Exception):
    """Request id does not exist (404 at the router)."""


class InvalidTransitionError(Exception):
    """Request is not in the state that admits the action (422)."""


class CannotReviewOwnRequestError(Exception):
    """Reviewers may not approve/deny/revoke their own request (422;
    inferred rule — 009 flags it)."""


def _write_audit_log(
    db: Session,
    actor: Officer,
    action: str,
    resource_id: str,
    detail: str | None,
) -> None:
    audit_service.write_audit_log(
        db,
        actor=actor,
        action=action,
        module=audit_service.MODULE_GOVERNANCE,
        resource_type="access_exception",
        resource_id=resource_id,
        detail=detail,
    )


def _parse_duration(raw: str) -> int:
    if not raw.strip().isdigit():
        raise InvalidDurationError(raw)
    hours = int(raw.strip())
    if not 1 <= hours <= 8760:
        raise InvalidDurationError(raw)
    return hours


def request_exception(
    db: Session,
    officer: Officer,
    payload: AccessExceptionRequestCreate,
) -> AccessExceptionRequest:
    case_number = payload.case_reference.strip().upper()
    case = db.execute(
        select(Case.id).where(Case.case_number == case_number)
    ).scalar_one_or_none()
    if case is None:
        raise CaseReferenceNotFoundError(case_number)

    _parse_duration(payload.requested_duration_hours)

    now = datetime.now(timezone.utc)
    existing = db.execute(
        select(AccessExceptionRequest.id).where(
            AccessExceptionRequest.requested_by_id == officer.id,
            AccessExceptionRequest.case_reference == case_number,
            AccessExceptionRequest.status == PENDING,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise DuplicateActiveRequestError(case_number)
    existing_active = db.execute(
        select(AccessExceptionRequest.id).where(
            AccessExceptionRequest.requested_by_id == officer.id,
            AccessExceptionRequest.case_reference == case_number,
            AccessExceptionRequest.status == APPROVED,
            AccessExceptionRequest.expires_at > now,
        )
    ).scalar_one_or_none()
    if existing_active is not None:
        raise DuplicateActiveRequestError(case_number)

    req = AccessExceptionRequest(
        requested_by_id=officer.id,
        case_reference=case_number,
        operational_reason=payload.operational_reason.strip(),
        requested_duration_hours=payload.requested_duration_hours.strip(),
        status=PENDING,
    )
    db.add(req)
    db.flush()
    _write_audit_log(
        db=db,
        actor=officer,
        action="exception_requested",
        resource_id=str(req.id),
        detail=json.dumps(
            {
                "case_reference": case_number,
                "requested_duration_hours": payload.requested_duration_hours.strip(),
                "operational_reason": payload.operational_reason.strip(),
            }
        ),
    )
    db.commit()
    db.refresh(req)
    return req


def list_requests(db: Session, officer: Officer) -> list[AccessExceptionRequest]:
    stmt = select(AccessExceptionRequest).order_by(
        AccessExceptionRequest.created_at.desc()
    )
    if officer.role not in (Role.SUPERVISOR, Role.ADMINISTRATOR):
        stmt = stmt.where(AccessExceptionRequest.requested_by_id == officer.id)
    return list(db.execute(stmt).scalars().all())


def _transition(
    db: Session,
    officer: Officer,
    request_id: UUID,
    target: str,
) -> AccessExceptionRequest:
    # Phase 7 component 2: lock the row so concurrent transitions of the
    # same request serialize — the second caller sees the committed status
    # and fails with InvalidTransitionError instead of double-approving.
    req = db.get(AccessExceptionRequest, request_id, with_for_update=True)
    if req is None:
        raise AccessExceptionNotFoundError(str(request_id))
    if req.requested_by_id == officer.id:
        raise CannotReviewOwnRequestError(str(request_id))

    allowed = {
        APPROVED: {PENDING},
        DENIED: {PENDING},
        REVOKED: {APPROVED},
    }
    if req.status not in allowed[target]:
        raise InvalidTransitionError(f"{req.status}->{target}")

    req.status = target
    req.reviewed_by_id = officer.id
    req.reviewed_at = datetime.now(timezone.utc)
    if target == APPROVED:
        hours = _parse_duration(req.requested_duration_hours)
        req.expires_at = datetime.now(timezone.utc) + timedelta(hours=hours)
    db.flush()
    _write_audit_log(
        db=db,
        actor=officer,
        action=f"exception_{target}",
        resource_id=str(req.id),
        detail=json.dumps({"case_reference": req.case_reference}),
    )
    db.commit()
    db.refresh(req)
    return req


def approve_exception(db: Session, officer: Officer, request_id: UUID) -> AccessExceptionRequest:
    return _transition(db, officer, request_id, APPROVED)


def deny_exception(db: Session, officer: Officer, request_id: UUID) -> AccessExceptionRequest:
    return _transition(db, officer, request_id, DENIED)


def revoke_exception(db: Session, officer: Officer, request_id: UUID) -> AccessExceptionRequest:
    return _transition(db, officer, request_id, REVOKED)


def exempt_case_ids(db: Session, officer: Officer) -> set[UUID]:
    """Case ids the officer may additionally see through approved, unexpired
    exceptions. Unrestricted roles are never jurisdiction-filtered, so the
    exemption is moot for them and returns empty (cheap). Enforcement lives
    in case_service._visible_case_stmt via the sanctioned narrow lift."""
    if officer.role in (Role.ANALYST, Role.SUPERVISOR, Role.ADMINISTRATOR):
        return set()
    now = datetime.now(timezone.utc)
    rows = db.execute(
        select(Case.id)
        .join(
            AccessExceptionRequest,
            AccessExceptionRequest.case_reference == Case.case_number,
        )
        .where(
            AccessExceptionRequest.requested_by_id == officer.id,
            AccessExceptionRequest.status == APPROVED,
            AccessExceptionRequest.expires_at > now,
        )
    ).scalars().all()
    return set(rows)
