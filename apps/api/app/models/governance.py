from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import ClassificationLevel, TimestampMixin, uuid_pk_column
from app.models.entities import Role


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
    """Admin-defined redaction RULE for the export pipeline (brief 7.10 /
    PRD open question "which fields require mandatory redaction in shared
    exports?"). The PRD answers the question as admin policy, not a
    hardcoded list; every redaction citation in the PRD is export/inter-unit
    scoped, so this engine applies to exports only (docs/decisions/008).

    This shape REPLACES the Phase 6 kickoff stub (decision-record columns
    target_type/granularity/is_automatic/...): the approved design is a
    persistent rule — entity_type+field at-or-above min_classification ->
    redact. Ad-hoc per-export redaction is request-level
    (ExportRequest.redact_note_ids), never persisted as rows.

    Semantics: fires when the target record's classification tier is at or
    above min_classification; applies to every export unconditionally
    (audience/destination matching deferred, decision 008 Q-E).
    """

    __tablename__ = "redaction_policy_decisions"

    REDACTION_ENTITY_TYPES = (
        "note", "case", "entity",
        "person", "organization", "vehicle", "device", "address",
    )
    REDACTION_FIELDS = frozenset(
        {
            "note.body", "case.summary",
            "entity.label",
            "person.aliases", "person.date_of_birth",
            "organization.org_type",
            "vehicle.registration_number", "vehicle.make", "vehicle.model",
            "vehicle.color",
            "device.phone_number", "device.imei", "device.device_type",
            "address.raw_text",
        }
    )
    VALID_DECISIONS = ("redact",)

    id = uuid_pk_column()
    entity_type = Column(String, nullable=False)  # note | case
    field = Column(String, nullable=False)  # body | summary
    min_classification = Column(
        Enum(ClassificationLevel, name="classification_level"),
        nullable=False,
    )
    decision = Column(String, nullable=False, default="redact")
    reason = Column(Text, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=False)


class DataSource(Base, TimestampMixin):
    """Catalog of the data-source identities that ProvenanceMixin.source_name
    (see app/models/base.py) is expected to reference. Every ingested record
    (Address/Person/Organization/Vehicle/Device/Case) already stamps a
    free-text source_name at ingestion — brief section 4's provenance
    requirement — but nothing governs what those strings ARE: no registry
    of known sources, no owner/cadence/status metadata, no admin visibility
    into what's actively feeding the platform. This is that registry.

    Deliberately NOT a FK retrofit onto the six ProvenanceMixin tables —
    source_name stays free-text; data_source_service resolves a source's
    record_count by matching on name at read time (same reconciliation
    idiom as case_service._resolve_zone_id's spatial match), so this can
    ship without a broader migration touching six existing tables' data."""

    __tablename__ = "data_sources"

    SOURCE_TYPES = frozenset(
        {"case_management", "sensor_feed", "partner_agency", "manual_entry", "other"}
    )
    CADENCES = frozenset({"real_time", "hourly", "daily", "weekly", "manual"})

    id = uuid_pk_column()
    name = Column(String, nullable=False, unique=True)  # matches ProvenanceMixin.source_name
    source_type = Column(String, nullable=False)
    owner = Column(String, nullable=False)  # team/unit responsible
    cadence = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=False)


class ConfidenceReviewEvent(Base, TimestampMixin):
    """Audit trail for confidence disputes/confirmations (brief section 6 +
    7.9; docs/decisions/010). Reshaped from the Phase 6 kickoff stub:
    scores are Integer (mirror/zone scores are ints), the supported
    target vocabulary is {edge, zone_score} (stub's source/entity_resolution
    /alert targets are not writable paths this phase and are rejected at
    submit). An ACCEPTED dispute writes the proposed score to the
    relational target (mirror-only; Neo4j edge-property sync explicitly
    DEFERRED — 010) and fires exactly one confidence_change Alert."""

    __tablename__ = "confidence_review_events"

    VALID_TARGET_TYPES = ("edge", "zone_score")
    VALID_ACTIONS = ("dispute", "confirm")
    VALID_REVIEW_STATUSES = ("pending", "accepted", "rejected", "escalated")
    VALID_DECISIONS = ("accept", "reject")

    id = uuid_pk_column()
    target_type = Column(String, nullable=False)  # edge | zone_score
    target_id = Column(String, nullable=False)  # RelationshipEdgeRef/ZoneRiskScore id
    action = Column(String, nullable=False)  # dispute | confirm
    original_score = Column(Integer, nullable=True)
    proposed_score = Column(Integer, nullable=True)
    submitted_by_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=False)
    review_status = Column(String, nullable=False, default="pending")  # pending|accepted|rejected|escalated
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)


