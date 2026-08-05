"""Case workspace service: list, create, get (Phase 5 component 2).

Jurisdiction + tier gating reuse the Phase 3/4 machinery
(classification_filter, get_accessible_district_ids) — no reinvention.
Case.status vocabulary: {open, under_investigation, pending_review,
closed} (widened from the Phase 5 {open, closed} pair — 006 §6 #11 /
999 §2.4: no wider vocabulary was ever specified, so this is a
deliberate design choice, not a documented requirement). update_case_status
is the first status-mutation path — status was create-only before this;
any VALID_STATUSES value is reachable from any other (no transition
graph is enforced, since none is documented).

Note: cases with district_id IS NULL are invisible to jurisdiction-scoped
officers (there is nothing to scope against) — same semantics as entity
search; create_case requires district_id, so the API never produces
district-less cases.
"""

import json
import re
import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.classification import ROLE_MAX_CLASSIFICATION, classification_filter
from app.models.base import CLASSIFICATION_RANK
from app.models.base import ClassificationLevel as ModelClassificationLevel
from app.models.entities import Case, District, Note, Officer, Role
from app.models.governance import AuditLogEntry, CaseTeamMember
from app.schemas.common import ClassificationLevel
from app.schemas.cases import (
    CaseCreate,
    CaseDetail,
    CaseSummary,
    CaseTeamMemberOut,
    ExportOfficer,
    ExportResponse,
    NoteCreate,
    NoteSummary,
)
from app.services.district_service import get_accessible_district_ids
from app.services.access_exception_service import exempt_case_ids

CASE_NUMBER_RE = re.compile(r"^[A-Z0-9-]{3,32}$")


class InvalidCaseNumberError(Exception):
    """Format violation after normalization (422 at the router)."""


class InvalidCaseStatusError(Exception):
    """Status outside Case.VALID_STATUSES (422 at the router)."""


class CaseNumberTakenError(Exception):
    """case_number already exists (409 at the router)."""


class DistrictNotFoundError(Exception):
    """district_id does not reference a real district (422 at the router)."""


class DistrictNotInJurisdictionError(Exception):
    """district_id outside the creator's accessible districts (422 at the router)."""


class ClassificationExceedsClearanceError(Exception):
    """Creator cannot file a case above their own max tier (422 at the router)."""


class InvalidVisibilityError(Exception):
    """Note visibility outside the four-tier vocabulary (422 at the router)."""


class InvalidFindingStateError(Exception):
    """Note finding_state outside {hypothesis, confirmed, disputed} (422 at the router)."""


class OfficerNotFoundError(Exception):
    """officer_id does not reference a real officer (422 at the router)."""


class AlreadyTeamMemberError(Exception):
    """Officer already has an active case_team_members row, or IS the case's
    lead_officer_id (who is always implicitly on the team — see
    list_team_members) (409 at the router)."""


class TeamMemberNotFoundError(Exception):
    """No active case_team_members row for this (case, officer) pair — there
    is nothing to remove (404 at the router)."""


class CannotRemoveLeadOfficerError(Exception):
    """The lead officer isn't a case_team_members row and can't be removed
    through this endpoint — reassigning the lead is a separate, unbuilt
    operation (422 at the router)."""


def _visible_case_stmt(
    visible_tiers: list[ClassificationLevel],
    accessible: list[UUID] | None,
    exempt_case_ids: set[UUID] | None = None,
):
    """The case-visibility funnel shared by list/get/notes/export/note-create
    (Phase 6 component 4, decision 002's reserved "second filter layer",
    sanctioned narrow lift): when the officer is jurisdiction-filtered, an
    approved-unexpired access exception ORs the exempt case ids into the
    district scope. Tier filtering is untouched — an exception never
    crosses the classification gate. Unrestricted roles have no district
    filter, so the exemption is moot for them."""
    stmt = select(Case).where(Case.classification.in_(visible_tiers))
    if accessible is not None:
        scope = Case.district_id.in_(accessible)
        if exempt_case_ids:
            scope = or_(scope, Case.id.in_(exempt_case_ids))
        stmt = stmt.where(scope)
    return stmt


