from pydantic import BaseModel

from app.schemas.common import ClassificationLevel, Confidence


class KpiStrip(BaseModel):
    total_incidents: int
    active_gangs: int
    open_cases: int
    high_priority_entities: int


class TrendPoint(BaseModel):
    date: str
    value: int


class TrendSeries(BaseModel):
    window: str  # "7d" | "30d" | "90d"
    points: list[TrendPoint]


class Hotspot(BaseModel):
    location_id: str
    label: str
    incident_count: int
    movement: str | None = None  # e.g. "increasing" | "stable" | "decreasing"


class PriorityEntity(BaseModel):
    """Read shape for computed priority entities (Phase 6 component 2).
    Type vocabulary aligned to computable signals: person, gang, vehicle,
    device; repeat_offender is a defined but currently non-computable type
    (no arrest/repeat data exists — docs/decisions/007); address was not
    brief-derived for the priority list and was dropped."""

    id: str
    type: str  # person | gang | vehicle | device | repeat_offender
    label: str
    classification: ClassificationLevel
    confidence: Confidence | None = None


class Alert(BaseModel):
    """Intelligence-feed alert. Vocabulary verified against the brief in
    docs/decisions/007: resurfaced_offender, new_inter_district_link,
    confidence_change (case_escalation deliberately dropped — zero brief
    support). entity_type/entity_id/district_id are the alert subject
    (nullable — the stub dashboard shape predates the real table)."""

    id: str
    type: str
    summary: str
    classification: ClassificationLevel
    created_at: str
    entity_type: str | None = None
    entity_id: str | None = None
    district_id: str | None = None


class DashboardResponse(BaseModel):
    region_id: str
    kpis: KpiStrip
    trends: list[TrendSeries]
    hotspots: list[Hotspot]
    priority_entities: list[PriorityEntity]
    alerts: list[Alert]
