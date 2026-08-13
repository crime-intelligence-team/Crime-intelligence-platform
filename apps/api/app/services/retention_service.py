"""Retention-eligibility service (governance gap: no purge/archive
mechanism existed for case/entity/note data). FLAG-ONLY — see
RetentionPolicy's model docstring for the full design rationale. This
service only ever reads candidate records; it never deletes, archives, or
writes any state onto a data record. Counts/lists are computed inline at
request time, the same idiom access_exception_service uses for expiry.
"""

import json
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    Address,
    Case,
    Device,
    Note,
    Officer,
    Organization,
    Person,
    Vehicle,
)
from app.models.governance import RetentionPolicy
from app.schemas.retention import RetentionCandidate, RetentionPolicyCreate, RetentionPolicyResponse
from app.services import audit_service

_ENTITY_MODELS = {
    "case": Case,
    "note": Note,
    "person": Person,
    "organization": Organization,
    "vehicle": Vehicle,
    "device": Device,
    "address": Address,
}


class InvalidEntityTypeError(Exception):
    """entity_type outside RetentionPolicy.RETENTION_ENTITY_TYPES (422 at the router)."""


class RetentionPolicyNotFoundError(Exception):
    """id does not exist or is already inactive (404 at the router)."""


def _cutoff(retention_days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=retention_days)


def _eligibility_stmt(entity_type: str, retention_days: int):
    model = _ENTITY_MODELS[entity_type]
    stmt = select(model).where(model.created_at < _cutoff(retention_days))
    if entity_type == "case":
        stmt = stmt.where(Case.status == Case.STATUS_CLOSED)
    return stmt


def _label(entity_type: str, row) -> str:
    if entity_type == "case":
        return f"{row.case_number} — {row.title}"
    if entity_type == "note":
        return row.body[:60] + ("…" if len(row.body) > 60 else "")
    if entity_type == "person":
        return row.full_name
    if entity_type == "organization":
        return row.name
    if entity_type == "vehicle":
        return row.registration_number or f"{row.make or ''} {row.model or ''}".strip() or str(row.id)
    if entity_type == "device":
        return row.phone_number or row.imei or str(row.id)
    return row.raw_text  # address


def _candidate_count(db: Session, entity_type: str, retention_days: int) -> int:
    model = _ENTITY_MODELS[entity_type]
    stmt = select(func.count()).select_from(model).where(model.created_at < _cutoff(retention_days))
    if entity_type == "case":
        stmt = stmt.where(Case.status == Case.STATUS_CLOSED)
    return db.execute(stmt).scalar() or 0


def _to_response(db: Session, policy: RetentionPolicy) -> RetentionPolicyResponse:
    return RetentionPolicyResponse(
        id=str(policy.id),
        entity_type=policy.entity_type,
        retention_days=policy.retention_days,
        reason=policy.reason,
        active=policy.active,
        candidate_count=_candidate_count(db, policy.entity_type, policy.retention_days),
        created_by_id=str(policy.created_by_id),
        created_at=policy.created_at.isoformat() if policy.created_at else None,
    )


def create_retention_policy(
    db: Session, officer: Officer, payload: RetentionPolicyCreate
) -> RetentionPolicyResponse:
    if payload.entity_type not in RetentionPolicy.RETENTION_ENTITY_TYPES:
        raise InvalidEntityTypeError(payload.entity_type)
    policy = RetentionPolicy(
        entity_type=payload.entity_type,
        retention_days=payload.retention_days,
        reason=payload.reason,
        active=True,
        created_by_id=officer.id,
    )
    db.add(policy)
    db.flush()
    audit_service.write_audit_log(
        db,
        actor=officer,
        action="retention_policy_created",
        module=audit_service.MODULE_GOVERNANCE,
        resource_type="retention_policy",
        resource_id=str(policy.id),
        detail=json.dumps(
            {
                "entity_type": payload.entity_type,
                "retention_days": payload.retention_days,
                "reason": payload.reason,
            }
        ),
    )
    db.commit()
    db.refresh(policy)
    return _to_response(db, policy)


def list_retention_policies(db: Session, active_only: bool | None) -> list[RetentionPolicyResponse]:
    stmt = select(RetentionPolicy).order_by(RetentionPolicy.created_at.desc())
    if active_only is not None:
        stmt = stmt.where(RetentionPolicy.active == active_only)
    rows = db.execute(stmt).scalars().all()
    return [_to_response(db, p) for p in rows]


def deactivate_retention_policy(
    db: Session, officer: Officer, policy_id: UUID
) -> RetentionPolicyResponse:
    policy = db.get(RetentionPolicy, policy_id)
    if policy is None or not policy.active:
        raise RetentionPolicyNotFoundError(str(policy_id))
    policy.active = False
    db.flush()
    audit_service.write_audit_log(
        db,
        actor=officer,
        action="retention_policy_deactivated",
        module=audit_service.MODULE_GOVERNANCE,
        resource_type="retention_policy",
        resource_id=str(policy.id),
        detail=None,
    )
    db.commit()
    db.refresh(policy)
    return _to_response(db, policy)


def list_candidates(db: Session, policy_id: UUID) -> list[RetentionCandidate]:
    policy = db.get(RetentionPolicy, policy_id)
    if policy is None:
        raise RetentionPolicyNotFoundError(str(policy_id))
    model = _ENTITY_MODELS[policy.entity_type]
    stmt = _eligibility_stmt(policy.entity_type, policy.retention_days).order_by(model.created_at.asc())
    rows = db.execute(stmt).scalars().all()
    now = datetime.now(timezone.utc)
    return [
        RetentionCandidate(
            id=str(row.id),
            label=_label(policy.entity_type, row),
            age_days=(now - row.created_at).days,
        )
        for row in rows
    ]
