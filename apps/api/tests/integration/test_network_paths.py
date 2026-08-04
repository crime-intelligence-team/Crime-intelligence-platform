"""Phase 8 component 2: path-finding between two entities
(GET /entities/{id}/paths/{target_id}) against a live Postgres + Neo4j.

Fixture topology (all OPEN_OPERATIONAL, all people):
  Group A (happy path, 2 hops):
    Source -[LINKED_TO, mirrored]-> Mid -[MEMBER_OF, mirrored]-> Target
  Group B (fail-closed): the ONLY connection between GapSource and GapTarget
    is a direct edge with no RelationshipEdgeRef mirror row, so the
    shortest (and only) candidate path is invisible -> [] not a 404.
  Group C: Isolated has no edges at all -> [] (no path exists).
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
                source_identifier=f"path-test-{rid}",
                confidence_score=90,
                confidence_band="verified",
                verification_status="verified",
                classification=ClassificationLevel.OPEN_OPERATIONAL,
            )
        )


@pytest.fixture(scope="module")
def path_fixture():
    db = SessionLocal()
    try:
        source = _get_or_create_person(db, "IT Path Source")
        mid = _get_or_create_person(db, "IT Path Mid")
        target = _get_or_create_person(db, "IT Path Target")
        gap_source = _get_or_create_person(db, "IT Path Gap Source")
        gap_target = _get_or_create_person(db, "IT Path Gap Target")
        isolated = _get_or_create_person(db, "IT Path Isolated")
        db.commit()

        driver = get_driver()
        with driver.session() as session:
            for person, label in [
                (source, "IT Path Source"), (mid, "IT Path Mid"), (target, "IT Path Target"),
                (gap_source, "IT Path Gap Source"), (gap_target, "IT Path Gap Target"),
                (isolated, "IT Path Isolated"),
            ]:
                _merge_node(session, str(person.id), label)
            _merge_edge(session, str(source.id), str(mid.id), "LINKED_TO", "rel-path-a1")
            _merge_edge(session, str(mid.id), str(target.id), "MEMBER_OF", "rel-path-a2")
            _merge_edge(session, str(gap_source.id), str(gap_target.id), "LINKED_TO", "rel-path-gap")

        _ensure_mirror(db, "rel-path-a1")
        _ensure_mirror(db, "rel-path-a2")
        # rel-path-gap deliberately has no mirror row.
        db.commit()

        return {
            "source": str(source.id),
            "mid": str(mid.id),
            "target": str(target.id),
            "gap_source": str(gap_source.id),
            "gap_target": str(gap_target.id),
            "isolated": str(isolated.id),
        }
    finally:
        db.close()


@pytest.fixture(scope="module")
def analyst_headers(c):
    helpers.make_officer("it_path_analyst", Role.ANALYST)
    return helpers.login(c, "it_path_analyst")


def test_shortest_path_found(c, analyst_headers, path_fixture):
    res = c.get(
        f"/api/v1/entities/{path_fixture['source']}/paths/{path_fixture['target']}",
        headers=analyst_headers,
    )
    assert res.status_code == 200
    paths = res.json()
    assert len(paths) == 1
    path = paths[0]
    assert path["length"] == 2
    assert path["source_entity"]["id"] == path_fixture["source"]
    assert path["target_entity"]["id"] == path_fixture["target"]
    rel_ids = [r["id"] for r in path["relationships"]]
    assert rel_ids == ["rel-path-a1", "rel-path-a2"]


def test_path_through_unmirrored_edge_fails_closed(c, analyst_headers, path_fixture):
    res = c.get(
        f"/api/v1/entities/{path_fixture['gap_source']}/paths/{path_fixture['gap_target']}",
        headers=analyst_headers,
    )
    assert res.status_code == 200
    assert res.json() == []


def test_no_path_returns_empty_list(c, analyst_headers, path_fixture):
    res = c.get(
        f"/api/v1/entities/{path_fixture['source']}/paths/{path_fixture['isolated']}",
        headers=analyst_headers,
    )
    assert res.status_code == 200
    assert res.json() == []


def test_same_entity_rejected(c, analyst_headers, path_fixture):
    res = c.get(
        f"/api/v1/entities/{path_fixture['source']}/paths/{path_fixture['source']}",
        headers=analyst_headers,
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "invalid_path_request"


def test_nonexistent_target_returns_404(c, analyst_headers, path_fixture):
    res = c.get(
        f"/api/v1/entities/{path_fixture['source']}/paths/00000000-0000-0000-0000-000000000000",
        headers=analyst_headers,
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "entity_not_found"


def test_max_hops_bounds_enforced(c, analyst_headers, path_fixture):
    res = c.get(
        f"/api/v1/entities/{path_fixture['source']}/paths/{path_fixture['target']}",
        params={"max_hops": 99},
        headers=analyst_headers,
    )
    assert res.status_code == 422
