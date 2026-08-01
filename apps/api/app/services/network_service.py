from uuid import UUID

from sqlalchemy import func, literal, or_, select
from sqlalchemy.orm import Session

from app.core.classification import classification_filter
from app.models.entities import Address, Device, Officer, Organization, Person, Vehicle
from app.schemas.common import ClassificationLevel
from app.schemas.network import EntitySummary
from app.services.district_service import get_accessible_district_ids

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