def _to_summary(case: Case) -> CaseSummary:
    return CaseSummary(
        id=str(case.id),
        case_number=case.case_number,
        title=case.title,
        status=case.status,
        classification=ClassificationLevel(case.classification.value),
        district_id=str(case.district_id) if case.district_id else None,
        created_at=str(case.created_at) if case.created_at else None,
    )


def _to_detail(case: Case) -> CaseDetail:
    return CaseDetail(
        **_to_summary(case).model_dump(),
        summary=case.summary,
        lead_officer_id=str(case.lead_officer_id) if case.lead_officer_id else None,
    )


def list_cases(
    db: Session,
    officer: Officer,
    page: int,
    page_size: int,
    status: str | None = None,
) -> tuple[list[CaseSummary], int]:
    """Jurisdiction- and tier-scoped case list, newest first. The router
    validates status against Case.VALID_STATUSES before calling."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    stmt = _visible_case_stmt(
        visible_tiers,
        accessible,
        exempt_case_ids=exempt_case_ids(db, officer),
    )
    if status is not None:
        stmt = stmt.where(Case.status == status)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0
    # .scalars().all() (not .all()): ORM-select Rows expose the entity under
    # its class key; scalars() unwraps to the Case objects.
    rows = db.execute(
        stmt.order_by(Case.created_at.desc(), Case.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return [_to_summary(c) for c in rows], total


def get_case(
    db: Session,
    officer: Officer,
    case_id: UUID,
) -> CaseDetail | None:
    """Record-level gate, same pattern as Phase 4 component 5: tier +
    jurisdiction in one query; a miss is 404 at the router. An above-tier
    or out-of-jurisdiction case is indistinguishable from a nonexistent
    one (fail-closed, existence never leaked)."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    case = db.execute(
        _visible_case_stmt(
            visible_tiers,
            accessible,
            exempt_case_ids=exempt_case_ids(db, officer),
        ).where(Case.id == case_id)
    ).scalar_one_or_none()
    return _to_detail(case) if case is not None else None


