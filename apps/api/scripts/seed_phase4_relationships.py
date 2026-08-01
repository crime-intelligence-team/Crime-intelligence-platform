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

PERSON_ID = "03087814-1dea-4915-86be-6dc2402552b3"
ADDR_PROTECTED = "f3b1b82c-10de-4792-a837-0829e98ed50c"
ADDR_CENTRAL = "1504a962-3303-4151-967e-fd5a94c87aad"
ADDR_EAST = "0064e7ce-991a-492b-8e29-afb7acd5aeba"

EDGE_TYPES = frozenset({"LINKED_TO", "MEMBER_OF"})

EDGES = [
    # (neo4j_relationship_id, source, target, type, mirrored, classification, band, status)
    ("rel-e1-phase4", PERSON_ID, ADDR_PROTECTED, "LINKED_TO", True, ClassificationLevel.RESTRICTED_OPERATIONAL, "verified", "verified"),
    ("rel-e2-phase4", PERSON_ID, ADDR_CENTRAL, "LINKED_TO", True, ClassificationLevel.RESTRICTED_OPERATIONAL, "verified", "verified"),
    ("rel-e3-phase4", PERSON_ID, ADDR_EAST, "LINKED_TO", False, None, None, None),
    ("rel-e4-phase4", PERSON_ID, ADDR_EAST, "LINKED_TO", True, ClassificationLevel.RESTRICTED_OPERATIONAL, "probable", "pending"),
    ("rel-e5-phase4", PERSON_ID, ADDR_CENTRAL, "MEMBER_OF", True, ClassificationLevel.PROTECTED, "verified", "verified"),
]

NODES = [
    (PERSON_ID, "person", "Phase4 Protected Person"),
    (ADDR_PROTECTED, "address", "PROTECTED test address"),
    (ADDR_CENTRAL, "address", "Address near Central-North at 77.2100,28.6340"),
    (ADDR_EAST, "address", "Address near East-Industrial at 77.2950,28.6360"),
]


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

        driver = get_driver()
        with driver.session() as session:
            for eid, etype, label in NODES:
                session.run(
                    "MERGE (n:Entity {entity_id: $eid}) "
                    "SET n.entity_type = $etype, n.label = $label",
                    eid=eid,
                    etype=etype,
                    label=label,
                )
            for rid, src, dst, rtype, _mirrored, *_ in EDGES:
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
        for rid, src, dst, rtype, mirrored, classification, band, status_ in EDGES:
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
