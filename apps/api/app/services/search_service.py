"""Global search service (Phase 5 hardening). Aggregates three domains —
cases, entities, districts — under one query string.

Section inclusion is driven by the caller's permissions, decided by the
router: each section runs only when the caller holds the underlying
permission. Within a section the usual jurisdiction/tier machinery is
reused (no reinvention): case_service's visibility funnel (which includes
approved access-exception exemptions), network_service.search_entities for
the entity union, and district_service's accessible-scope for districts.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import Case, Officer
from app.schemas.cases import CaseSummary
from app.services import network_service
from app.services.case_service import _to_summary, _visible_case_stmt
from app.services.district_service import get_accessible_district_ids
from app.services.access_exception_service import exempt_case_ids
from app.core.classification import classification_filter
from app.utils.geometry import geometry_to_geojson


def search_cases(
    db: Session, officer: Officer, q: str, page: int, page_size: int
) -> tuple[list[CaseSummary], int]:
    """Case-number / title substring match through the case visibility
    funnel (tier + jurisdiction + access-exception exemptions)."""
    stmt = _visible_case_stmt(
        classification_filter(officer.role),
        get_accessible_district_ids(officer),
        exempt_case_ids=exempt_case_ids(db, officer),
    ).where(
        Case.case_number.ilike(f"%{q}%") | Case.title.ilike(f"%{q}%")
    )
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0
    rows = db.execute(
        stmt.order_by(Case.created_at.desc(), Case.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return [_to_summary(c) for c in rows], total


def search_entities(
    db: Session, officer: Officer, q: str, page: int, page_size: int
) -> tuple[list, int]:
    """Entity union search — delegates to the existing network search so
    tier filter + address jurisdiction semantics stay in one place."""
    return network_service.search_entities(
        db=db, officer=officer, q=q, entity_type=None, page=page, page_size=page_size
    )


def search_districts(
    db: Session, officer: Officer, q: str, page: int, page_size: int
) -> tuple[list, int]:
    """District name/code match, scoped by the officer's accessible
    districts (same rule list_districts uses)."""
    from app.models.entities import District
    from app.schemas.map import DistrictSummary

    accessible = get_accessible_district_ids(officer)
    stmt = select(District).where(
        District.name.ilike(f"%{q}%") | District.code.ilike(f"%{q}%")
    )
    if accessible is not None:
        stmt = stmt.where(District.id.in_(accessible))
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0
    rows = db.execute(
        stmt.order_by(District.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return [
        DistrictSummary(
            id=str(d.id),
            name=d.name,
            code=d.code,
            classification=d.classification.value,
            geometry=geometry_to_geojson(d.geometry),
        )
        for d in rows
    ], total
