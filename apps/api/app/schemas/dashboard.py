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
    id: str
    type: str  # suspect | gang | repeat_offender | vehicle | phone | address
    label: str
    classification: ClassificationLevel
    confidence: Confidence | None = None


class Alert(BaseModel):
    id: str
    type: str  # resurfaced_offender | new_inter_district_link | confidence_change | case_escalation
    summary: str
    classification: ClassificationLevel
    created_at: str


class DashboardResponse(BaseModel):
    region_id: str
    kpis: KpiStrip
    trends: list[TrendSeries]
    hotspots: list[Hotspot]
    priority_entities: list[PriorityEntity]
    alerts: list[Alert]
