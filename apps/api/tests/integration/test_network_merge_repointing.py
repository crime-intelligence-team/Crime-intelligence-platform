"""Neo4j edge re-pointing on entity merge (999 §2.8 / decision 011 gap):
a merged person's Neo4j node is never rewritten (merge stays
Postgres-only), so this proves network_service resolves absorbed->primary
"at graph-query time" instead, against a live Postgres + Neo4j.

Fixture topology (all OPEN_OPERATIONAL, all people), BEFORE merging
AbsorbedA into PrimaryA:
  OtherEntity -[MEMBER_OF, mirrored]-> PrimaryA        (rel-merge-2)
  AbsorbedA   -[LINKED_TO,  mirrored]-> ThirdParty      (rel-merge-1)
  Watcher     -[LINKED_TO,  mirrored]-> AbsorbedA       (rel-merge-3)
  ThirdParty  -[MEMBER_OF,  mirrored]-> PathFar          (rel-merge-4)

After merging AbsorbedA -> PrimaryA (POST /entity-resolution/merge):
  - PrimaryA's relationship list must be the UNION of its own edge
    (rel-merge-2) and BOTH of AbsorbedA's inherited edges — outgoing
    (rel-merge-1) and incoming (rel-merge-3) alike.
  - Watcher's relationship list must show its edge's far endpoint as
    PrimaryA (not AbsorbedA) — an edge landing on an absorbed node is
    re-labeled to the surviving identity wherever it is encountered.
  - GET /entities/{AbsorbedA}/relationships (the old, now-absorbed id)
    transparently resolves to PrimaryA rather than 404ing or showing
    AbsorbedA's own stale identity.
  - A path from PrimaryA to PathFar must exist (2 hops), traversing
    through AbsorbedA's inherited edge then rel-merge-4.
  - A path from PrimaryA to AbsorbedA (now the same logical identity)
    is empty — never a path to "yourself".
"""

import pytest
from sqlalchemy import select

from tests import helpers
from app.core.database import SessionLocal
from app.graph.driver import get_driver
from app.models.base import ClassificationLevel
from app.models.entities import Person, RelationshipEdgeRef, Role

pytestmark = pytest.mark.skipif(
    not helpers.postgres_available() or not helpers.graph_available(),
    reason="Postgres or Neo4j not reachable",
)


def _get_or_create_person(db, full_name: str) -> Person:
    person = db.execute(select(Person).where(Person.full_name == full_name)).scalars().first()
    if person is None:
        person = Person(full_name=full_name, classification=ClassificationLevel.OPEN_OPERATIONAL)
        db.add(person)
        db.flush()
    return person


def _merge_node(session, entity_id: str, label: str):
    session.run(
        "MERGE (n:Entity {entity_id: $eid}) SET n.entity_type = 'person', n.label = $label",
        eid=entity_id, label=label,
    )


def _merge_edge(session, source_id: str, target_id: str, rtype: str, rid: str):
    assert rtype in {"LINKED_TO", "MEMBER_OF"}
    session.run(
        f"MATCH (a:Entity {{entity_id: $a}}), (b:Entity {{entity_id: $b}}) "
        f"MERGE (a)-[r:{rtype} {{neo4j_relationship_id: $rid}}]->(b)",
        a=source_id, b=target_id, rid=rid,
    )


def _ensure_mirror(db, rid: str):
    existing = db.execute(
        select(RelationshipEdgeRef).where(RelationshipEdgeRef.neo4j_relationship_id == rid)
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            RelationshipEdgeRef(
                neo4j_relationship_id=rid,
                source_identifier=f"merge-test-{rid}",
                confidence_score=90,
                confidence_band="verified",
                verification_status="verified",
                classification=ClassificationLevel.OPEN_OPERATIONAL,
            )
        )


@pytest.fixture(scope="module")
def admin_headers(c):
    helpers.make_officer("it_merge_admin", Role.ADMINISTRATOR)
    return helpers.login(c, "it_merge_admin")


