"""Audit log read service (brief section 9). Append-only log — this module
exposes list + filter only; there is intentionally no write entry point
here (services write their own AuditLogEntry rows directly).

Every entry is surfaced regardless of the viewer's district scope: the
log is a compliance record and the endpoint is gated audit:view
(supervisor/administrator only), so no per-row district scoping applies.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.entities import Officer
from app.models.governance import AuditLogEntry
from app.schemas.audit import AuditLogEntryOut


def list_audit_entries(
    db: Session,
    officer: Officer,
    page: int,
    page_size: int,
    action: str | None = None,
    actor_id: str | None = None,
    query: str | None = None,
) -> tuple[list[AuditLogEntryOut], int]:
    """Newest-first audit trail with optional filters. The officer argument
    is unused by the query (routing permission is enforced by the router's
    audit:view gate) but kept for signature symmetry with the other list
    services and to make the endpoint's intent explicit."""
    stmt = select(AuditLogEntry).options(joinedload(AuditLogEntry.actor))
    if action:
        stmt = stmt.where(AuditLogEntry.action == action)
    if actor_id:
        stmt = stmt.where(AuditLogEntry.actor_id == actor_id)
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
        action=entry.action,
        resource_type=entry.resource_type,
        resource_id=entry.resource_id,
        ip_address=entry.ip_address,
        device_identity=entry.device_identity,
        detail=entry.detail,
        created_at=entry.created_at.isoformat() if entry.created_at else None,
    )
