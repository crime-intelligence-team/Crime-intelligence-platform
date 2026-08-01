"""Phase 4 component 6 test data: Neo4j nodes/edges + Postgres mirror rows.

Run from inside the cip-api container:
    docker exec cip-api python -m scripts.seed_phase4_relationships

Edges (all from the seeded person 03087814-...):
  E1 rel-e1-phase4  person -> PROTECTED address   mirrored, RESTRICTED_OPERATIONAL
  E2 rel-e2-phase4  person -> Central address     mirrored, RESTRICTED_OPERATIONAL
  E3 rel-e3-phase4  person -> East address        NOT mirrored (fail-closed test)
  E4 rel-e4-phase4  person -> East address        mirrored, RESTRICTED_OPERATIONAL
  E5 rel-e5-phase4  person -> Central address     mirrored, PROTECTED

Expected per viewer (list on the person):
  analyst    -> E2, E4        (E1 endpoint-gated, E3 unmirrored, E5 tier-gated)
  supervisor -> E1, E2, E4, E5
  officer    -> E2 only       (E4 jurisdiction-gated EAST, E1 endpoint-gated,
                               E5 tier-gated)

Node/edge conventions must match graph/queries.py: :Entity nodes with
entity_id/entity_type/label; edge property neo4j_relationship_id; the
relationship type IS the domain type. Relationship types cannot be Cypher
parameters (language limitation), so they are inlined from this closed
constant set — every value passed as a parameter (a, b, rid) is bound,
never interpolated.
"""

import sys
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.graph.driver import get_driver
from app.models.base import ClassificationLevel
from app.models.entities import (
    Address,
    Case,
    District,
    Officer,
    Person,
    RelationshipEdgeRef,
    Role,
)

# Endpoint ids are resolved at run time (by lookup against rows created by
# seed_dev_data / seed_phase4_test_data) — the seeds create rows with random
# UUIDs, so hardcoded ids would silently attach the graph to phantom nodes on
# a clean checkout (Phase 7 component 1 finding).

EDGE_TYPES = frozenset({"LINKED_TO", "MEMBER_OF"})

EDGES = [
    # (neo4j_relationship_id, source, target, type, mirrored, classification, band, status)
    # source/target are placeholder strings replaced at resolve time:
    # ("PERSON", "protected" | "central" | "east")
    ("rel-e1-phase4", "PERSON", "protected", "LINKED_TO", True, ClassificationLevel.RESTRICTED_OPERATIONAL, "verified", "verified"),
    ("rel-e2-phase4", "PERSON", "central", "LINKED_TO", True, ClassificationLevel.RESTRICTED_OPERATIONAL, "verified", "verified"),
    ("rel-e3-phase4", "PERSON", "east", "LINKED_TO", False, None, None, None),
    ("rel-e4-phase4", "PERSON", "east", "LINKED_TO", True, ClassificationLevel.RESTRICTED_OPERATIONAL, "probable", "pending"),
    ("rel-e5-phase4", "PERSON", "central", "MEMBER_OF", True, ClassificationLevel.PROTECTED, "verified", "verified"),
]

NODES = [
    ("PERSON", "person", "Phase4 Protected Person"),
    ("protected", "address", "PROTECTED test address"),
    ("central", "address", "Address near Central-North at 77.2100,28.6340"),
    ("east", "address", "Address near East-Industrial at 77.2950,28.6360"),
]

LOOKUP_LABELS = {
    "PERSON": ("Phase4 Protected Person", None),
    "protected": ("PROTECTED test address", "SRID=4326;POINT(77.2200 28.6300)"),
    "central": ("Address near Central-North at 77.2100,28.6340", "SRID=4326;POINT(77.2100 28.6340)"),
    "east": ("Address near East-Industrial at 77.2950,28.6360", "SRID=4326;POINT(77.2950 28.6360)"),
}


def _resolve_endpoint_ids(db) -> tuple[str, str, str, str]:
    """Resolve the placeholder endpoint ids to real row ids, creating the
    rows if the companion seeds have not run yet. Returns
    (person_id, protected_addr_id, central_addr_id, east_addr_id)."""
    central = db.execute(
        select(District).where(District.code == "CEN")
    ).scalar_one_or_none()
    east = db.execute(
        select(District).where(District.code == "EAST")
    ).scalar_one_or_none()
    if central is None or east is None:
        raise RuntimeError("run scripts.seed_dev_data first (districts CEN/EAST missing)")

    person = db.execute(
        select(Person).where(Person.full_name == "Phase4 Protected Person")
    ).scalars().first()
    if person is None:
        person = Person(
            full_name="Phase4 Protected Person",
            aliases=None,
            date_of_birth=None,
            is_protected_subject=1,
            classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
        )
        db.add(person)
        db.flush()

    addr_ids = {}
    for key, (raw_text, point) in LOOKUP_LABELS.items():
        if key == "PERSON":
            continue
        address = db.execute(
            select(Address).where(Address.raw_text == raw_text)
        ).scalars().first()
        if address is None:
            address = Address(
                raw_text=raw_text,
                geocoded_point=point,
                district_id=central.id if key != "east" else east.id,
                classification=(
                    ClassificationLevel.PROTECTED
                    if key == "protected"
                    else ClassificationLevel.RESTRICTED_OPERATIONAL
                ),
                source_name="phase4-seed",
                source_timestamp=datetime.now(timezone.utc),
                mapping_schema_version="seed-1",
            )
            db.add(address)
            db.flush()
        addr_ids[key] = str(address.id)
    db.commit()
    return str(person.id), addr_ids["protected"], addr_ids["central"], addr_ids["east"]


