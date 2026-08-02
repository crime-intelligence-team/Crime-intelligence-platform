"""Redaction policy engine (Phase 6 component 3; docs/decisions/008).

Composes with — never replaces — record-level tier gating: the tier
filter (classification_filter) decides which RECORDS survive; this engine
decides which FIELDS inside surviving records are masked in the export
artifact. It applies in the export pipeline only — every PRD redaction
citation is export/inter-unit scoped, and no read path emits redacted
content (GET /cases, network, dashboard, alerts untouched).

Two mechanisms, both PRD-backed:
  - Policy rules: admin-defined RedactionPolicyDecision rows
    (redaction:manage; ADMINISTRATOR is the only holder). Applied to every
    export unconditionally — audience/destination matching is deferred
    (decision 008 Q-E).
  - Ad-hoc: ExportRequest.redact_note_ids masks specific notes for one
    export (the supervisor "redaction where needed" user story). Request-
    level only, never persisted; recorded in the export_redaction audit.

Reason vocabulary (RedactedField contract, decision 008 Q-C):
  - "policy": fired by a rule; "manual": ad-hoc masking.

The export classification label stays at the PRE-redaction tier: redaction
hides content but must never understate the sensitivity of what remains
(fail-closed — decision 008).
"""

import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import CLASSIFICATION_RANK
from app.models.entities import Officer
from app.models.governance import AuditLogEntry, RedactionPolicyDecision
from app.schemas.cases import ExportResponse, RedactionPolicyCreate
from app.schemas.network import EntityDetail
from app.schemas.common import RedactedField


class InvalidRedactionTargetError(Exception):
    """entity_type/field outside the approved vocabulary (400 at the router)."""


class RedactionPolicyNotFoundError(Exception):
    """policy id does not exist or is already inactive (404 at the router)."""


def _write_audit_log(
    db: Session,
    actor_id,
    action: str,
    resource_type: str | None,
    resource_id: str | None,
    detail: str | None,
    ip_address: str | None = None,
) -> None:
    """Same AuditLogEntry shape case_service/auth_service use. Redaction
    events are their own audited entries (policy CRUD + export_redaction +
    entity_redaction), additive to the existing export audit — no frozen
    code is touched."""
    db.add(
        AuditLogEntry(
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
            ip_address=ip_address,
        )
    )


def create_policy(
    db: Session,
    officer: Officer,
    payload: RedactionPolicyCreate,
) -> RedactionPolicyDecision:
    if payload.entity_type not in RedactionPolicyDecision.REDACTION_ENTITY_TYPES:
        raise InvalidRedactionTargetError()
    if f"{payload.entity_type}.{payload.field}" not in RedactionPolicyDecision.REDACTION_FIELDS:
        raise InvalidRedactionTargetError()
    policy = RedactionPolicyDecision(
        entity_type=payload.entity_type,
        field=payload.field,
        min_classification=payload.min_classification,
        decision=RedactionPolicyDecision.VALID_DECISIONS[0],
        reason=payload.reason,
        active=True,
        created_by_id=officer.id,
    )
    db.add(policy)
    db.flush()
    _write_audit_log(
        db=db,
        actor_id=officer.id,
        action="redaction_policy_created",
        resource_type="redaction_policy",
        resource_id=str(policy.id),
        detail=json.dumps(
            {
                "entity_type": payload.entity_type,
                "field": payload.field,
                "min_classification": payload.min_classification.value,
                "reason": payload.reason,
            }
        ),
    )
    db.commit()
    db.refresh(policy)
    return policy


def list_policies(
    db: Session,
    active_only: bool | None,
) -> list[RedactionPolicyDecision]:
    stmt = select(RedactionPolicyDecision).order_by(
        RedactionPolicyDecision.created_at.desc()
    )
    if active_only is not None:
        stmt = stmt.where(RedactionPolicyDecision.active == active_only)
    return list(db.execute(stmt).scalars().all())


def deactivate_policy(db: Session, officer: Officer, policy_id: UUID) -> RedactionPolicyDecision:
    policy = db.get(RedactionPolicyDecision, policy_id)
    if policy is None or not policy.active:
        raise RedactionPolicyNotFoundError()
    policy.active = False
    db.flush()
    _write_audit_log(
        db=db,
        actor_id=officer.id,
        action="redaction_policy_deactivated",
        resource_type="redaction_policy",
        resource_id=str(policy.id),
        detail=None,
    )
    db.commit()
    db.refresh(policy)
    return policy


def _matches(policy: RedactionPolicyDecision, record_classification) -> bool:
    """Fires when the record's tier is at or above the rule's minimum."""
    return (
        CLASSIFICATION_RANK[record_classification]
        >= CLASSIFICATION_RANK[policy.min_classification]
    )


