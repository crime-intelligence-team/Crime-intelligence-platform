from typing import Any

from pydantic import BaseModel

from app.schemas.common import ClassificationLevel, Confidence


class DistrictSummary(BaseModel):
    id: str
    name: str
    code: str
    classification: ClassificationLevel
    geometry: dict[str, Any]  # GeoJSON


class DistrictDetail(DistrictSummary):
    population: int | None = None


class DistrictQuickSummary(BaseModel):
    district_id: str
    open_cases: int
    active_alerts: int
    priority_entities: int
    classification: ClassificationLevel


class ZoneTopFactor(BaseModel):
    name: str
    weight: float
    description: str


class ZoneRiskOut(BaseModel):
    id: str
    district_id: str
    name: str
    score: int  # 0-100
    confidence: Confidence
    top_factors: list[ZoneTopFactor]
    run_timestamp: str
    recommended_interpretation: str  # low | elevated | priority_watch — never "verdict"
    analyst_review_status: str | None = None
    classification: ClassificationLevel
