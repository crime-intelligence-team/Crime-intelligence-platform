import enum

from geoalchemy2 import Geometry
from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import (
    ClassificationMixin,
    ProvenanceMixin,
    TimestampMixin,
    uuid_pk_column,
)


class Role(str, enum.Enum):
    DISTRICT_OFFICER = "district_officer"
    DETECTIVE = "detective"
    ANALYST = "analyst"
    SUPERVISOR = "supervisor"
    ADMINISTRATOR = "administrator"


class Officer(Base, TimestampMixin):
    """Officer/Unit — also doubles as the authenticatable user for V1."""

    __tablename__ = "officers"

    id = uuid_pk_column()
    official_id = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(Role, name="officer_role"), nullable=False)
    unit = Column(String, nullable=True)
    home_district_id = Column(UUID(as_uuid=True), ForeignKey("districts.id"), nullable=True)
    mfa_enabled = Column(Integer, default=1)  # 1/0 instead of bool for simple SQLite/PG parity
    totp_secret = Column(String, nullable=True)  # base32 RFC 4648, set at enrollment (TOTP component)
    totp_enrolled_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Integer, default=1)
    last_login_at = Column(DateTime(timezone=True), nullable=True)


class District(Base, ClassificationMixin, TimestampMixin):
    __tablename__ = "districts"

    id = uuid_pk_column()
    name = Column(String, nullable=False, unique=True)
    code = Column(String, nullable=False, unique=True)
    geometry = Column(Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=True)
    population = Column(Integer, nullable=True)


class Zone(Base, ClassificationMixin, TimestampMixin):
    """Sub-district zone used for risk scoring."""

    __tablename__ = "zones"

    id = uuid_pk_column()
    district_id = Column(UUID(as_uuid=True), ForeignKey("districts.id"), nullable=False)
    name = Column(String, nullable=False)
    geometry = Column(Geometry(geometry_type="POLYGON", srid=4326), nullable=True)

    risk_scores = relationship("ZoneRiskScore", back_populates="zone")


class ZoneRiskScore(Base, TimestampMixin):
    """One scoring run's output for a zone. Never framed as a final decision (brief 7.4)."""

    __tablename__ = "zone_risk_scores"

    id = uuid_pk_column()
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=False)
    score = Column(Integer, nullable=False)  # 0-100
    confidence_band = Column(String, nullable=False)
    top_factors = Column(Text, nullable=True)  # JSON-encoded list of contributing inputs
    run_timestamp = Column(DateTime(timezone=True), nullable=False)
    recommended_interpretation = Column(String, nullable=False)  # low | elevated | priority_watch
    analyst_review_status = Column(String, nullable=True)

    zone = relationship("Zone", back_populates="risk_scores")


class Address(Base, ClassificationMixin, ProvenanceMixin, TimestampMixin):
    __tablename__ = "addresses"

    id = uuid_pk_column()
    raw_text = Column(String, nullable=False)
    geocoded_point = Column(Geometry(geometry_type="POINT", srid=4326), nullable=True)
    district_id = Column(UUID(as_uuid=True), ForeignKey("districts.id"), nullable=True)


class Person(Base, ClassificationMixin, ProvenanceMixin, TimestampMixin):
    """Person / Criminal entity."""

    __tablename__ = "persons"

    id = uuid_pk_column()
    full_name = Column(String, nullable=False)
    aliases = Column(Text, nullable=True)  # JSON-encoded list
    date_of_birth = Column(Date, nullable=True)
    is_protected_subject = Column(Integer, default=0)  # record-level protection flag
    merged_into_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=True)  # set when absorbed by a merge (011); NULL = independent


class Organization(Base, ClassificationMixin, ProvenanceMixin, TimestampMixin):
    """Gang / Organization entity."""

    __tablename__ = "organizations"

    id = uuid_pk_column()
    name = Column(String, nullable=False)
    org_type = Column(String, nullable=True)  # e.g. "gang", "syndicate"


class Vehicle(Base, ClassificationMixin, ProvenanceMixin, TimestampMixin):
    __tablename__ = "vehicles"

    id = uuid_pk_column()
    registration_number = Column(String, nullable=True, index=True)
    make = Column(String, nullable=True)
    model = Column(String, nullable=True)
    color = Column(String, nullable=True)


class Device(Base, ClassificationMixin, ProvenanceMixin, TimestampMixin):
    """Phone / Device entity."""

    __tablename__ = "devices"

    id = uuid_pk_column()
    phone_number = Column(String, nullable=True, index=True)
    imei = Column(String, nullable=True)
    device_type = Column(String, nullable=True)


