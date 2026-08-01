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

from app.schemas.common import ClassificationLevel


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

    summary: str | None
    lead_officer_id: str | None


class NoteCreate(BaseModel):
    body: str
    visibility: str = "case_team"
    finding_state: str | None = None
    classification: ClassificationLevel = ClassificationLevel.RESTRICTED_OPERATIONAL


class NoteSummary(BaseModel):
    """Every note response carries classification (constraint)."""

    id: str
    case_id: str
    author_id: str
    body: str
    visibility: str
    finding_state: str | None
    classification: ClassificationLevel
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
