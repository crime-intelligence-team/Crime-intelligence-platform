from uuid import UUID

from sqlalchemy.orm import Session

from app.models.entities import District, Officer, Role
from app.schemas.map import DistrictDetail, DistrictQuickSummary, DistrictSummary
from app.utils.geometry import geometry_to_geojson


def get_accessible_district_ids(officer: Officer) -> list[UUID] | None:
    if officer.role in (Role.ANALYST, Role.SUPERVISOR, Role.ADMINISTRATOR):
        return None
    if officer.home_district_id is not None:
        return [officer.home_district_id]
    return []


def list_districts(db: Session, officer: Officer) -> list[DistrictSummary]:
    query = db.query(District)
    accessible = get_accessible_district_ids(officer)
    if accessible is not None:
        query = query.filter(District.id.in_(accessible))
    districts = query.all()
    return [
        DistrictSummary(
            id=str(d.id),
            name=d.name,
            code=d.code,
            classification=d.classification.value,
            geometry=geometry_to_geojson(d.geometry),
        )
        for d in districts
    ]


def get_district(db: Session, district_id: UUID, officer: Officer) -> DistrictDetail | None:
    query = db.query(District).filter(District.id == district_id)
    accessible = get_accessible_district_ids(officer)
    if accessible is not None:
        query = query.filter(District.id.in_(accessible))
    district = query.first()
    if district is None:
        return None
    return DistrictDetail(
        id=str(district.id),
        name=district.name,
        code=district.code,
        classification=district.classification.value,
        geometry=geometry_to_geojson(district.geometry),
        population=district.population,
    )


def get_district_summary(db: Session, district_id: UUID, officer: Officer) -> DistrictQuickSummary | None:
    query = db.query(District).filter(District.id == district_id)
    accessible = get_accessible_district_ids(officer)
    if accessible is not None:
        query = query.filter(District.id.in_(accessible))
    district = query.first()
    if district is None:
        return None
    return DistrictQuickSummary(
        district_id=str(district.id),
        open_cases=0,
        active_alerts=0,
        priority_entities=0,
        classification=district.classification.value,
    )
