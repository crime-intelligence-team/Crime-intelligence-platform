"""Retention-eligibility policy shapes (mirrors app/models/governance.py's
RetentionPolicy — see that model's docstring for the flag-only design and
why case is status-gated while other entity types are age-only).
"""

from pydantic import BaseModel


class RetentionPolicyCreate(BaseModel):
    entity_type: str
    retention_days: int
    reason: str


class RetentionPolicyResponse(BaseModel):
    id: str
    entity_type: str
    retention_days: int
    reason: str
    active: bool
    candidate_count: int
    created_by_id: str
    created_at: str | None


class RetentionCandidate(BaseModel):
    """One record currently past a policy's retention window. Flag-only —
    surfaced for a human to review, never acted on by the platform."""

    id: str
    label: str
    age_days: int