@pytest.fixture(scope="module")
def merge_fixture(c, admin_headers):
    db = SessionLocal()
    try:
        primary_a = _get_or_create_person(db, "IT Merge Primary A")
        absorbed_a = _get_or_create_person(db, "IT Merge Absorbed A")
        third_party = _get_or_create_person(db, "IT Merge Third Party")
        other_entity = _get_or_create_person(db, "IT Merge Other Entity")
        watcher = _get_or_create_person(db, "IT Merge Watcher")
        path_far = _get_or_create_person(db, "IT Merge Path Far")
        db.commit()

        driver = get_driver()
        with driver.session() as session:
            for person, label in [
                (primary_a, "IT Merge Primary A"), (absorbed_a, "IT Merge Absorbed A"),
                (third_party, "IT Merge Third Party"), (other_entity, "IT Merge Other Entity"),
                (watcher, "IT Merge Watcher"), (path_far, "IT Merge Path Far"),
            ]:
                _merge_node(session, str(person.id), label)
            _merge_edge(session, str(other_entity.id), str(primary_a.id), "MEMBER_OF", "rel-merge-2")
            _merge_edge(session, str(absorbed_a.id), str(third_party.id), "LINKED_TO", "rel-merge-1")
            _merge_edge(session, str(watcher.id), str(absorbed_a.id), "LINKED_TO", "rel-merge-3")
            _merge_edge(session, str(third_party.id), str(path_far.id), "MEMBER_OF", "rel-merge-4")

        for rid in ("rel-merge-1", "rel-merge-2", "rel-merge-3", "rel-merge-4"):
            _ensure_mirror(db, rid)
        db.commit()

        ids = {
            "primary_a": str(primary_a.id),
            "absorbed_a": str(absorbed_a.id),
            "third_party": str(third_party.id),
            "other_entity": str(other_entity.id),
            "watcher": str(watcher.id),
            "path_far": str(path_far.id),
        }

        # Idempotent across reruns against the same DB: person rows survive
        # by full_name lookup, but a merge is a one-time transition, so
        # only perform it if this pair isn't already merged.
        if absorbed_a.merged_into_id != primary_a.id:
            res = c.post(
                "/api/v1/entity-resolution/merge",
                json={
                    "primary_entity_id": ids["primary_a"],
                    "absorbed_entity_id": ids["absorbed_a"],
                },
                headers=admin_headers,
            )
            assert res.status_code == 201, res.text

        return ids
    finally:
        db.close()


def test_primary_relationships_include_absorbed_edges(c, admin_headers, merge_fixture):
    res = c.get(
        f"/api/v1/entities/{merge_fixture['primary_a']}/relationships",
        headers=admin_headers,
    )
    assert res.status_code == 200
    items = res.json()["items"]
    rel_ids = {r["id"] for r in items}
    assert rel_ids == {"rel-merge-1", "rel-merge-2", "rel-merge-3"}
    outgoing_inherited = next(r for r in items if r["id"] == "rel-merge-1")
    assert outgoing_inherited["source_entity"]["id"] == merge_fixture["primary_a"]
    incoming_inherited = next(r for r in items if r["id"] == "rel-merge-3")
    assert incoming_inherited["target_entity"]["id"] == merge_fixture["primary_a"]
    assert incoming_inherited["target_entity"]["id"] != merge_fixture["absorbed_a"]


def test_other_side_edge_relabeled_to_primary(c, admin_headers, merge_fixture):
    res = c.get(
        f"/api/v1/entities/{merge_fixture['watcher']}/relationships",
        headers=admin_headers,
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == "rel-merge-3"
    assert items[0]["target_entity"]["id"] == merge_fixture["primary_a"]


def test_absorbed_id_relationships_resolve_to_primary(c, admin_headers, merge_fixture):
    res = c.get(
        f"/api/v1/entities/{merge_fixture['absorbed_a']}/relationships",
        headers=admin_headers,
    )
    assert res.status_code == 200
    body = res.json()
    rel_ids = {r["id"] for r in body["items"]}
    assert rel_ids == {"rel-merge-1", "rel-merge-2", "rel-merge-3"}


def test_path_through_inherited_edge_found(c, admin_headers, merge_fixture):
    res = c.get(
        f"/api/v1/entities/{merge_fixture['primary_a']}/paths/{merge_fixture['path_far']}",
        headers=admin_headers,
    )
    assert res.status_code == 200
    paths = res.json()
    assert len(paths) == 1
    assert paths[0]["length"] == 2
    rel_ids = [r["id"] for r in paths[0]["relationships"]]
    assert rel_ids == ["rel-merge-1", "rel-merge-4"]


def test_path_to_own_absorbed_twin_is_empty(c, admin_headers, merge_fixture):
    res = c.get(
        f"/api/v1/entities/{merge_fixture['primary_a']}/paths/{merge_fixture['absorbed_a']}",
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json() == []
