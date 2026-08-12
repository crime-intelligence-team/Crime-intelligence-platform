"""Sensitive-tag (Person.is_protected_subject) admin shapes.

The flag and its enforcement already existed (entity_resolution_service's
merge guard, network_service's PROTECTED-tier graph gating, alert_service's
sensitive-tag proxy — see Person.is_protected_subject) with no way to set
it; these shapes back the write path and admin listing that were missing.
"""

from pydantic import BaseModel

from app.schemas.common import ClassificationLevel


class SensitiveTagUpdate(BaseModel):
    is_protected_subject: bool
    reason: str


class SensitiveSubjectOut(BaseModel):
    id: str
    full_name: str
    classification: ClassificationLevel
    is_protected_subject: bool
