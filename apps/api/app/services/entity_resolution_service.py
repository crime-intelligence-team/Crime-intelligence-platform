"""Person merge / entity resolution (brief 7.8; docs/decisions/011, reduced
scope).

V1 merge is POSTGRES-SIDE only: the absorbed person's visibility pointer
(merged_into_id) is set and its field data is copied onto the primary.
Neo4j re-pointing is EXPLICITLY DEFERRED — the graph keeps its old
relationships keyed by the absorbed entity id (stale edges; documented
as the known gap in 011).

Reversal is deliberately limited: it clears the visibility pointer
(absorbed regains independent visibility) and marks the event reversed;
merged field copies stay on the primary (no undo of data — 011).

Protected subjects are BLOCKED as either primary or absorbed (hard
guard: the protection flag may be redacted from lower-tier officers, so
no merge can silently collapse a protected person).

Conflict rule (inferred from brief 7.8 — flagged in 011): per field,
non-null wins; if both non-null, the more-recently-created record wins.
Classification is never downgraded (max rank of the pair). The absorbed
full_name is appended to the primary's aliases when different, keeping
the absorbed name searchable (the read path hides the absorbed ROW, not
the name).

Gated at role ADMINISTRATOR (data-integrity operation; the pre-008 admin
stub precedent; flagged in 011).
"""

import json
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import CLASSIFICATION_RANK, ClassificationLevel
from app.models.entities import Officer, Person
from app.models.governance import EntityResolutionEvent
from app.schemas.entity_resolution import MergeRequest
from app.services import audit_service


class InvalidEntityTypeError(Exception):
    """entity_type outside the supported set (422 at the router)."""


class EntityNotFoundError(Exception):
    """One of the two entities does not exist (404 at the router)."""


class SameEntityError(Exception):
    """primary == absorbed (422 at the router)."""


class ProtectedSubjectMergeBlockedError(Exception):
    """Either entity is a protected subject (422 at the router)."""


class PrimaryAlreadyAbsorbedError(Exception):
    """The proposed primary is itself an absorbed person (422)."""


class AlreadyMergedError(Exception):
    """The proposed absorbed person is already merged (422)."""


class ResolutionEventNotFoundError(Exception):
    """No such resolution event (404 at the router)."""


class AlreadyReversedError(Exception):
    """The event is already reversed (422 at the router)."""


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
        resource_type="entity_resolution",
        resource_id=resource_id,
        detail=detail,
    )


def _merge_field(primary, absorbed, column) -> None:
    """Conflict rule (inferred, flagged in 011): non-null wins; if both
    non-null, the more-recently-created record wins."""
    primary_value = getattr(primary, column)
    absorbed_value = getattr(absorbed, column)
    if primary_value is None and absorbed_value is None:
        return
    if primary_value is not None and absorbed_value is not None:
        if primary.created_at > absorbed.created_at:
            return
        setattr(primary, column, absorbed_value)
        return
    if primary_value is None:
        setattr(primary, column, absorbed_value)


def merge_entities(
    db: Session,
    officer: Officer,
    payload: MergeRequest,
) -> EntityResolutionEvent:
    if payload.entity_type != "person":
        raise InvalidEntityTypeError()
    if payload.primary_entity_id == payload.absorbed_entity_id:
        raise SameEntityError()

    # Phase 7 component 2: lock both person rows so concurrent merges of
    # the same absorbed person serialize — the second caller sees
    # merged_into_id set and fails with AlreadyMergedError (backstopped
    # by the partial unique index, migration 7d2c1e4f9b3a).
    primary = db.get(Person, payload.primary_entity_id, with_for_update=True)
    if primary is None:
        raise EntityNotFoundError()
    absorbed = db.get(Person, payload.absorbed_entity_id, with_for_update=True)
    if absorbed is None:
        raise EntityNotFoundError()

    if primary.is_protected_subject or absorbed.is_protected_subject:
        raise ProtectedSubjectMergeBlockedError()
    if primary.merged_into_id is not None:
        raise PrimaryAlreadyAbsorbedError()
    if absorbed.merged_into_id is not None:
        raise AlreadyMergedError()

    # List-valued field (aliases): union, never replace — a merged identity
    # keeps both alias sets so both names stay searchable (list-field
    # variant of the flagged conflict rule; 011). The absorbed full_name is
    # also retained when it differs from the primary's.
    primary_aliases = []
    if primary.aliases:
        try:
            primary_aliases = json.loads(primary.aliases)
        except ValueError:
            primary_aliases = []
    absorbed_aliases = []
    if absorbed.aliases:
        try:
            absorbed_aliases = json.loads(absorbed.aliases)
        except ValueError:
            absorbed_aliases = []
    merged_aliases = list(dict.fromkeys([*primary_aliases, *absorbed_aliases]))
    if primary.full_name != absorbed.full_name and absorbed.full_name not in merged_aliases:
        merged_aliases.append(absorbed.full_name)
    if json.dumps(primary_aliases) != json.dumps(merged_aliases):
        primary.aliases = json.dumps(merged_aliases)
    _merge_field(primary, absorbed, "date_of_birth")
    primary.classification = max(
        primary.classification, absorbed.classification, key=lambda c: CLASSIFICATION_RANK[c]
    )

    absorbed.merged_into_id = primary.id
    event = EntityResolutionEvent(
        primary_entity_id=primary.id,
        absorbed_entity_id=absorbed.id,
        entity_type="person",
        performed_by_id=officer.id,
        performed_at=datetime.now(timezone.utc),
    )
    db.add(event)
    db.flush()
    _write_audit_log(
        db,
        actor=officer,
        action="entity_merge_performed",
        resource_id=str(event.id),
        detail=json.dumps(
            {
                "primary_entity_id": str(primary.id),
                "absorbed_entity_id": str(absorbed.id),
                "entity_type": "person",
            }
        ),
    )
    db.commit()
    db.refresh(event)
    return event


def reverse_merge(
    db: Session,
    officer: Officer,
    event_id: UUID,
) -> EntityResolutionEvent:
    event = db.get(EntityResolutionEvent, event_id)
    if event is None:
        raise ResolutionEventNotFoundError()
    if event.reversed_at is not None:
        raise AlreadyReversedError()

    absorbed = db.get(Person, event.absorbed_entity_id)
    if absorbed is not None and absorbed.merged_into_id == event.primary_entity_id:
        absorbed.merged_into_id = None
    event.reversed_at = datetime.now(timezone.utc)
    db.flush()
    _write_audit_log(
        db,
        actor=officer,
        action="entity_merge_reversed",
        resource_id=str(event.id),
        detail=json.dumps(
            {
                "primary_entity_id": str(event.primary_entity_id),
                "absorbed_entity_id": str(event.absorbed_entity_id),
                "reversed_at": event.reversed_at.isoformat(),
            }
        ),
    )
    db.commit()
    db.refresh(event)
    return event
