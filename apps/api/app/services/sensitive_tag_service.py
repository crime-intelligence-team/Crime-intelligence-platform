"""Sensitive-tag (Person.is_protected_subject) admin management.

The flag itself and its enforcement already existed and predate this
service: entity_resolution_service's merge guard, network_service's
PROTECTED-tier graph gating, and alert_service's sensitive-tag proxy all
already read Person.is_protected_subject. What was missing was any way to
SET it — it was seed-data only, with no write endpoint and no admin
surface. This adds the write path and the admin listing, gated
system:configure (Administrator only — previously reserved but unused,
see app/core/permissions.py), with every change audited.
"""

import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Officer, Person
from app.schemas.common import ClassificationLevel
from app.schemas.sensitive_tags import SensitiveSubjectOut
from app.services import audit_service


def _to_output(person: Person) -> SensitiveSubjectOut:
    return SensitiveSubjectOut(
        id=str(person.id),
        full_name=person.full_name,
        classification=ClassificationLevel(person.classification.value),
        is_protected_subject=bool(person.is_protected_subject),
    )


def list_protected_subjects(db: Session) -> list[SensitiveSubjectOut]:
    rows = (
        db.execute(
            select(Person)
            .where(Person.is_protected_subject == 1)
            .order_by(Person.full_name)
        )
        .scalars()
        .all()
    )
    return [_to_output(p) for p in rows]


def set_protected_subject(
    db: Session,
    officer: Officer,
    person_id: UUID,
    is_protected: bool,
    reason: str,
) -> SensitiveSubjectOut | None:
    """None -> person does not exist (router 404). A no-op (the flag
    already matches the requested state) is accepted but not audited —
    same idiom as case_service.update_case_status."""
    person = db.get(Person, person_id)
    if person is None:
        return None
    previous = bool(person.is_protected_subject)
    if previous != is_protected:
        person.is_protected_subject = 1 if is_protected else 0
        db.flush()
        audit_service.write_audit_log(
            db,
            actor=officer,
            action="sensitive_tag_set" if is_protected else "sensitive_tag_removed",
            module=audit_service.MODULE_GOVERNANCE,
            resource_type="person",
            resource_id=str(person.id),
            detail=json.dumps({"reason": reason}),
        )
        db.commit()
    return _to_output(person)
