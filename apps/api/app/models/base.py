import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ClassificationLevel(str, enum.Enum):
    OPEN_OPERATIONAL = "open_operational"
    RESTRICTED_OPERATIONAL = "restricted_operational"
    PROTECTED = "protected"
    SEALED = "sealed"


# Ordering used to enforce "inheritance must never silently lower sensitivity".
CLASSIFICATION_RANK = {
    ClassificationLevel.OPEN_OPERATIONAL: 0,
    ClassificationLevel.RESTRICTED_OPERATIONAL: 1,
    ClassificationLevel.PROTECTED: 2,
    ClassificationLevel.SEALED: 3,
}


class ConfidenceBand(str, enum.Enum):
    UNCONFIRMED = "unconfirmed"
    PROBABLE = "probable"
    VERIFIED = "verified"


def band_for_score(score: int) -> ConfidenceBand:
    """Single source of truth for numeric score -> band, per brief section 6."""
    if score < 0 or score > 100:
        raise ValueError("confidence score must be between 0 and 100")
    if score <= 39:
        return ConfidenceBand.UNCONFIRMED
    if score <= 69:
        return ConfidenceBand.PROBABLE
    return ConfidenceBand.VERIFIED


class VerificationStatus(str, enum.Enum):
    UNVERIFIED = "unverified"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    DISPUTED = "disputed"


def uuid_pk_column():
    return Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class ClassificationMixin:
    """Every sensitive entity/record carries exactly one classification label."""

    classification = Column(
        Enum(ClassificationLevel, name="classification_level"),
        nullable=False,
        default=ClassificationLevel.RESTRICTED_OPERATIONAL,
    )


class ProvenanceMixin:
    """Every ingested record must preserve provenance (brief section 4)."""

    source_name = Column(String, nullable=True)
    source_timestamp = Column(DateTime(timezone=True), nullable=True)
    ingestion_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    mapping_schema_version = Column(String, nullable=True)


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
