"""Audit log service (brief section 9): the single write path plus list +
filter. Every module that used to construct AuditLogEntry directly now
calls write_audit_log() here instead, so the actor_role/actor_district_id
snapshot and the module/success fields are populated consistently in one
place rather than re-implemented per service (see AuditLogEntry's
docstring for why the snapshot exists).

Every entry is surfaced regardless of the viewer's district scope: the
log is a compliance record and the endpoint is gated audit:view
(supervisor/administrator only), so no per-row district scoping applies.
"""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.entities import Officer
from app.models.governance import AuditLogEntry
from app.schemas.audit import AuditLogEntryOut

# Which UI/API module an action belongs to — kept as one map so every
# write site stays consistent (mirrors the backfill map used by the
# c1f4a8e6b2d7 migration for pre-existing rows).
MODULE_AUTH = "auth"
MODULE_MAP = "map"
MODULE_DASHBOARD = "dashboard"
MODULE_NETWORK = "network"
MODULE_CASES = "cases"
MODULE_GOVERNANCE = "governance"


def write_audit_log(
    db: Session,
    *,
    actor: Officer | None,
    action: str,
    module: str,
    success: bool = True,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    device_identity: str | None = None,
    detail: str | None = None,
) -> AuditLogEntry:
    """Add one audit row to the session (caller commits — matches the
    existing per-service transaction boundaries; some sites batch the
    audit write with other changes, others commit immediately on a
    failure path). actor_role/actor_district_id are read off `actor`
    right now, at the moment of the action, and stamped onto the row —
    never resolved later via a join, which is what let a role change
    silently rewrite old entries' apparent role/jurisdiction before this
    was added."""
    entry = AuditLogEntry(
        actor_id=actor.id if actor else None,
        actor_role=actor.role if actor else None,
        actor_district_id=actor.home_district_id if actor else None,
        action=action,
        module=module,
        success=success,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        device_identity=device_identity,
        detail=detail,
    )
    db.add(entry)
    return entry


def list_audit_entries(
    db: Session,
    officer: Officer,
    page: int,
    page_size: int,
    action: str | None = None,
    actor_id: str | None = None,
    module: str | None = None,
    success: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    query: str | None = None,
) -> tuple[list[AuditLogEntryOut], int]:
    """Newest-first audit trail with optional filters. The officer argument
    is unused by the query (routing permission is enforced by the router's
    audit:view gate) but kept for signature symmetry with the other list
    services and to make the endpoint's intent explicit."""
    stmt = select(AuditLogEntry).options(
        joinedload(AuditLogEntry.actor), joinedload(AuditLogEntry.actor_district)
    )
    if action:
        stmt = stmt.where(AuditLogEntry.action == action)
    if actor_id:
        stmt = stmt.where(AuditLogEntry.actor_id == actor_id)
    if module:
        stmt = stmt.where(AuditLogEntry.module == module)
    if success is not None:
        stmt = stmt.where(AuditLogEntry.success == success)
    if date_from:
        stmt = stmt.where(AuditLogEntry.created_at >= date_from)
    if date_to:
        stmt = stmt.where(AuditLogEntry.created_at <= date_to)
    if query:
        stmt = stmt.where(
            AuditLogEntry.action.ilike(f"%{query}%")
            | AuditLogEntry.resource_type.ilike(f"%{query}%")
            | AuditLogEntry.resource_id.ilike(f"%{query}%")
            | AuditLogEntry.detail.ilike(f"%{query}%")
        )

    total = db.execute(
        select(func.count()).select_from(stmt.subquery())
    ).scalar() or 0
    rows = db.execute(
        stmt.order_by(AuditLogEntry.created_at.desc(), AuditLogEntry.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return [_to_out(e) for e in rows], total


def _to_out(entry: AuditLogEntry) -> AuditLogEntryOut:
    return AuditLogEntryOut(
        id=str(entry.id),
        actor_id=str(entry.actor_id) if entry.actor_id else None,
        actor_name=entry.actor.full_name if entry.actor else None,
        actor_role=entry.actor_role.value if entry.actor_role else None,
        actor_district_id=str(entry.actor_district_id) if entry.actor_district_id else None,
        actor_district_name=entry.actor_district.name if entry.actor_district else None,
        action=entry.action,
        module=entry.module,
        success=entry.success,
        resource_type=entry.resource_type,
        resource_id=entry.resource_id,
        ip_address=entry.ip_address,
        device_identity=entry.device_identity,
        detail=entry.detail,
        created_at=entry.created_at.isoformat() if entry.created_at else None,
    )
