"""Provenance data-source registry shapes (mirrors app/models/governance.py's
DataSource — see that model's docstring for why this exists and why it's
reconciled to ingested records by name match rather than a foreign key).
"""

from pydantic import BaseModel


class DataSourceCreate(BaseModel):
    name: str
    source_type: str
    owner: str
    cadence: str
    description: str | None = None


class DataSourceResponse(BaseModel):
    id: str
    name: str
    source_type: str
    owner: str
    cadence: str
    description: str | None
    active: bool
    record_count: int
    created_by_id: str
    created_at: str | None