def create_case(
    db: Session,
    officer: Officer,
    payload: CaseCreate,
) -> CaseDetail:
    """Case creation policies (all confirmed before implementation):
    - case_number: caller-supplied (the column is unique, required, free
      String), normalized to uppercase, format-checked, unique -> 409
    - status: vocabulary {open, closed}, default open -> 422 otherwise
    - district_id: required; must exist (422) and lie within the creator's
      accessible districts (422)
    - classification: default RESTRICTED_OPERATIONAL; ceiling = the
      creator's own ROLE_MAX_CLASSIFICATION (422) — a creator must never
      file a case they themselves cannot see
    - lead_officer_id defaults to the creating officer (no override this
      phase — no officer-picker surface exists)
    """
    case_number = payload.case_number.strip().upper()
    if not CASE_NUMBER_RE.match(case_number):
        raise InvalidCaseNumberError(case_number)
    if payload.status not in Case.VALID_STATUSES:
        raise InvalidCaseStatusError(payload.status)

    existing = db.execute(
        select(Case.id).where(Case.case_number == case_number)
    ).scalar_one_or_none()
    if existing is not None:
        raise CaseNumberTakenError(case_number)

    accessible = get_accessible_district_ids(officer)
    district = db.execute(
        select(District).where(District.id == payload.district_id)
    ).scalar_one_or_none()
    if district is None:
        raise DistrictNotFoundError(str(payload.district_id))
    if accessible is not None and district.id not in accessible:
        raise DistrictNotInJurisdictionError(str(district.id))

    max_tier = ROLE_MAX_CLASSIFICATION[officer.role]
    if (
        CLASSIFICATION_RANK[ModelClassificationLevel(payload.classification.value)]
        > CLASSIFICATION_RANK[max_tier]
    ):
        raise ClassificationExceedsClearanceError(payload.classification.value)

    case = Case(
        case_number=case_number,
        title=payload.title.strip(),
        summary=payload.summary,
        status=payload.status,
        district_id=district.id,
        lead_officer_id=officer.id,
        classification=ModelClassificationLevel(payload.classification.value),
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return _to_detail(case)


def update_case_status(
    db: Session,
    officer: Officer,
    case_id: UUID,
    new_status: str,
    ip_address: str | None = None,
) -> CaseDetail | None:
    """Change a case's status (the first status-mutation path — status was
    create-only before this). Same visibility gate as get_case: None means
    invisible/nonexistent (router 404), fail-closed like every other
    record-level lookup in this file. new_status must be in
    Case.VALID_STATUSES (422) — no transition graph is enforced (any status
    may move to any other), since none is documented (006 §6 #11).

    A no-op (new_status == current status) is accepted but not written or
    audited — nothing changed, so nothing to log."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    case = db.execute(
        _visible_case_stmt(
            visible_tiers,
            accessible,
            exempt_case_ids=exempt_case_ids(db, officer),
        ).where(Case.id == case_id)
    ).scalar_one_or_none()
    if case is None:
        return None
    if new_status not in Case.VALID_STATUSES:
        raise InvalidCaseStatusError(new_status)

    if new_status != case.status:
        previous_status = case.status
        case.status = new_status
        _write_audit_log(
            db,
            actor_id=officer.id,
            action="case_status_changed",
            resource_type="case",
            resource_id=str(case.id),
            ip_address=ip_address,
            detail=json.dumps(
                {
                    "case_number": case.case_number,
                    "previous_status": previous_status,
                    "new_status": new_status,
                }
            ),
        )
        db.commit()
        db.refresh(case)
    return _to_detail(case)


def _to_team_member_out(officer: Officer, is_lead: bool, added_at) -> CaseTeamMemberOut:
    return CaseTeamMemberOut(
        officer_id=str(officer.id),
        official_id=officer.official_id,
        full_name=officer.full_name,
        role=officer.role.value,
        unit=officer.unit,
        is_lead=is_lead,
        added_at=str(added_at) if added_at else None,
    )


def list_team_members(
    db: Session, officer: Officer, case_id: UUID
) -> list[CaseTeamMemberOut] | None:
    """Everyone with case_team note-tier access (006 §4 / 999 §2.2): the
    lead officer (always implicitly on the team — synthetic entry,
    is_lead=True, added_at=None, never a case_team_members row of its own)
    plus every actively-added officer. None -> case invisible (router 404)."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    case = db.execute(
        _visible_case_stmt(
            visible_tiers,
            accessible,
            exempt_case_ids=exempt_case_ids(db, officer),
        ).where(Case.id == case_id)
    ).scalar_one_or_none()
    if case is None:
        return None

    rows = db.execute(
        select(CaseTeamMember, Officer)
        .join(Officer, Officer.id == CaseTeamMember.officer_id)
        .where(CaseTeamMember.case_id == case_id, CaseTeamMember.removed_at.is_(None))
    ).all()
    member_officer_ids = {o.id for _, o in rows}
    members = [
        _to_team_member_out(o, is_lead=(o.id == case.lead_officer_id), added_at=m.created_at)
        for m, o in rows
    ]
    if case.lead_officer_id is not None and case.lead_officer_id not in member_officer_ids:
        lead = db.get(Officer, case.lead_officer_id)
        if lead is not None:
            members.insert(0, _to_team_member_out(lead, is_lead=True, added_at=None))
    return members


