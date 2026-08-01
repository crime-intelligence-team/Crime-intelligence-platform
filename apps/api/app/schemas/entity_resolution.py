from uuid import UUID

from pydantic import BaseModel, Field


class MergeRequest(BaseModel):
    """Merge absorbed_entity_id into primary_entity_id (persons only this
    phase — brief 7.8 reduced scope; docs/decisions/011)."""

    primary_entity_id: UUID = Field(...)
    absorbed_entity_id: UUID = Field(...)
    entity_type: str = Field(default="person")


class MergeResponse(BaseModel):
    id: str
    primary_entity_id: str
    absorbed_entity_id: str
    entity_type: str
    status: str  # merged | reversed
