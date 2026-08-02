"""Phase 6 component 2 fixture: two vehicles with graph edges + mirrors.

V1 (KA-01-1234): 3 edges to existing graph nodes, mirrors at
  verified/probable bands -> degree 3 == PRIORITY_DEGREE_THRESHOLD -> priority (rank 2)
V2 (KA-02-5678): 2 edges, mirrors verified -> degree 2 < 3 -> NOT priority
Mirrors carry case_id = NULL so the case-linked signal cannot fire
(degree isolated as the qualifying signal). Graph node entity_id = the
vehicle row UUID (RELATIONSHIPS_OF_ENTITY matches on it). Idempotent.

Endpoint ids (person, addresses) are resolved by lookup — the seed scripts
create rows with random UUIDs, so hardcoded ids would dangle on a clean
checkout (Phase 7 component 1 finding). Run seed_dev_data,
seed_phase4_test_data and seed_phase4_relationships first.

Run from inside the cip-api container:
    docker exec cip-api python -m scripts.seed_phase6_priority
"""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.graph.driver import get_driver
from app.models.base import ClassificationLevel
from app.models.entities import (
    Address,
    Person,
    RelationshipEdgeRef,
    Vehicle,
)

PERSON = "Phase4 Protected Person"
CEN_ADDR = "Address near Central-North at 77.2100,28.6340"
EAST_ADDR = "Address near East-Industrial at 77.2950,28.6360"

VEHICLES = [
    {"reg": "KA-01-1234", "make": "Toyota", "model": "Innova"},
    {"reg": "KA-02-5678", "make": "Honda", "model": "City"},
]

# (vehicle_reg, edge_id, other_endpoint, confidence, band)
EDGES = [
    ("KA-01-1234", "pri-v1-e1", PERSON, 85, "verified"),
    ("KA-01-1234", "pri-v1-e2", CEN_ADDR, 60, "probable"),
    ("KA-01-1234", "pri-v1-e3", EAST_ADDR, 85, "verified"),
    ("KA-02-5678", "pri-v2-e1", PERSON, 85, "verified"),
    ("KA-02-5678", "pri-v2-e2", CEN_ADDR, 75, "verified"),
]


def _resolve_endpoint_ids(db: Session) -> dict[str, str]:
    resolved = {}
    person = db.execute(
        select(Person).where(Person.full_name == PERSON)
    ).scalars().first()
    if person is None:
        raise RuntimeError("run scripts.seed_phase4_test_data first (Phase4 Protected Person missing)")
    resolved[PERSON] = str(person.id)
    for raw_text in (CEN_ADDR, EAST_ADDR):
        address = db.execute(
            select(Address).where(Address.raw_text == raw_text)
        ).scalars().first()
        if address is None:
            raise RuntimeError(
                f"run scripts.seed_dev_data + seed_phase4_relationships first ({raw_text!r} missing)"
            )
        resolved[raw_text] = str(address.id)
    return resolved


def main() -> int:
    engine = create_engine(settings.DATABASE_URL)
    db = Session(engine)
    driver = get_driver()
    try:
        endpoint_ids = _resolve_endpoint_ids(db)
        reg_to_id = {}
        for v in VEHICLES:
            exists = db.execute(
                select(Vehicle).where(Vehicle.registration_number == v["reg"])
            ).scalar_one_or_none()
            if exists is None:
                exists = Vehicle(
                    registration_number=v["reg"], make=v["make"], model=v["model"],
                    classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                )
                db.add(exists)
                db.flush()
            reg_to_id[v["reg"]] = str(exists.id)
        db.commit()

        with driver.session() as session:
            for v in VEHICLES:
                session.run(
                    "MERGE (n:Entity {entity_id: $eid}) "
                    "SET n.entity_type = $etype, n.label = $label",
                    eid=reg_to_id[v["reg"]],
                    etype="vehicle",
                    label=f"{v['reg']} {v['make']} {v['model']}".strip(),
                )
            for reg, rid, other, conf, band in EDGES:
                session.run(
                    f"MATCH (a:Entity {{entity_id: $a}}), (b:Entity {{entity_id: $b}}) "
                    f"MERGE (a)-[r:LINKED_TO {{neo4j_relationship_id: $rid}}]->(b)",
                    a=reg_to_id[reg],
                    b=endpoint_ids[other],
                    rid=rid,
                )
        print("graph: vehicle nodes + edges in place")
        print("vehicle node ids:", reg_to_id)

        created = 0
        for reg, rid, other, conf, band in EDGES:
            exists = db.execute(
                select(RelationshipEdgeRef).where(RelationshipEdgeRef.neo4j_relationship_id == rid)
            ).scalar_one_or_none()
            if exists is None:
                db.add(RelationshipEdgeRef(
                    neo4j_relationship_id=rid,
                    source_identifier=f"pri-seed-{rid}",
                    confidence_score=conf,
                    confidence_band=band,
                    verification_status="unverified",
                    classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                ))
                created += 1
        db.commit()
        print(f"mirrors: {created} created")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
        driver.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