def add_team_member(
    db: Session,
    officer: Officer,
    case_id: UUID,
    member_officer_id: UUID,
    ip_address: str | None = None,
) -> CaseTeamMemberOut | None:
    """Add an officer to a case's team (case:write). None -> case invisible
    (router 404). The lead officer is always implicitly on the team (see
    list_team_members) and can't be separately added (409
    already_team_member) — reassigning the lead is a different, unbuilt
    operation. Re-adding a previously-removed officer inserts a fresh row
    (a new auditable event), never revives the old one."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    case = db.execute(
        _visible_case_stmt(
            visible_tiers,
            accessible,
            exempt_case_ids=exempt_case_ids(db, officer),
        ).where(Case.id == case_id)
    ).scalar_one_or_none()
    if case is None:
        return None

    member = db.get(Officer, member_officer_id)
    if member is None:
        raise OfficerNotFoundError(str(member_officer_id))
    if member_officer_id == case.lead_officer_id:
        raise AlreadyTeamMemberError(str(member_officer_id))

    existing = db.execute(
        select(CaseTeamMember).where(
            CaseTeamMember.case_id == case_id,
            CaseTeamMember.officer_id == member_officer_id,
            CaseTeamMember.removed_at.is_(None),
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise AlreadyTeamMemberError(str(member_officer_id))

    row = CaseTeamMember(case_id=case_id, officer_id=member_officer_id, added_by_id=officer.id)
    db.add(row)
    _write_audit_log(
        db,
        actor_id=officer.id,
        action="case_team_member_added",
        resource_type="case",
        resource_id=str(case_id),
        ip_address=ip_address,
        detail=json.dumps(
            {"case_number": case.case_number, "officer_id": str(member_officer_id)}
        ),
    )
    db.commit()
    db.refresh(row)
    return _to_team_member_out(member, is_lead=False, added_at=row.created_at)


def remove_team_member(
    db: Session,
    officer: Officer,
    case_id: UUID,
    member_officer_id: UUID,
    ip_address: str | None = None,
) -> CaseTeamMemberOut | None:
    """Soft-remove an officer from a case's team (case:write). None -> case
    invisible (router 404). Removing the lead officer isn't supported here
    (CannotRemoveLeadOfficerError, 422) — reassigning the lead is a
    separate, unbuilt operation."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    case = db.execute(
        _visible_case_stmt(
            visible_tiers,
            accessible,
            exempt_case_ids=exempt_case_ids(db, officer),
        ).where(Case.id == case_id)
    ).scalar_one_or_none()
    if case is None:
        return None

    if member_officer_id == case.lead_officer_id:
        raise CannotRemoveLeadOfficerError(str(member_officer_id))

    row = db.execute(
        select(CaseTeamMember).where(
            CaseTeamMember.case_id == case_id,
            CaseTeamMember.officer_id == member_officer_id,
            CaseTeamMember.removed_at.is_(None),
        )
    ).scalar_one_or_none()
    if row is None:
        raise TeamMemberNotFoundError(str(member_officer_id))

    member = db.get(Officer, member_officer_id)
    row.removed_at = datetime.now(timezone.utc)
    _write_audit_log(
        db,
        actor_id=officer.id,
        action="case_team_member_removed",
        resource_type="case",
        resource_id=str(case_id),
        ip_address=ip_address,
        detail=json.dumps(
            {"case_number": case.case_number, "officer_id": str(member_officer_id)}
        ),
    )
    db.commit()
    db.refresh(row)
    return _to_team_member_out(member, is_lead=False, added_at=row.created_at)


def _active_team_officer_ids(db: Session, case_id: UUID) -> set[UUID]:
    """Officer ids with a currently-active (not soft-removed) case_team_members
    row for this case (006 §4 / 999 §2.2: real membership, replacing the old
    lead-or-author-only check). Does NOT include lead_officer_id — the lead
    is always implicitly on the team regardless of this table; callers OR
    it in separately (see _note_visible, list_team_members)."""
    rows = db.execute(
        select(CaseTeamMember.officer_id).where(
            CaseTeamMember.case_id == case_id,
            CaseTeamMember.removed_at.is_(None),
        )
    ).scalars().all()
    return set(rows)


