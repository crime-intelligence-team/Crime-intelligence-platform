from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.models.base import TimestampMixin, uuid_pk_column


class AccessExceptionRequest(Base, TimestampMixin):
    """Cross-district access exception workflow (brief 7.2). Time-bound + scope-bound."""

    __tablename__ = "access_exception_requests"

    id = uuid_pk_column()
    requested_by_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=False)
    case_reference = Column(String, nullable=False)
    operational_reason = Column(Text, nullable=False)
    requested_duration_hours = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending|approved|denied|expired|revoked
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    scope_json = Column(Text, nullable=True)  # JSON-encoded scope (which records/districts)
    expires_at = Column(DateTime(timezone=True), nullable=True)


class RedactionPolicyDecision(Base, TimestampMixin):
    """A concrete redaction decision, distinct from the global rule that produced it (brief 7.10)."""

    __tablename__ = "redaction_policy_decisions"

    id = uuid_pk_column()
    target_type = Column(String, nullable=False)  # field | entity | relationship | export
    target_id = Column(String, nullable=False)
    granularity = Column(String, nullable=False)  # field_level|entity_level|relationship_level|export_level
    reason = Column(String, nullable=False)  # "policy" | "no_access"
    is_full_concealment = Column(Boolean, default=False)  # vs. "withheld marker" visible
    decided_by_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=True)
    is_automatic = Column(Boolean, default=False)  # source-driven, non-overridable
    notes = Column(Text, nullable=True)


class ConfidenceReviewEvent(Base, TimestampMixin):
    """Audit trail for confidence disputes/confirmations (brief section 6 + 7.9)."""

    __tablename__ = "confidence_review_events"

    id = uuid_pk_column()
    target_type = Column(String, nullable=False)  # edge | source | zone_score | entity_resolution | alert
    target_id = Column(String, nullable=False)
    action = Column(String, nullable=False)  # dispute | confirm
    original_score = Column(String, nullable=True)
    proposed_score = Column(String, nullable=True)
    submitted_by_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=False)
    review_status = Column(String, nullable=False, default="pending")  # pending|accepted|rejected|escalated
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)


class AuditLogEntry(Base, TimestampMixin):
    """Append-only log: every search, filter, view, export, note action, approval (brief section 9)."""

    __tablename__ = "audit_log_entries"

    id = uuid_pk_column()
    actor_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=True)
    action = Column(String, nullable=False)  # e.g. "login", "export", "view_entity"
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    device_identity = Column(String, nullable=True)
    detail = Column(Text, nullable=True)