def _build_edges_and_nodes(person_id, addr_protected, addr_central, addr_east):
    resolved = {
        "PERSON": person_id,
        "protected": addr_protected,
        "central": addr_central,
        "east": addr_east,
    }
    nodes = [
        (resolved[key], etype, label) for key, etype, label in NODES
    ]
    edges = [
        (
            rid,
            resolved[src],
            resolved[dst],
            rtype,
            mirrored,
            classification,
            band,
            status_,
        )
        for rid, src, dst, rtype, mirrored, classification, band, status_ in EDGES
    ]
    return nodes, edges


def _ensure_detective(db) -> Officer:
    """DETECTIVE officer with a home district (CEN): the role that has both
    relationship:view AND a jurisdiction scope, which is what exercises the
    jurisdiction-gated relationship path (DISTRICT_OFFICER lacks
    relationship:view — see docs/decisions/005)."""
    detective = db.execute(
        select(Officer).where(Officer.username == "detective")
    ).scalar_one_or_none()
    if detective is not None:
        return detective
    cen = db.execute(select(District).where(District.code == "CEN")).scalar_one()
    detective = Officer(
        official_id="DET-0001",
        username="detective",
        hashed_password=hash_password("Password1!"),
        full_name="Dana Detective",
        role=Role.DETECTIVE,
        unit="Central District CID",
        home_district_id=cen.id,
        mfa_enabled=0,
        is_active=1,
    )
    db.add(detective)
    db.flush()
    return detective


def main() -> None:
    db = SessionLocal()
    try:
        case_id = db.execute(select(Case.id)).scalars().first()
        detective = _ensure_detective(db)
        print(f"officer: detective ({detective.official_id}) ensured")

        person_id, addr_protected, addr_central, addr_east = _resolve_endpoint_ids(db)
        nodes, edges = _build_edges_and_nodes(
            person_id, addr_protected, addr_central, addr_east
        )
        print(f"resolved endpoints: person={person_id}")

        driver = get_driver()
        with driver.session() as session:
            for eid, etype, label in nodes:
                session.run(
                    "MERGE (n:Entity {entity_id: $eid}) "
                    "SET n.entity_type = $etype, n.label = $label",
                    eid=eid,
                    etype=etype,
                    label=label,
                )
            for rid, src, dst, rtype, _mirrored, *_ in edges:
                assert rtype in EDGE_TYPES, f"not a closed-set type: {rtype}"
                # Relationship type is the only inline (Cypher cannot bind it);
                # it comes from EDGE_TYPES, never from request input.
                session.run(
                    f"MATCH (a:Entity {{entity_id: $a}}), (b:Entity {{entity_id: $b}}) "
                    f"MERGE (a)-[r:{rtype} {{neo4j_relationship_id: $rid}}]->(b)",
                    a=src,
                    b=dst,
                    rid=rid,
                )
        print("graph: nodes + edges in place")

        created = 0
        for rid, src, dst, rtype, mirrored, classification, band, status_ in edges:
            if not mirrored:
                continue
            existing = db.execute(
                select(RelationshipEdgeRef).where(RelationshipEdgeRef.neo4j_relationship_id == rid)
            ).scalar_one_or_none()
            if existing is not None:
                print(f"mirror: {rid} already present")
                continue
            db.add(
                RelationshipEdgeRef(
                    neo4j_relationship_id=rid,
                    source_identifier=f"phase4-seed-{rid}",
                    confidence_score=85 if band != "probable" else 60,
                    confidence_band=band,
                    verification_status=status_,
                    effective_from=datetime.now(timezone.utc),
                    effective_to=None,
                    case_id=case_id,
                    classification=classification,
                )
            )
            created += 1
        db.commit()
        print(f"mirror: {created} rows created")

        with driver.session() as session:
            nodes = session.run("MATCH (n:Entity) RETURN count(n) AS c").single()["c"]
            rels = session.run("MATCH ()-[r]->() RETURN count(r) AS c").single()["c"]
        print(f"graph now: {nodes} nodes, {rels} relationships")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
