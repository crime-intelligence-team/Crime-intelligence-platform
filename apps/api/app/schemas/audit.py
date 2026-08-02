"""Audit log read shapes (brief section 9 — every search, filter, view,
export, note action, approval is append-only logged).

The log is read-only from the API: no update/delete paths exist, matching
the append-only invariant of AuditLogEntry. actor_name is joined from the
officers table for display; it is None when the entry was system-generated
(actor_id null, e.g. a failed pre-auth login).
"""

from pydantic import BaseModel


class AuditLogEntryOut(BaseModel):
    id: str
    actor_id: str | None
    actor_name: str | None
    action: str
    resource_type: str | None
    resource_id: str | None
    ip_address: str | None
    device_identity: str | None
    detail: str | None
    created_at: str | None
