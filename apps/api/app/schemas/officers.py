"""Officer directory / hierarchy shapes (006 §4 / 999 §2.3: real
manager_id ancestry, replacing the supervisory_chain role-collapse)."""

from uuid import UUID

from pydantic import BaseModel


class OfficerSummary(BaseModel):
    id: str
    official_id: str
    full_name: str
    role: str
    unit: str | None
    manager_id: str | None


class OfficerManagerUpdate(BaseModel):
    """Body for PATCH /officers/{id}/manager. manager_id=null clears the
    assignment (the officer reports to no one)."""

    manager_id: UUID | None
