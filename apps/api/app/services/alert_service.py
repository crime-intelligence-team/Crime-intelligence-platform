"""Alert and priority-entity service (Phase 6 component 2).

Alerts: persisted intelligence-feed rows, tier + jurisdiction gated on
read (alerts with NULL district are invisible to jurisdiction-scoped
officers — nothing to scope against, same semantics as cases).
create_alert is the write path used by component 6 (confidence_change
on accepted review); the other vocabulary types have no in-phase
trigger yet (docs/decisions/007).

Priority entities: COMPUTED ON READ, never stored — no refresh job,
consistent with the project's deferred-background pattern. Signals
(decision 007):
  1. Person.is_protected_subject = 1            (sensitive-tag proxy)
  2. >= 1 relationship edge whose mirror row     (case-linked evidence)
     references an OPEN case
  3. relationship degree >= PRIORITY_DEGREE_THRESHOLD mirror rows at
     verified/probable band                      (linked entity signal)
Rank: protected(0) > case-linked(1) > degree(2), newest first within
a rank; an entity appears once.

Mechanism correction (007): RelationshipEdgeRef mirrors carry NO
endpoint columns (source_identifier is an opaque provenance string,
not an entity reference), so signals 2/3 are computed via the existing
RELATIONSHIPS_OF_ENTITY traversal (nodes carry entity_id) + a batch
mirror lookup — zero changes to the do-not-touch graph layer. If the
graph is unreachable the whole computation fails closed with 503
(graph_unavailable), consistent with the relationship endpoints: a
degraded priority list would silently omit linked-entity signals.
"""

import contextlib
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.classification import classification_filter
from app.core.config import settings
from app.graph.driver import get_session
from app.graph.queries import RELATIONSHIPS_OF_ENTITY
from app.models.entities import (
    Alert,
    Case,
    Device,
    Organization,
    Person,
    RelationshipEdgeRef,
    Vehicle,
)
from app.schemas.common import ClassificationLevel
from app.schemas.dashboard import Alert as AlertOut
from app.schemas.dashboard import PriorityEntity
from app.services.district_service import get_accessible_district_ids


class InvalidAlertTypeError(Exception):
    """Alert type outside the verified vocabulary (422 at the router)."""


class GraphUnavailableError(Exception):
    """Neo4j unreachable during priority computation (503 at the router)."""


def list_alerts(
    db: Session,
    officer,
    page: int,
    page_size: int,
) -> tuple[list[AlertOut], int]:
    """Tier + jurisdiction gated, newest first. Scoped officers never see
    NULL-district alerts (nothing to scope against — fail-closed)."""
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    stmt = select(Alert).where(Alert.classification.in_(visible_tiers))
    if accessible is not None:
        stmt = stmt.where(Alert.district_id.in_(accessible))
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0
    rows = db.execute(
        stmt.order_by(Alert.created_at.desc(), Alert.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return [_to_alert_out(a) for a in rows], total


def _to_alert_out(alert: Alert) -> AlertOut:
    return AlertOut(
        id=str(alert.id),
        type=alert.type,
        summary=alert.summary,
        classification=ClassificationLevel(alert.classification.value),
        created_at=str(alert.created_at) if alert.created_at else None,
        entity_type=alert.entity_type,
        entity_id=str(alert.entity_id) if alert.entity_id else None,
        district_id=str(alert.district_id) if alert.district_id else None,
    )


def create_alert(
    db: Session,
    alert_type: str,
    summary: str,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    district_id: UUID | None = None,
    classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
) -> Alert:
    """Write path for alerts (component 6 fires confidence_change here).
    Vocabulary is closed and validated; anything else is a programming
    error, not user input (422 at the router when exposed)."""
    if alert_type not in Alert.VALID_ALERT_TYPES:
        raise InvalidAlertTypeError(alert_type)
    alert = Alert(
        type=alert_type,
        summary=summary.strip(),
        entity_type=entity_type,
        entity_id=entity_id,
        district_id=district_id,
        classification=classification,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def priority_entities(
    db: Session,
    officer,
    page: int,
    page_size: int,
) -> tuple[list[PriorityEntity], int]:
    """Computed-on-read priority list (decision 007). See module docstring
    for the signals and the graph-down fail-closed rule."""
    visible_tiers = classification_filter(officer.role)

    candidates: list[tuple[int, str, UUID, str, object]] = []
    for person in db.execute(
        select(Person).where(
            Person.is_protected_subject == 1,
            Person.classification.in_(visible_tiers),
        )
    ).scalars().all():
        candidates.append((0, "person", person.id, person.full_name, person))
    for org in db.execute(
        select(Organization).where(
            Organization.org_type == "gang",
            Organization.classification.in_(visible_tiers),
        )
    ).scalars().all():
        candidates.append((1, "gang", org.id, org.name, org))
    for vehicle in db.execute(
        select(Vehicle).where(Vehicle.classification.in_(visible_tiers))
    ).scalars().all():
        candidates.append((2, "vehicle", vehicle.id, _vehicle_label(vehicle), vehicle))
    for device in db.execute(
        select(Device).where(Device.classification.in_(visible_tiers))
    ).scalars().all():
        candidates.append((3, "device", device.id, _device_label(device), device))

    if not candidates:
        return [], 0

    signal = {}
    try:
        with contextlib.contextmanager(get_session)() as graph_session:
            for base_rank, etype, entity_id, label, model in candidates:
                records = graph_session.run(
                    RELATIONSHIPS_OF_ENTITY, entity_id=str(entity_id)
                ).data()
                if not records:
                    continue
                edge_ids = [r["relationship_id"] for r in records]
                mirrors = db.execute(
                    select(RelationshipEdgeRef).where(
                        RelationshipEdgeRef.neo4j_relationship_id.in_(edge_ids)
                    )
                ).scalars().all()
                linked_cases = [m.case_id for m in mirrors if m.case_id is not None]
                open_linked = 0
                if linked_cases:
                    open_linked = db.execute(
                        select(func.count())
                        .select_from(Case)
                        .where(
                            Case.id.in_(linked_cases),
                            Case.status == Case.STATUS_OPEN,
                        )
                    ).scalar() or 0
                degree = sum(
                    1
                    for m in mirrors
                    if m.confidence_band in ("verified", "probable")
                )
                # Signal rank: protected(0) > case-linked(1) > degree(2);
                # an entity with none of the three is not priority. The
                # protected signal exists only on Person.
                if base_rank == 0:
                    rank = 0
                elif open_linked > 0:
                    rank = 1
                elif degree >= settings.PRIORITY_DEGREE_THRESHOLD:
                    rank = 2
                else:
                    continue
                signal[entity_id] = rank
    except Exception as exc:  # driver errors: connectivity, auth, query
        raise GraphUnavailableError() from exc

    ranked = sorted(
        (signal[eid], etype, eid, label, model)
        for _base_rank, etype, eid, label, model in candidates
        if eid in signal
    )
    result = [
        PriorityEntity(
            id=str(eid),
            type=etype,
            label=label,
            classification=ClassificationLevel(model.classification.value),
        )
        for _signal_rank, etype, eid, label, model in ranked
    ]
    total = len(result)
    start = (page - 1) * page_size
    return result[start : start + page_size], total


def _vehicle_label(vehicle: Vehicle) -> str:
    parts = [p for p in (vehicle.registration_number, vehicle.make, vehicle.model) if p]
    return " ".join(parts) if parts else "vehicle"


def _device_label(device: Device) -> str:
    parts = [p for p in (device.phone_number, device.device_type) if p]
    return " ".join(parts) if parts else "device"
