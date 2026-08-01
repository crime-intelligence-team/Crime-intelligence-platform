import json
from uuid import UUID

from sqlalchemy import func, literal, or_, select
from sqlalchemy.orm import Session

from app.core.classification import ROLE_MAX_CLASSIFICATION, classification_filter
from app.graph.queries import RELATIONSHIPS_OF_ENTITY, RELATIONSHIP_DETAIL
from app.models.base import CLASSIFICATION_RANK
from app.models.base import ClassificationLevel as ModelClassificationLevel
from app.models.entities import (
    Address,
    Device,
    Officer,
    Organization,
    Person,
    RelationshipEdgeRef,
    Vehicle,
)
from app.schemas.common import ClassificationLevel, Confidence, ConfidenceBand, RedactedField
from app.schemas.network import EntityDetail, EntitySummary, RelationshipOut
from app.services.district_service import get_accessible_district_ids


class GraphUnavailableError(Exception):
    """Neo4j could not be reached or the query failed. The router converts
    this to 503 graph_unavailable — deliberately a distinct status, never
    conflated with 404 (empty result) or a generic 500."""

# Entity search: case-insensitive substring match on the name/identifier
# fields below. CAVEAT: these columns are unindexed, so every search is a
# sequential scan; if search performance becomes a problem, add a pg_trgm
# GIN index over the matched columns (future consideration, not blocking).
SEARCH_FIELDS: dict[str, list[object]] = {
    "person": [Person.full_name, Person.aliases],
    "organization": [Organization.name],
    "vehicle": [Vehicle.registration_number],
    "device": [Device.phone_number, Device.imei],
    "address": [Address.raw_text],
}

VALID_ENTITY_TYPES = frozenset(SEARCH_FIELDS.keys())


def _entity_union(
    q: str,
    visible_tiers: list[ClassificationLevel],
    accessible: list[UUID] | None,
    entity_types: list[str],
):
    like = f"%{q}%"
    branches = []
    for entity_type in entity_types:
        fields = SEARCH_FIELDS[entity_type]
        table = fields[0].table
        branch = select(
            table.columns.id.label("id"),
            literal(entity_type).label("type"),
            fields[0].label("label"),
            table.columns.classification.label("classification"),
        ).where(
            table.columns.classification.in_(visible_tiers),
            or_(*(field.ilike(like) for field in fields)),
        )
        if entity_type == "address" and accessible is not None:
            branch = branch.where(Address.district_id.in_(accessible))
        branches.append(branch)
    return branches[0].union_all(*branches[1:]) if len(branches) > 1 else branches[0]