class Case(Base, ClassificationMixin, ProvenanceMixin, TimestampMixin):
    """Incident / Case entity."""

    __tablename__ = "cases"

    # Phase 5 introduced {open, closed} — "open" was the only state the
    # brief named. Widened here (006 §6 #11 / 999 §2.4) to the granularity
    # a real case workspace needs between filing and closing. The column
    # stays a free String (no migration needed — see the model docstring
    # precedent this comment replaces); "active" for KPI/priority purposes
    # means != STATUS_CLOSED, not == STATUS_OPEN, so under_investigation
    # and pending_review still count as ongoing work everywhere that matters.
    STATUS_OPEN = "open"
    STATUS_UNDER_INVESTIGATION = "under_investigation"
    STATUS_PENDING_REVIEW = "pending_review"
    STATUS_CLOSED = "closed"
    VALID_STATUSES = frozenset(
        {STATUS_OPEN, STATUS_UNDER_INVESTIGATION, STATUS_PENDING_REVIEW, STATUS_CLOSED}
    )

    id = uuid_pk_column()
    case_number = Column(String, unique=True, nullable=False)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="open")
    district_id = Column(UUID(as_uuid=True), ForeignKey("districts.id"), nullable=True)
    lead_officer_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=True)


class Note(Base, ClassificationMixin, TimestampMixin):
    """Note / Annotation, scoped to a case, with tiered visibility (brief 7.7)."""

    __tablename__ = "notes"

    VISIBILITY_PRIVATE = "private_author"
    VISIBILITY_CASE_TEAM = "case_team"
    VISIBILITY_SUPERVISORY_CHAIN = "supervisory_chain"
    VISIBILITY_INTER_UNIT = "inter_unit_approved"
    VALID_VISIBILITIES = frozenset(
        {VISIBILITY_PRIVATE, VISIBILITY_CASE_TEAM, VISIBILITY_SUPERVISORY_CHAIN, VISIBILITY_INTER_UNIT}
    )
    FINDING_STATES = frozenset({"hypothesis", "confirmed", "disputed"})

    id = uuid_pk_column()
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("officers.id"), nullable=False)
    body = Column(Text, nullable=False)
    visibility = Column(String, nullable=False, default=VISIBILITY_CASE_TEAM)
    finding_state = Column(String, nullable=True)  # hypothesis | confirmed | disputed


class RelationshipEdgeRef(Base, ClassificationMixin, TimestampMixin):
    """
    Mirrored reference to a Neo4j relationship edge, per brief section 4:
    the edge lives primarily in Neo4j, this row is the Postgres-side pointer
    used for classification/confidence filtering in relational queries.
    """

    __tablename__ = "relationship_edge_refs"

    id = uuid_pk_column()
    neo4j_relationship_id = Column(String, nullable=False, unique=True)
    source_identifier = Column(String, nullable=False)
    confidence_score = Column(Integer, nullable=False)  # 0-100
    confidence_band = Column(String, nullable=False)
    verification_status = Column(String, nullable=False, default="unverified")
    effective_from = Column(DateTime(timezone=True), nullable=True)
    effective_to = Column(DateTime(timezone=True), nullable=True)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=True)


class Alert(Base, ClassificationMixin, TimestampMixin):
    """Intelligence-feed alert (brief 3, "Intelligence Feed — Alerts, new
    cross-district links, resurfacing offenders, and significant changes").

    Vocabulary verified against the brief in docs/decisions/007:
    - resurfaced_offender: brief-derived ("resurfacing offenders")
    - new_inter_district_link: brief-derived ("new cross-district links")
    - confidence_change: inferred from "significant changes" (not literal)
    - case_escalation: NOT brief-derived — deliberately dropped.

    district_id is the alert subject's district (jurisdiction gate);
    cross-district alerts carrying two districts are an open question
    (minimal-viable: primary subject's district). Alerts with NULL
    district are invisible to jurisdiction-scoped officers, consistent
    with the platform's scoping semantics. No read/unread status field:
    the brief never names one (006 §6 deferred surface).
    """

    __tablename__ = "alerts"

    ALERT_TYPE_RESURFACED_OFFENDER = "resurfaced_offender"
    ALERT_TYPE_NEW_INTER_DISTRICT_LINK = "new_inter_district_link"
    ALERT_TYPE_CONFIDENCE_CHANGE = "confidence_change"
    VALID_ALERT_TYPES = frozenset(
        {
            ALERT_TYPE_RESURFACED_OFFENDER,
            ALERT_TYPE_NEW_INTER_DISTRICT_LINK,
            ALERT_TYPE_CONFIDENCE_CHANGE,
        }
    )

    id = uuid_pk_column()
    type = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    entity_type = Column(String, nullable=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    district_id = Column(UUID(as_uuid=True), ForeignKey("districts.id"), nullable=True)
