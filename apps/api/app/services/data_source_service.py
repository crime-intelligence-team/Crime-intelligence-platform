"""Provenance data-source registry (see app/models/governance.py's
DataSource for why this exists). CRUD-with-deactivate, same idiom as
redaction_service's RedactionPolicyDecision: soft deactivate only, never
delete, every change audited.
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import Address, Case, Device, Officer, Organization, Person, Vehicle
from app.models.governance import DataSource
from app.schemas.data_sources import DataSourceCreate, DataSourceResponse
from app.services import audit_service

# Every ProvenanceMixin table — record_count reconciles a registry entry's
# name against these by matching source_name, since the FK doesn't exist
# (see DataSource's docstring for why).
_PROVENANCE_TABLES = (Address, Case, Device, Organization, Person, Vehicle)


class InvalidSourceTypeError(Exception):
    """source_type outside DataSource.SOURCE_TYPES (422 at the router)."""


class InvalidCadenceError(Exception):
    """cadence outside DataSource.CADENCES (422 at the router)."""


class DataSourceNameTakenError(Exception):
    """name already registered (409 at the router)."""


class DataSourceNotFoundError(Exception):
    """id does not exist or is already inactive (404 at the router)."""


def _record_count(db: Session, name: str) -> int:
    return sum(
        db.execute(
            select(func.count()).select_from(model).where(model.source_name == name)
        ).scalar()
        or 0
        for model in _PROVENANCE_TABLES
    )


def _to_response(db: Session, source: DataSource) -> DataSourceResponse:
    return DataSourceResponse(
        id=str(source.id),
        name=source.name,
        source_type=source.source_type,
        owner=source.owner,
        cadence=source.cadence,
        description=source.description,
        active=source.active,
        record_count=_record_count(db, source.name),
        created_by_id=str(source.created_by_id),
        created_at=source.created_at.isoformat() if source.created_at else None,
    )


def create_data_source(
    db: Session, officer: Officer, payload: DataSourceCreate
) -> DataSourceResponse:
    if payload.source_type not in DataSource.SOURCE_TYPES:
        raise InvalidSourceTypeError(payload.source_type)
    if payload.cadence not in DataSource.CADENCES:
        raise InvalidCadenceError(payload.cadence)
    existing = db.execute(
        select(DataSource.id).where(DataSource.name == payload.name)
    ).scalar_one_or_none()
    if existing is not None:
        raise DataSourceNameTakenError(payload.name)

    source = DataSource(
        name=payload.name,
        source_type=payload.source_type,
        owner=payload.owner,
        cadence=payload.cadence,
        description=payload.description,
        active=True,
        created_by_id=officer.id,
    )
    db.add(source)
    db.flush()
    audit_service.write_audit_log(
        db,
        actor=officer,
        action="data_source_registered",
        module=audit_service.MODULE_GOVERNANCE,
        resource_type="data_source",
        resource_id=str(source.id),
        detail=None,
    )
    db.commit()
    db.refresh(source)
    return _to_response(db, source)


def list_data_sources(db: Session, active_only: bool | None) -> list[DataSourceResponse]:
    stmt = select(DataSource).order_by(DataSource.created_at.desc())
    if active_only is not None:
        stmt = stmt.where(DataSource.active == active_only)
    rows = db.execute(stmt).scalars().all()
    return [_to_response(db, s) for s in rows]


def deactivate_data_source(
    db: Session, officer: Officer, source_id: UUID
) -> DataSourceResponse:
    source = db.get(DataSource, source_id)
    if source is None or not source.active:
        raise DataSourceNotFoundError(str(source_id))
    source.active = False
    db.flush()
    audit_service.write_audit_log(
        db,
        actor=officer,
        action="data_source_deactivated",
        module=audit_service.MODULE_GOVERNANCE,
        resource_type="data_source",
        resource_id=str(source.id),
        detail=None,
    )
    db.commit()
    db.refresh(source)
    return _to_response(db, source)