def search_entities(
    db: Session,
    officer: Officer,
    q: str,
    entity_type: str | None,
    page: int,
    page_size: int,
) -> tuple[list[EntitySummary], int]:
    """Entity search across Person/Organization/Vehicle/Device/Address.
    Tier filter (visible_tiers) runs on every branch before matching.
    Jurisdiction: only Address carries district_id, so only address results
    are district-scoped; the other types have no district column at all.
    Match = case-insensitive substring (ILIKE) on name/identifier fields.
    Caller (router) must validate entity_type against VALID_ENTITY_TYPES —
    this function assumes validated input."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)

    entity_types = [entity_type] if entity_type is not None else list(SEARCH_FIELDS.keys())

    union = _entity_union(q, visible_tiers, accessible, entity_types)
    sub = union.subquery()
    total = db.execute(select(func.count()).select_from(sub)).scalar() or 0
    rows = db.execute(
        select(sub)
        .order_by(sub.c.label, sub.c.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [
        EntitySummary(
            id=str(row.id),
            type=row.type,  # type: ignore[arg-type]
            label=row.label,
            classification=ClassificationLevel(row.classification),
        )
        for row in rows
    ]
    return items, total


def get_entity(
    db: Session,
    entity_id: UUID,
    officer: Officer,
) -> EntityDetail | None:
    """Single-record fetch across the entity tables in a fixed order
    (Person -> Organization -> Vehicle -> Device -> Address), first match
    wins (a cross-table UUID collision is astronomically unlikely; the
    deterministic order makes it stable if it ever happens).

    Record-level tier gate: an entity whose classification exceeds the
    officer's tier never matches this query, so it surfaces as 404 at the
    router — existence is not leaked by a 403. Address rows are additionally
    jurisdiction-scoped via get_accessible_district_ids, so an
    out-of-jurisdiction address is likewise absent -> 404."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    # is_protected_subject is gated at a fixed PROTECTED tier: below it the
    # field is ALWAYS redacted regardless of the stored 0/1 (no value
    # inference); at PROTECTED+ the raw value is returned.
    can_see_protected_flag = (
        CLASSIFICATION_RANK[ROLE_MAX_CLASSIFICATION[officer.role]]
        >= CLASSIFICATION_RANK[ModelClassificationLevel.PROTECTED]
    )

    person = db.execute(
        select(Person).where(
            Person.id == entity_id,
            Person.classification.in_(visible_tiers),
        )
    ).scalar_one_or_none()
    if person is not None:
        aliases = None
        if person.aliases:
            try:
                aliases = json.loads(person.aliases)
            except ValueError:
                aliases = None
        protected_subject = (
            person.is_protected_subject
            if can_see_protected_flag
            else RedactedField(redacted=True, reason="no_access")
        )
        return EntityDetail(
            id=str(person.id),
            type="person",
            label=person.full_name,
            classification=ClassificationLevel(person.classification.value),
            aliases=aliases,
            date_of_birth=str(person.date_of_birth) if person.date_of_birth else None,
            is_protected_subject=protected_subject,
        )

    organization = db.execute(
        select(Organization).where(
            Organization.id == entity_id,
            Organization.classification.in_(visible_tiers),
        )
    ).scalar_one_or_none()
    if organization is not None:
        return EntityDetail(
            id=str(organization.id),
            type="organization",
            label=organization.name,
            classification=ClassificationLevel(organization.classification.value),
            name=organization.name,
            org_type=organization.org_type,
        )

    vehicle = db.execute(
        select(Vehicle).where(
            Vehicle.id == entity_id,
            Vehicle.classification.in_(visible_tiers),
        )
    ).scalar_one_or_none()
    if vehicle is not None:
        return EntityDetail(
            id=str(vehicle.id),
            type="vehicle",
            label=vehicle.registration_number,
            classification=ClassificationLevel(vehicle.classification.value),
            registration_number=vehicle.registration_number,
            make=vehicle.make,
            model=vehicle.model,
            color=vehicle.color,
        )

    device = db.execute(
        select(Device).where(
            Device.id == entity_id,
            Device.classification.in_(visible_tiers),
        )
    ).scalar_one_or_none()
    if device is not None:
        return EntityDetail(
            id=str(device.id),
            type="device",
            label=device.phone_number,
            classification=ClassificationLevel(device.classification.value),
            phone_number=device.phone_number,
            imei=device.imei,
            device_type=device.device_type,
        )

    address_stmt = select(Address).where(
        Address.id == entity_id,
        Address.classification.in_(visible_tiers),
    )
    if accessible is not None:
        address_stmt = address_stmt.where(Address.district_id.in_(accessible))
    address = db.execute(address_stmt).scalar_one_or_none()
    if address is not None:
        return EntityDetail(
            id=str(address.id),
            type="address",
            label=address.raw_text,
            classification=ClassificationLevel(address.classification.value),
            raw_text=address.raw_text,
            district_id=str(address.district_id) if address.district_id else None,
        )

    return None


def _build_summary(entity_type: str, table, row) -> EntitySummary:
    return EntitySummary(
        id=str(row.id),
        type=entity_type,  # type: ignore[arg-type]
        label=getattr(row, SEARCH_FIELDS[entity_type][0].key),
        classification=ClassificationLevel(row.classification),
    )


