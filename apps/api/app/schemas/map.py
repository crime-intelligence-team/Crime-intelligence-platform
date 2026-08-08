from typing import Any

from pydantic import BaseModel

from app.schemas.common import ClassificationLevel, Confidence


class DistrictSummary(BaseModel):
    id: str
    name: str
    code: str
    classification: ClassificationLevel
    # GeoJSON; nullable because District.geometry is nullable on the model
    # (a district can exist before its boundary polygon is drawn) —
    # geometry_to_geojson already returns None for that case, but this
    # field was typed as required dict, so any geometry-less district 500'd
    # the entire /districts list for every officer (found via live browser
    # testing, not by any single feature's own test suite).
    geometry: dict[str, Any] | None


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
    score_id: str | None = None  # ZoneRiskScore PK — confidence-review target_id for zone_score
