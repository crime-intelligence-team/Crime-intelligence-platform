from __future__ import annotations

from enum import Enum
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ClassificationLevel(str, Enum):
    OPEN_OPERATIONAL = "open_operational"
    RESTRICTED_OPERATIONAL = "restricted_operational"
    PROTECTED = "protected"
    SEALED = "sealed"


class ConfidenceBand(str, Enum):
    UNCONFIRMED = "unconfirmed"
    PROBABLE = "probable"
    VERIFIED = "verified"


class Confidence(BaseModel):
    score: int  # 0-100
    band: ConfidenceBand


class RedactedField(BaseModel):
    """
    Contract rule: redacted fields return this shape instead of being omitted.
    reason is "policy" (rule says hide it) or "no_access" (this viewer lacks clearance).
    """

    redacted: bool = True
    reason: str  # "policy" | "no_access"


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Any = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