def _endpoint_summary(
    db: Session,
    entity_id: UUID,
    officer: Officer,
    entity_type: str | None = None,
) -> EntitySummary | None:
    """Resolve entity_id to a viewer-visible EntitySummary.

    entity_type=None scans all five tables (bare-id lookup — used for the
    requested entity at the relationships endpoint). Otherwise only the
    given table is consulted (relationship endpoints, whose type comes from
    the Neo4j shape). Gating = record classification within the viewer's
    tiers plus (address only) district jurisdiction — the same rules as
    get_entity. Returns None when the entity is absent or invisible:
    fail-closed, nothing about it is revealed via relationships."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    types = [entity_type] if entity_type is not None else list(SEARCH_FIELDS.keys())
    for t in types:
        table = SEARCH_FIELDS[t][0].table
        # one_or_none(), not scalar_one_or_none(): with a Table-based select
        # scalar() unwraps to the first column (the id UUID) instead of the Row.
        row = db.execute(
            select(table).where(
                table.columns.id == entity_id,
                table.columns.classification.in_(visible_tiers),
            )
        ).one_or_none()
        if row is None:
            continue
        if t == "address" and accessible is not None and row.district_id not in accessible:
            continue
        return _build_summary(t, table, row)
    return None


def _mirror_row(
    db: Session, relationship_id: str, visible_tiers: list[ClassificationLevel]
) -> RelationshipEdgeRef | None:
    """Mirror lookup, fail-closed: an edge with no RelationshipEdgeRef row —
    or whose mirror classification is above the viewer's tiers — returns
    None, exactly as if the edge did not exist. Both conditions are the same
    404/omission; existence is never confirmed to an under-tier viewer."""
    return db.execute(
        select(RelationshipEdgeRef).where(
            RelationshipEdgeRef.neo4j_relationship_id == relationship_id,
            RelationshipEdgeRef.classification.in_(visible_tiers),
        )
    ).scalar_one_or_none()


def _relationship_out(
    relationship_id: str,
    relationship_type: str,
    source: EntitySummary,
    target: EntitySummary,
    mirror: RelationshipEdgeRef,
) -> RelationshipOut:
    """Classification + confidence come ONLY from the mirror (decision 000);
    the graph never contributes visibility metadata."""
    return RelationshipOut(
        id=relationship_id,
        type=relationship_type,
        source_entity=source,
        target_entity=target,
        confidence=Confidence(
            score=mirror.confidence_score, band=ConfidenceBand(mirror.confidence_band)
        ),
        classification=ClassificationLevel(mirror.classification.value),
        verification_status=mirror.verification_status,
        effective_from=str(mirror.effective_from) if mirror.effective_from else None,
        effective_to=str(mirror.effective_to) if mirror.effective_to else None,
        case_id=str(mirror.case_id) if mirror.case_id else None,
    )


def get_entity_relationships(
    db: Session,
    graph_session,
    entity_id: UUID,
    officer: Officer,
    page: int,
    page_size: int,
) -> tuple[list[RelationshipOut], int] | None:
    """Relationships of one entity, reconciled against the Postgres mirror.

    Pipeline: (1) gate the requested entity itself (404 if absent/invisible,
    before any graph contact); (2) traverse Neo4j for candidate edges —
    topology only; (3) mirror lookup per edge, tier-gated; (4) gate the far
    endpoint entity (tier + address jurisdiction); (5) assemble from mirror
    fields. An edge fails out entirely on any single step (fail-closed).
    Returns None when the requested entity is not visible (router 404);
    otherwise (items, total) — an empty list means a visible entity with no
    surviving edges. Pagination is applied in memory after reconciliation
    (correctness first; Cypher-level paging is future perf work)."""
    source = _endpoint_summary(db, entity_id, officer)
    if source is None:
        return None

    try:
        records = graph_session.run(
            RELATIONSHIPS_OF_ENTITY, entity_id=str(entity_id)
        ).data()
    except Exception as exc:  # driver errors: connectivity, auth, query
        raise GraphUnavailableError() from exc

    visible_tiers = classification_filter(officer.role)
    relationships: list[RelationshipOut] = []
    for rec in records:
        mirror = _mirror_row(db, rec["relationship_id"], visible_tiers)
        if mirror is None:
            continue  # fail-closed: no mirror row, or above viewer tier
        try:
            endpoint_id = UUID(rec["endpoint_entity_id"])
        except (TypeError, ValueError):
            continue  # malformed graph data -> omit, fail-closed
        endpoint = _endpoint_summary(
            db, endpoint_id, officer, entity_type=rec["endpoint_entity_type"]
        )
        if endpoint is None:
            continue  # invisible or dangling endpoint -> omit, fail-closed
        if rec["direction"] == "incoming":
            source_side, target_side = endpoint, source
        else:
            source_side, target_side = source, endpoint
        relationships.append(
            _relationship_out(
                rec["relationship_id"],
                rec["relationship_type"],
                source_side,
                target_side,
                mirror,
            )
        )

    relationships.sort(key=lambda r: r.id)
    total = len(relationships)
    start = (page - 1) * page_size
    return relationships[start : start + page_size], total


def get_relationship(
    db: Session,
    graph_session,
    relationship_id: str,
    officer: Officer,
) -> RelationshipOut | None:
    """Relationship detail: topology from Neo4j (endpoints), everything
    else from the mirror. relationship_id is an opaque string (the
    neo4j_relationship_id column is String) and is passed as a bound
    parameter to both stores — never interpolated. None -> router 404
    covers: not in graph, no mirror row, mirror above tier, or an
    invisible/dangling endpoint (all fail-closed, indistinguishable)."""
    try:
        records = graph_session.run(
            RELATIONSHIP_DETAIL, relationship_id=relationship_id
        ).data()
    except Exception as exc:
        raise GraphUnavailableError() from exc
    if not records:
        return None
    rec = records[0]

    visible_tiers = classification_filter(officer.role)
    mirror = _mirror_row(db, relationship_id, visible_tiers)
    if mirror is None:
        return None  # fail-closed: no mirror row, or above viewer tier

    try:
        source_id = UUID(rec["source_entity_id"])
        target_id = UUID(rec["target_entity_id"])
    except (TypeError, ValueError):
        return None  # malformed graph data -> fail-closed

    source = _endpoint_summary(db, source_id, officer, entity_type=rec["source_entity_type"])
    target = _endpoint_summary(db, target_id, officer, entity_type=rec["target_entity_type"])
    if source is None or target is None:
        return None  # invisible or dangling endpoint -> fail-closed

    return _relationship_out(relationship_id, rec["relationship_type"], source, target, mirror)