def apply_redactions(
    db: Session,
    officer: Officer,
    export: ExportResponse,
    redact_note_ids: list[UUID] | None,
    ip_address: str | None,
) -> ExportResponse:
    """Post-processes an export artifact produced by the untouched
    case_service.export_case. Applies active rules unconditionally and the
    ad-hoc note list if given. Returns the export unchanged (same object)
    when nothing was masked — the no-rules/no-ad-hoc path is byte-identical
    to Phase 5. Writes ONE export_redaction audit entry per export that
    actually masked content (only-success auditing, same as exports)."""
    policies = list(
        db.execute(
            select(RedactionPolicyDecision).where(
                RedactionPolicyDecision.active.is_(True)
            )
        )
        .scalars()
        .all()
    )
    ad_hoc_ids = {str(nid) for nid in (redact_note_ids or [])}
    if not policies and not ad_hoc_ids:
        return export

    applied_policy_ids: list[str] = []
    masked_note_ids: list[str] = []
    masked_notes: list = []
    for note in export.notes:
        body = note.body
        policy_ids = [
            str(p.id)
            for p in policies
            if p.entity_type == "note"
            and p.field == "body"
            and _matches(p, note.classification)
        ]
        if policy_ids:
            applied_policy_ids.extend(policy_ids)
            body = RedactedField(redacted=True, reason="policy")
        elif note.id in ad_hoc_ids:
            body = RedactedField(redacted=True, reason="manual")
        if body is not note.body:
            masked_note_ids.append(note.id)
            masked_notes.append(note.model_copy(update={"body": body}))

    summary = export.case.summary
    summary_policy_ids = [
        str(p.id)
        for p in policies
        if p.entity_type == "case"
        and p.field == "summary"
        and _matches(p, export.case.classification)
    ]
    if summary_policy_ids:
        applied_policy_ids.extend(summary_policy_ids)
        summary = RedactedField(redacted=True, reason="policy")

    if not masked_notes and summary is export.case.summary:
        return export

    updated = export.model_copy(
        update={
            "notes": [
                note if note.id not in {m.id for m in masked_notes} else next(m for m in masked_notes if m.id == note.id)
                for note in export.notes
            ],
            "case": (
                export.case.model_copy(update={"summary": summary})
                if summary is not export.case.summary
                else export.case
            ),
        }
    )
    _write_audit_log(
        db=db,
        actor_id=officer.id,
        action="export_redaction",
        resource_type="case",
        resource_id=str(export.case.id),
        detail=json.dumps(
            {
                "export_id": export.export_id,
                "applied_policy_ids": sorted(set(applied_policy_ids)),
                "redacted_note_ids": masked_note_ids,
                "redacted_case_summary": summary is not export.case.summary,
                "ip_address": ip_address,
            }
        ),
    )
    db.commit()
    return updated


ENTITY_DETAIL_FIELDS = (
    "label", "aliases", "date_of_birth", "org_type", "registration_number",
    "make", "model", "color", "phone_number", "imei", "device_type",
    "raw_text",
)


def apply_entity_redactions(
    db: Session,
    officer: Officer,
    detail: EntityDetail,
    ip_address: str | None,
) -> EntityDetail:
    """Field-level redaction for the entity detail read path (Phase 7
    follow-up component 2; same engine as export redaction — decision 008).

    Active policy rules fire when the detail's classification is at/above
    the rule minimum (the `_matches` semantics export uses). `label` is a
    shared field (rules use entity_type="entity"); every other field is
    scoped to the detail's own type (person/organization/vehicle/device/
    address). Masking is whole-field: the value is REPLACED by a
    RedactedField(reason="policy"); already-redacted and absent fields are
    never touched. Unredactable fields (id/type/classification/district_id/
    is_protected_subject) are not in the vocabulary and can never match.

    Returns the detail unchanged when nothing fires — the no-rules path is
    byte-identical to pre-component output. Writes ONE entity_redaction
    audit entry per detail that masked content (only-success auditing)."""
    policies = list(
        db.execute(
            select(RedactionPolicyDecision).where(
                RedactionPolicyDecision.active.is_(True)
            )
        )
        .scalars()
        .all()
    )
    if not policies:
        return detail

    masked: dict[str, object] = {}
    fired: list[str] = []
    for field in ENTITY_DETAIL_FIELDS:
        value = getattr(detail, field, None)
        if value is None or isinstance(value, RedactedField):
            continue
        entity_type = "entity" if field == "label" else str(detail.type)
        policy_ids = [
            str(p.id)
            for p in policies
            if p.entity_type == entity_type
            and p.field == field
            and _matches(p, detail.classification)
        ]
        if policy_ids:
            fired.extend(policy_ids)
            masked[field] = RedactedField(redacted=True, reason="policy")

    if not masked:
        return detail

    updated = detail.model_copy(update=masked)
    _write_audit_log(
        db=db,
        actor_id=officer.id,
        action="entity_redaction",
        resource_type="entity",
        resource_id=detail.id,
        detail=(
            "Masked fields: " + ", ".join(sorted(masked))
            + "; policy ids: " + ", ".join(sorted(set(fired)))
        ),
        ip_address=ip_address,
    )
    db.commit()
    return updated
