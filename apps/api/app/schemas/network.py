from typing import Literal

from pydantic import BaseModel

from app.schemas.common import ClassificationLevel, Confidence, RedactedField

EntityType = Literal["person", "organization", "vehicle", "device", "address"]


class EntitySummary(BaseModel):
    """Unified search-result / list shape. `type` discriminates the backing
    table; every entity-shaped response carries classification."""

    id: str
    type: EntityType
    label: str  # display name: full_name | name | registration_number | phone_number | raw_text
    classification: ClassificationLevel


class EntityDetail(EntitySummary):
    """Entity detail: EntitySummary plus all type-specific fields.

    DELIBERATE SIMPLIFICATION (confirmed): a flat nullable-fields-per-type
    shape rather than a discriminated union. OpenAPI/frontend consumers must
    check `type` before trusting which fields are populated. Revisit if the
    frontend needs stronger typing later.

    Redactable fields (entity redaction component, Phase 7 follow-up):
    label, aliases, date_of_birth, org_type, registration_number, make,
    model, color, phone_number, imei, device_type, raw_text are
    `T | RedactedField | None` — a RedactedField replaces the WHOLE value
    (whole-field masking; per-item aliases masking is deferred). id, type,
    classification, district_id and is_protected_subject never redact
    (is_protected_subject is tier-gated independently)."""

    # shared redactable field — EntitySummary.label stays `str`: search/list
    # outputs are out of scope for this component (detail-only redaction)
    label: str | RedactedField

    # person
    aliases: list[str] | RedactedField | None = None
    date_of_birth: str | RedactedField | None = None
    # Gated at PROTECTED tier (policy, mirrors ROLE_MAX_CLASSIFICATION):
    # below it this field is ALWAYS RedactedField(reason="no_access")
    # regardless of the stored value, so no protection signal leaks; at
    # PROTECTED+ the raw 0/1 is returned.
    is_protected_subject: RedactedField | int | None = None
    # organization
    org_type: str | RedactedField | None = None
    # vehicle
    registration_number: str | RedactedField | None = None
    make: str | RedactedField | None = None
    model: str | RedactedField | None = None
    color: str | RedactedField | None = None
    # device
    phone_number: str | RedactedField | None = None
    imei: str | RedactedField | None = None
    device_type: str | RedactedField | None = None
    # address — the only entity type with a district_id (jurisdiction path)
    raw_text: str | RedactedField | None = None
    district_id: str | None = None


class RelationshipOut(BaseModel):
    """Relationship read shape. Confidence + classification come ONLY from the
    Postgres RelationshipEdgeRef mirror row — Neo4j never supplies visibility
    metadata (decision 000). id = neo4j_relationship_id."""

    id: str
    type: str  # Neo4j relationship type, e.g. "MEMBER_OF"
    source_entity: EntitySummary
    target_entity: EntitySummary
    confidence: Confidence
    classification: ClassificationLevel
    verification_status: str
    effective_from: str | None = None
    effective_to: str | None = None
    case_id: str | None = None
