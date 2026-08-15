"""Officer directory + hierarchy service (006 §4 / 999 §2.3): real
manager_id ancestry, replacing supervisory_chain's role-collapse
(`officer.role in (SUPERVISOR, ADMINISTRATOR)` — see case_service._note_visible,
which consumes get_subordinate_officer_ids instead of the raw role check).

No visibility gating on Officer records themselves (unlike Case/Note):
the roster isn't classification- or jurisdiction-scoped anywhere else in
the codebase, and officer:view/officer:manage (defined but unused before
this) are the only gates that apply.
"""

import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Officer
from app.schemas.officers import OfficerSummary
from app.services import audit_service

MAX_CHAIN_DEPTH = 20  # defensive bound against a malformed cycle in the data


class OfficerNotFoundError(Exception):
    """officer_id does not reference a real officer (404 at the router)."""


class ManagerNotFoundError(Exception):
    """manager_id does not reference a real officer (422 at the router)."""


class CannotBeOwnManagerError(Exception):
    """manager_id == officer_id (422 at the router)."""


class ManagerCycleError(Exception):
    """The proposed manager is already a (transitive) subordinate of the
    officer being assigned — accepting it would create a cycle in the
    reporting chain (422 at the router)."""


def _to_summary(officer: Officer) -> OfficerSummary:
    return OfficerSummary(
        id=str(officer.id),
        official_id=officer.official_id,
        full_name=officer.full_name,
        role=officer.role.value,
        unit=officer.unit,
        manager_id=str(officer.manager_id) if officer.manager_id else None,
    )


def list_officers(db: Session) -> list[OfficerSummary]:
    rows = db.execute(select(Officer).order_by(Officer.full_name)).scalars().all()
    return [_to_summary(o) for o in rows]


def get_subordinate_officer_ids(db: Session, manager_id: UUID) -> set[UUID]:
    """Every officer transitively reporting to manager_id (BFS down the
    manager_id tree), bounded to MAX_CHAIN_DEPTH levels — same defensive
    bound as network_service._merge_cluster_ids, guarding against a
    malformed cycle rather than assuming the data is always a clean tree."""
    subordinate_ids: set[UUID] = set()
    frontier = {manager_id}
    for _ in range(MAX_CHAIN_DEPTH):
        rows = db.execute(
            select(Officer.id).where(Officer.manager_id.in_(frontier))
        ).scalars().all()
        new_ids = set(rows) - subordinate_ids - {manager_id}
        if not new_ids:
            break
        subordinate_ids |= new_ids
        frontier = new_ids
    return subordinate_ids


def set_manager(
    db: Session,
    officer: Officer,
    officer_id: UUID,
    manager_id: UUID | None,
    ip_address: str | None = None,
) -> OfficerSummary:
    """Assign (or clear, manager_id=None) an officer's manager. `officer`
    is the acting officer (for the audit log); officer_id is the officer
    being reassigned."""
    target = db.get(Officer, officer_id)
    if target is None:
        raise OfficerNotFoundError(str(officer_id))

    if manager_id is not None:
        if manager_id == officer_id:
            raise CannotBeOwnManagerError(str(officer_id))
        manager = db.get(Officer, manager_id)
        if manager is None:
            raise ManagerNotFoundError(str(manager_id))
        if manager_id in get_subordinate_officer_ids(db, officer_id):
            raise ManagerCycleError(str(manager_id))

    target.manager_id = manager_id
    audit_service.write_audit_log(
        db,
        actor=officer,
        action="officer_manager_changed",
        module=audit_service.MODULE_GOVERNANCE,
        resource_type="officer",
        resource_id=str(target.id),
        ip_address=ip_address,
        detail=json.dumps({"manager_id": str(manager_id) if manager_id else None}),
    )
    db.commit()
    db.refresh(target)
    return _to_summary(target)
