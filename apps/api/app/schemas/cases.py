"""Case workspace request/response shapes (Phase 5).

Every case response carries classification, consistent with every other
entity in the codebase. case_number is caller-supplied (the column is
unique, required, free-form String — agencies assign their own numbers);
the service normalizes it to uppercase before the uniqueness check.
district_id is required at the API layer even though the column is
nullable: a case without a district is invisible to every scoped officer.
"""

from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import ClassificationLevel, RedactedField


class CaseCreate(BaseModel):
    case_number: str
    title: str
    summary: str | None = None
    district_id: UUID
    status: str = "open"
    classification: ClassificationLevel = ClassificationLevel.RESTRICTED_OPERATIONAL


class CaseSummary(BaseModel):
    """List shape."""

    id: str
    case_number: str
    title: str
    status: str
    classification: ClassificationLevel
    district_id: str | None
    created_at: str | None


class CaseDetail(CaseSummary):
    """Detail shape: summary fields plus the case body."""

    summary: RedactedField | str | None
    lead_officer_id: str | None


class CaseStatusUpdate(BaseModel):
    """Body for PATCH /cases/{id}/status. Any Case.VALID_STATUSES value is
    a valid target from any current status — this vocabulary has no
    documented workflow ordering (006 §6 #11), so no transition graph is
    enforced beyond "must be a real status"."""

    status: str


class TeamMemberAdd(BaseModel):
    officer_id: UUID


class CaseTeamMemberOut(BaseModel):
    """One row of GET /cases/{id}/team. is_lead=True is the case's
    lead_officer_id (always implicitly on the team, never a row in
    case_team_members — see case_service.list_team_members); added_at is
    None for that synthetic entry since it was never "added"."""

    officer_id: str
    official_id: str
    full_name: str
    role: str
    unit: str | None
    is_lead: bool
    added_at: str | None


class NoteCreate(BaseModel):
    body: str
    visibility: str = "case_team"
    finding_state: str | None = None
    classification: ClassificationLevel = ClassificationLevel.RESTRICTED_OPERATIONAL


class NoteSummary(BaseModel):
    """Every note response carries classification (constraint).

    body is `RedactedField | str`: the per-field redaction engine
    (Phase 6 component 3) masks the payload of otherwise-visible notes
    in the EXPORT pipeline only — rules produce reason="policy", ad-hoc
    per-export masking produces reason="manual". The read path never
    emits these; redaction hides content inside a record that already
    passed the tier gate, it does not drop the record."""

    id: str
    case_id: str
    author_id: str
    body: RedactedField | str
    visibility: str
    finding_state: str | None
    classification: ClassificationLevel
    created_at: str | None


class ExportRequest(BaseModel):
    """Optional body for POST /cases/{id}/export. Policy rules apply to
    every export regardless of this payload; redact_note_ids masks the
    listed notes in THIS export only (brief 7.10 supervisor user story
    "redaction where needed" — ad-hoc, non-persisted; the export_redaction
    audit entry records it). Note ids outside the export's visible notes
    are silently ignored (nothing to mask)."""

    redact_note_ids: list[UUID] | None = None


class RedactionPolicyCreate(BaseModel):
    """Admin-defined export redaction rule (brief 7.10 "export policy and
    redaction rules"; answers the PRD open question "which fields require
    mandatory redaction in shared exports?" as per-deployment config).

    Fires when the target record's classification tier is at or above
    min_classification. entity_type/field vocabulary is validated against
    RedactionPolicyDecision.REDACTION_ENTITY_TYPES / REDACTION_FIELDS."""

    entity_type: str
    field: str
    min_classification: ClassificationLevel
    reason: str


class RedactionPolicyResponse(BaseModel):
    id: str
    entity_type: str
    field: str
    min_classification: ClassificationLevel
    decision: str
    reason: str
    active: bool
    created_by_id: str
    created_at: str | None


class ExportOfficer(BaseModel):
    """Initiator block of an export document (brief 7.11: initiator/time
    recorded with the export)."""

    official_id: str
    full_name: str
    role: str


class ExportResponse(BaseModel):
    """Real export artifact: the case plus the notes visible to the
    exporting officer — exactly the content that officer would see in the
    workspace (that record-level exclusion IS the platform's redaction;
    the per-field engine is Phase 6). classification is the highest tier
    of the included content, case included: a PROTECTED note on a
    RESTRICTED case labels the document protected, and a PROTECTED case
    with only RESTRICTED notes still labels the document protected."""

    export_id: str
    initiated_at: str
    initiated_by: ExportOfficer
    classification: ClassificationLevel
    case: CaseDetail
    notes: list[NoteSummary]