def _note_visible(
    note: Note, case: Case, officer: Officer, team_officer_ids: set[UUID]
) -> bool:
    """Visibility-tier enforcement (Phase 5 component 3; case_team widened
    to real membership per 006 §4 / 999 §2.2). Callers must already have
    passed the case-visible gate and the note tier gate; this evaluates the
    visibility column only.

    private_author      -> the note's own author
    case_team           -> case lead officer OR note author OR an active
                           case_team_members row (team_officer_ids, computed
                           once per case by the caller — see _visible_notes)
    supervisory_chain   -> SUPERVISOR/ADMINISTRATOR role (no officer
                           hierarchy exists; weaker than a true chain)
    inter_unit_approved -> anyone who passed the gates (widest tier; the
                           AccessExceptionRequest workflow is stubbed and
                           links to cases, not notes)
    unknown value       -> fail-closed invisible
    """
    if note.visibility == Note.VISIBILITY_PRIVATE:
        return note.author_id == officer.id
    if note.visibility == Note.VISIBILITY_CASE_TEAM:
        return (
            case.lead_officer_id == officer.id
            or note.author_id == officer.id
            or officer.id in team_officer_ids
        )
    if note.visibility == Note.VISIBILITY_SUPERVISORY_CHAIN:
        return officer.role in (Role.SUPERVISOR, Role.ADMINISTRATOR)
    if note.visibility == Note.VISIBILITY_INTER_UNIT:
        return True
    return False


def _to_note_summary(note: Note) -> NoteSummary:
    return NoteSummary(
        id=str(note.id),
        case_id=str(note.case_id),
        author_id=str(note.author_id),
        body=note.body,
        visibility=note.visibility,
        finding_state=note.finding_state,
        classification=ClassificationLevel(note.classification.value),
        created_at=str(note.created_at) if note.created_at else None,
    )


def _visible_notes(db: Session, case: Case, officer: Officer, case_id: UUID) -> list[Note]:
    """All notes of a visible case that survive the tier gate
    (classification within the viewer's tiers) AND the visibility tier.
    Newest first. Shared by list_notes (which paginates the result) and
    export_case (which embeds the whole set in the document)."""
    visible_tiers = classification_filter(officer.role)
    rows = db.execute(
        select(Note).where(
            Note.case_id == case_id,
            Note.classification.in_(visible_tiers),
        )
    ).scalars().all()
    team_officer_ids = _active_team_officer_ids(db, case_id)
    return sorted(
        (n for n in rows if _note_visible(n, case, officer, team_officer_ids)),
        key=lambda n: (n.created_at.isoformat() if n.created_at else "", str(n.id)),
        reverse=True,
    )


