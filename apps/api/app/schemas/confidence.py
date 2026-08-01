"""Confidence review request/response shapes (Phase 6 component 6).

target_id is a RelationshipEdgeRef id (target_type=edge) or a
ZoneRiskScore id (target_type=zone_score). proposed_score is required
for disputes (0-100), ignored for confirms. review_status follows the
model vocabulary pending|accepted|rejected|escalated; the decision
endpoint accepts accept|reject (escalate is not a v1 path).
"""

from uuid import UUID

from pydantic import BaseModel


class ConfidenceReviewSubmit(BaseModel):
    target_type: str  # edge | zone_score
    target_id: UUID
    action: str  # dispute | confirm
    proposed_score: int | None = None


class ConfidenceReviewDecision(BaseModel):
    decision: str  # accept | reject


class ConfidenceReviewResponse(BaseModel):
    id: str
    target_type: str
    target_id: str
    action: str
    original_score: int | None
    proposed_score: int | None
    review_status: str
    submitted_by_id: str
    reviewed_by_id: str | None
    reviewed_at: str | None
    created_at: str | None
