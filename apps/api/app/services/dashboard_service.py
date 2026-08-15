from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.classification import classification_filter
from app.models.base import ClassificationLevel
from app.models.entities import Case, District, Officer
from app.schemas.dashboard import (
    DashboardResponse,
    Hotspot,
    KpiStrip,
    TrendPoint,
    TrendSeries,
)
from app.services.district_service import get_accessible_district_ids

# When the underlying incident happened (source_timestamp), falling back to
# ingestion time for records that never got one. Used by trends and hotspots.
EVENT_TIME = func.coalesce(Case.source_timestamp, Case.created_at)

TREND_WINDOWS: dict[str, int] = {"7d": 7, "30d": 30, "90d": 90}
HOTSPOT_LIMIT = 5


def _resolve_region(db: Session, district_id: UUID, officer: Officer) -> District | None:
    """Region must exist AND be inside the officer's accessible jurisdiction."""
    query = db.query(District).filter(District.id == district_id)
    accessible = get_accessible_district_ids(officer)
    if accessible is not None:
        query = query.filter(District.id.in_(accessible))
    return query.first()


def _kpi_strip(
    db: Session,
    district_id: UUID,
    visible_tiers: list[ClassificationLevel],
) -> KpiStrip:
    """Tier filter runs BEFORE counting (7.5 redaction rule): a record above
    the viewer's tier is invisible to these counts. active_gangs and
    high_priority_entities are honest stubs — Organization has no status/active
    column and no district_id, and "high priority" has no definition in schema
    or brief (same treatment as Phase 2's active_alerts).
    See docs/decisions/004-dashboard-classification-gating.md."""
    total_incidents = (
        db.query(func.count(Case.id))
        .filter(Case.district_id == district_id, Case.classification.in_(visible_tiers))
        .scalar()
        or 0
    )
    # "open_cases" = not yet closed, not literally status == "open" — a
    # case widened to under_investigation/pending_review (case_service:
    # Case.VALID_STATUSES) is still ongoing work and must keep counting.
    open_cases = (
        db.query(func.count(Case.id))
        .filter(
            Case.district_id == district_id,
            Case.status != Case.STATUS_CLOSED,
            Case.classification.in_(visible_tiers),
        )
        .scalar()
        or 0
    )
    return KpiStrip(
        total_incidents=total_incidents,
        active_gangs=0,
        open_cases=open_cases,
        high_priority_entities=0,
    )


def _trend_series(
    db: Session,
    district_id: UUID,
    days: int,
    visible_tiers: list[ClassificationLevel],
) -> list[TrendPoint]:
    """One window's trend: last `days` COMPLETE days, today deliberately
    excluded (a partial day at the right edge misreads as a spike/dip).
    Day buckets are date_trunc'd in the DB session timezone (container = UTC);
    day boundaries are UTC. Missing days render as 0, not gaps."""
    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    start = today_start - timedelta(days=days)
    rows = (
        db.query(
            func.date_trunc("day", EVENT_TIME).label("day"),
            func.count(Case.id).label("n"),
        )
        .filter(
            Case.district_id == district_id,
            Case.classification.in_(visible_tiers),
            EVENT_TIME >= start,
            EVENT_TIME < today_start,
        )
        .group_by(func.date_trunc("day", EVENT_TIME))
        .all()
    )
    counts = {row.day.date(): row.n for row in rows}
    points = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).date()
        points.append(TrendPoint(date=day.isoformat(), value=counts.get(day, 0)))
    return points


def _hotspots(
    db: Session,
    officer: Officer,
    visible_tiers: list[ClassificationLevel],
    window_days: int,
) -> list[Hotspot]:
    """Top-N districts by incident count in the trailing window, across the
    officer's accessible jurisdiction. Granularity is district — Case has no
    zone_id/address_id, so sub-district hotspots are impossible without the
    (still open) Case.address_id schema change. Ranked by CURRENT activity,
    not all-time totals, so a historically large but currently quiet district
    cannot rank. Movement = current window vs the window before it; strict
    comparison, no invented threshold."""
    now_utc = datetime.now(timezone.utc)
    # Rolling windows intentionally use raw now (partial today is ~1/30 of a
    # 30-day window — immaterial), unlike trends' single-day buckets which
    # would be 100% partial if today were included.
    current_start = now_utc - timedelta(days=window_days)
    prev_start = now_utc - timedelta(days=window_days * 2)

    current_count = func.count(Case.id).filter(EVENT_TIME >= current_start)
    prev_count = func.count(Case.id).filter(
        EVENT_TIME >= prev_start, EVENT_TIME < current_start
    )

    query = (
        db.query(
            District.id.label("district_id"),
            District.name.label("label"),
            current_count.label("incident_count"),
            prev_count.label("prev_count"),
        )
        .join(Case, Case.district_id == District.id)
        .filter(Case.classification.in_(visible_tiers))
        .group_by(District.id, District.name)
        .having(current_count > 0)
        .order_by(current_count.desc())
        .limit(HOTSPOT_LIMIT)
    )
    accessible = get_accessible_district_ids(officer)
    if accessible is not None:
        query = query.filter(District.id.in_(accessible))
    rows = query.all()

    result = []
    for row in rows:
        previous = row.prev_count or 0
        movement = (
            "stable"
            if row.incident_count == previous
            else ("increasing" if row.incident_count > previous else "decreasing")
        )
        result.append(
            Hotspot(
                location_id=str(row.district_id),
                label=row.label,
                incident_count=row.incident_count,
                movement=movement,
            )
        )
    return result


def get_dashboard(
    db: Session,
    region_id: UUID,
    officer: Officer,
    hotspot_window: str = "30d",
) -> DashboardResponse | None:
    """None means the region does not exist or is outside the officer's
    jurisdiction (caller maps it to 404). `hotspot_window` must be a key of
    TREND_WINDOWS — the router validates this before calling in."""
    region = _resolve_region(db, region_id, officer)
    if region is None:
        return None

    visible_tiers = classification_filter(officer.role)
    trends = [
        TrendSeries(window=window, points=_trend_series(db, region_id, days, visible_tiers))
        for window, days in TREND_WINDOWS.items()
    ]
    return DashboardResponse(
        region_id=str(region_id),
        kpis=_kpi_strip(db, region_id, visible_tiers),
        trends=trends,
        hotspots=_hotspots(db, officer, visible_tiers, TREND_WINDOWS[hotspot_window]),
        hotspots_window=hotspot_window,
        priority_entities=[],  # stub: no PriorityEntity model exists (Phase 6)
        alerts=[],             # stub: no Alert model exists (Phase 6)
    )