class EntityResolutionEvent(Base, TimestampMixin):
    """Auditable merge record (brief 7.8; docs/decisions/011, reduced
    scope). One row per merge: the absorbed entity's visibility pointer
    (persons.merged_into_id) is cleared on reversal; the merged FIELD data
    stays on the primary (no undo of copies — documented in 011). Graph
    re-pointing is DEFERRED: Neo4j still references the absorbed entity id
    and the absorbed person's old relationships remain reachable only by
    that id (stale edges, documented gap)."""

    __tablename__ = "entity_resolution_events"

    VALID_ENTITY_TYPES = ("person",)

    id = uuid_pk_column()
    primary_entity_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=False)
    absorbed_entity_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=False)
    entity_type = Column(String, nullable=False, default="person")
    performed_by_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=False)
    performed_at = Column(DateTime(timezone=True), nullable=False)
    reversed_at = Column(DateTime(timezone=True), nullable=True)


class CaseTeamMember(Base, TimestampMixin):
    """Real case-team membership (006 §4 / 999 §2.2 open schema question):
    note visibility's case_team tier was lead-officer-or-author only
    because no membership table existed. Soft removal via removed_at
    (never a physical delete) mirrors EntityResolutionEvent.reversed_at —
    the history of who was on a case and when is kept, not lost. A
    partial unique index (migration 3f7a2c9e5b1d) enforces at most one
    ACTIVE row per (case_id, officer_id) pair; re-adding a removed
    officer inserts a new row rather than reviving the old one, so each
    add/remove is its own auditable event."""

    __tablename__ = "case_team_members"

    id = uuid_pk_column()
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    officer_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=False)
    added_by_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=False)
    removed_at = Column(DateTime(timezone=True), nullable=True)


class CasePin(Base, TimestampMixin):
    """Per-officer case pin (Case Workspace's pin control — previously a
    bare icon with no backing state at all). Personal organization, not a
    collaborative record: hard-deleted on unpin, no removed_at history."""

    __tablename__ = "case_pins"

    id = uuid_pk_column()
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    officer_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=False)


class AuditLogEntry(Base, TimestampMixin):
    """Append-only log: every search, filter, view, export, note action, approval (brief section 9).

    actor_role/actor_district_id are a SNAPSHOT of the actor's role and
    home district at write time, stamped onto the row itself rather than
    resolved later via a join to the (possibly since-changed) officers
    table — a role change or reassignment after the fact must never
    silently rewrite what an old entry says the actor's role/jurisdiction
    was when they took the action (brief section 9's "role and
    jurisdiction at action time"). Null for system-generated entries with
    no actor (e.g. a failed pre-auth login) and, unavoidably, for rows
    written before this column existed — that history cannot be
    reconstructed.
    """

    __tablename__ = "audit_log_entries"

    id = uuid_pk_column()
    actor_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=True)
    actor_role = Column(Enum(Role, name="officer_role"), nullable=True)
    actor_district_id = Column(UUID(as_uuid=True), ForeignKey("districts.id"), nullable=True)
    action = Column(String, nullable=False)  # e.g. "login", "export", "view_entity"
    module = Column(String, nullable=True)  # UI/API module the action occurred in, e.g. "auth", "cases"
    success = Column(Boolean, nullable=False, default=True)
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    device_identity = Column(String, nullable=True)
    detail = Column(Text, nullable=True)

    actor = relationship("Officer", foreign_keys=[actor_id])
    actor_district = relationship("District", foreign_keys=[actor_district_id])