def list_notes(
    db: Session,
    officer: Officer,
    case_id: UUID,
    page: int,
    page_size: int,
) -> tuple[list[NoteSummary], int] | None:
    """Notes of one case, visibility-filtered. Returns None when the case
    itself is invisible (router 404). A visible case with zero visible
    notes returns ([], 0) — same distinction as entity relationships:
    404 = the case is not accessible, empty = it is but nothing survives.

    Pagination is applied AFTER the visibility filter (in memory): paging
    in SQL first could strand visible notes on later pages behind a page
    full of invisible ones. Case-scoped note sets are small."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    case = db.execute(
        _visible_case_stmt(
            visible_tiers,
            accessible,
            exempt_case_ids=exempt_case_ids(db, officer),
        ).where(Case.id == case_id)
    ).scalar_one_or_none()
    if case is None:
        return None

    visible = _visible_notes(db, case, officer, case_id)
    total = len(visible)
    start = (page - 1) * page_size
    return [_to_note_summary(n) for n in visible[start : start + page_size]], total


def _write_audit_log(
    db: Session,
    actor_id,
    action: str,
    resource_type: str | None,
    resource_id: str | None,
    ip_address: str | None,
    detail: str | None,
) -> None:
    """Same AuditLogEntry shape auth_service uses (actor/action/resource/
    ip/detail, added to the transaction): every export is a distinct
    audited event. Only successful exports are logged — permission and
    visibility rejections never reach this service, and nothing in the
    platform audits failures today."""
    db.add(
        AuditLogEntry(
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            detail=detail,
        )
    )


def export_case(
    db: Session,
    officer: Officer,
    case_id: UUID,
    ip_address: str | None = None,
) -> ExportResponse | None:
    """Export a case workspace (brief 7.11): the document is the case
    plus every note that survives the same case gate + tier gate +
    visibility tier the live GET endpoints enforce — composition of the
    already-verified get_case / _visible_notes machinery, no new gating
    code. That record-level exclusion IS the policy redaction; per-field
    redaction belongs to the Phase 6 RedactionPolicyDecision engine.

    classification = highest tier of the included content, the case
    included (NOT notes-only, NOT case-only): a PROTECTED note on a
    RESTRICTED case labels the document protected, and a PROTECTED case
    with only RESTRICTED notes still labels it protected. An export with
    zero visible notes still labels the case's own tier.

    None -> case invisible to this officer (router 404). Every successful
    export writes an AuditLogEntry (action=export) and gets its own
    export_id (also embedded in the audit detail)."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    case = db.execute(
        _visible_case_stmt(
            visible_tiers,
            accessible,
            exempt_case_ids=exempt_case_ids(db, officer),
        ).where(Case.id == case_id)
    ).scalar_one_or_none()
    if case is None:
        return None

    notes = _visible_notes(db, case, officer, case_id)
    note_summaries = [_to_note_summary(n) for n in notes]

    highest = max(
        [case.classification] + [n.classification for n in notes],
        key=lambda t: CLASSIFICATION_RANK[t],
    )

    export_id = str(uuid.uuid4())
    _write_audit_log(
        db=db,
        actor_id=officer.id,
        action="export",
        resource_type="case",
        resource_id=str(case.id),
        ip_address=ip_address,
        detail=json.dumps(
            {
                "export_id": export_id,
                "case_number": case.case_number,
                "notes": len(note_summaries),
                "classification": highest.value,
            },
            separators=(",", ":"),
        ),
    )
    db.commit()

    return ExportResponse(
        export_id=export_id,
        initiated_at=datetime.now(timezone.utc).isoformat(),
        initiated_by=ExportOfficer(
            official_id=officer.official_id,
            full_name=officer.full_name,
            role=officer.role.value,
        ),
        classification=ClassificationLevel(highest.value),
        case=_to_detail(case),
        notes=note_summaries,
    )


def create_note(
    db: Session,
    officer: Officer,
    case_id: UUID,
    payload: NoteCreate,
) -> NoteSummary | None:
    """Create a note on a visible case. None -> case invisible (router 404).

    - visibility: four-tier vocabulary validated (422); widening is allowed
      for any note:create holder — the case gate precedes every read, so a
      wider marker cannot leak; an approval gate on inter_unit_approved
      belongs with the AccessExceptionRequest build-out (open question).
    - finding_state: {hypothesis, confirmed, disputed} (422).
    - classification: ceiling = creator's tier, same rule as create_case.
    - author_id is the creating officer; no spoofing.
    """
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    case = db.execute(
        _visible_case_stmt(
            visible_tiers,
            accessible,
            exempt_case_ids=exempt_case_ids(db, officer),
        ).where(Case.id == case_id)
    ).scalar_one_or_none()
    if case is None:
        return None
    if payload.visibility not in Note.VALID_VISIBILITIES:
        raise InvalidVisibilityError(payload.visibility)
    if payload.finding_state is not None and payload.finding_state not in Note.FINDING_STATES:
        raise InvalidFindingStateError(payload.finding_state)

    max_tier = ROLE_MAX_CLASSIFICATION[officer.role]
    if (
        CLASSIFICATION_RANK[ModelClassificationLevel(payload.classification.value)]
        > CLASSIFICATION_RANK[max_tier]
    ):
        raise ClassificationExceedsClearanceError(payload.classification.value)

    note = Note(
        case_id=case.id,
        author_id=officer.id,
        body=payload.body.strip(),
        visibility=payload.visibility,
        finding_state=payload.finding_state,
        classification=ModelClassificationLevel(payload.classification.value),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _to_note_summary(note)
