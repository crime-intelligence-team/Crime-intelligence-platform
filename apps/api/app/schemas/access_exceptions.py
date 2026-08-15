"""Access exception request/response shapes (Phase 6 component 4).

case_reference is the CASE NUMBER (uppercased, same normalization as
create_case) — the user-facing reference officers know; enforcement
resolves it to a case id at read time. `effective` is derived: true only
while status==approved AND expires_at is in the future (expiry is checked
inline, never flipped by a job — the stored status stays "approved").
"""

from uuid import UUID

from pydantic import BaseModel


class AccessExceptionRequestCreate(BaseModel):
    case_reference: str
    operational_reason: str
    requested_duration_hours: str  # whole hours, 1..8760 (validated)


class AccessExceptionRequestResponse(BaseModel):
    id: str
    case_reference: str
    operational_reason: str
    requested_duration_hours: str
    status: str  # pending | approved | denied | revoked
    requested_by_id: str
    reviewed_by_id: str | None
    reviewed_at: str | None
    expires_at: str | None
    effective: bool  # derived: approved AND not yet expired
    created_at: str | None
