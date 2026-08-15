"""Phase 8 component 1: server-side relationship filtering on
GET /entities/{id}/relationships (relationship_type, confidence_band,
effective_from/effective_to) against a live Postgres + Neo4j.

Fixture topology (source -> target, all OPEN_OPERATIONAL so an analyst sees
everything and only the filters under test decide what surfaces):
  rel-filter-1  LINKED_TO   verified     effective_from=2020-01-01
  rel-filter-2  MEMBER_OF   probable     effective_from=2023-06-15
  rel-filter-3  LINKED_TO   unconfirmed  effective_from=None
"""

from datetime import datetime, timezone

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

EDGES = [
    # (neo4j_relationship_id, target_label, type, band, score, effective_from)
    ("rel-filter-1", "IT Network Filter Target A", "LINKED_TO", "verified", 90,
     datetime(2020, 1, 1, tzinfo=timezone.utc)),
    ("rel-filter-2", "IT Network Filter Target B", "MEMBER_OF", "probable", 60,
     datetime(2023, 6, 15, tzinfo=timezone.utc)),
    ("rel-filter-3", "IT Network Filter Target C", "LINKED_TO", "unconfirmed", 30,
     None),
]


@pytest.fixture(scope="module")
def filter_fixture():
    db = SessionLocal()
    try:
        source = db.execute(
            select(Person).where(Person.full_name == "IT Network Filter Source")
        ).scalars().first()
        if source is None:
            source = Person(
                full_name="IT Network Filter Source",
                classification=ClassificationLevel.OPEN_OPERATIONAL,
            )
            db.add(source)
            db.flush()

        targets = {}
        for rid, label, *_ in EDGES:
            person = db.execute(
                select(Person).where(Person.full_name == label)
            ).scalars().first()
            if person is None:
                person = Person(
                    full_name=label, classification=ClassificationLevel.OPEN_OPERATIONAL
                )
                db.add(person)
                db.flush()
            targets[rid] = person
        db.commit()

        driver = get_driver()
        with driver.session() as session:
            session.run(
                "MERGE (n:Entity {entity_id: $eid}) "
                "SET n.entity_type = 'person', n.label = $label",
                eid=str(source.id), label=source.full_name,
            )
            for rid, label, rtype, *_ in EDGES:
                target = targets[rid]
                session.run(
                    "MERGE (n:Entity {entity_id: $eid}) "
                    "SET n.entity_type = 'person', n.label = $label",
                    eid=str(target.id), label=label,
                )
                assert rtype in {"LINKED_TO", "MEMBER_OF"}
                session.run(
                    f"MATCH (a:Entity {{entity_id: $a}}), (b:Entity {{entity_id: $b}}) "
                    f"MERGE (a)-[r:{rtype} {{neo4j_relationship_id: $rid}}]->(b)",
                    a=str(source.id), b=str(target.id), rid=rid,
                )

        for rid, _label, _rtype, band, score, eff_from in EDGES:
            existing = db.execute(
                select(RelationshipEdgeRef).where(
                    RelationshipEdgeRef.neo4j_relationship_id == rid
                )
            ).scalar_one_or_none()
            if existing is None:
                db.add(
                    RelationshipEdgeRef(
                        neo4j_relationship_id=rid,
                        source_identifier=f"filter-test-{rid}",
                        confidence_score=score,
                        confidence_band=band,
                        verification_status=band,
                        effective_from=eff_from,
                        effective_to=None,
                        classification=ClassificationLevel.OPEN_OPERATIONAL,
                    )
                )
        db.commit()

        return str(source.id)
    finally:
        db.close()


@pytest.fixture(scope="module")
def analyst_headers(c):
    helpers.make_officer("it_network_analyst", Role.ANALYST)
    return helpers.login(c, "it_network_analyst")


def _rel_ids(body) -> set[str]:
    return {item["id"] for item in body["items"]}


def test_no_filters_returns_all(c, analyst_headers, filter_fixture):
    res = c.get(
        f"/api/v1/entities/{filter_fixture}/relationships",
        headers=analyst_headers,
    )
    assert res.status_code == 200
    assert _rel_ids(res.json()) == {"rel-filter-1", "rel-filter-2", "rel-filter-3"}


def test_relationship_type_filter(c, analyst_headers, filter_fixture):
    res = c.get(
        f"/api/v1/entities/{filter_fixture}/relationships",
        params={"relationship_type": "LINKED_TO"},
        headers=analyst_headers,
    )
    assert res.status_code == 200
    assert _rel_ids(res.json()) == {"rel-filter-1", "rel-filter-3"}


def test_confidence_band_filter(c, analyst_headers, filter_fixture):
    res = c.get(
        f"/api/v1/entities/{filter_fixture}/relationships",
        params={"confidence_band": "verified,probable"},
        headers=analyst_headers,
    )
    assert res.status_code == 200
    assert _rel_ids(res.json()) == {"rel-filter-1", "rel-filter-2"}


def test_confidence_band_invalid_rejected(c, analyst_headers, filter_fixture):
    res = c.get(
        f"/api/v1/entities/{filter_fixture}/relationships",
        params={"confidence_band": "gibberish"},
        headers=analyst_headers,
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "invalid_confidence_band"


def test_effective_from_excludes_undated_edge(c, analyst_headers, filter_fixture):
    res = c.get(
        f"/api/v1/entities/{filter_fixture}/relationships",
        params={"effective_from": "2022-01-01"},
        headers=analyst_headers,
    )
    assert res.status_code == 200
    assert _rel_ids(res.json()) == {"rel-filter-2"}


def test_effective_date_range(c, analyst_headers, filter_fixture):
    res = c.get(
        f"/api/v1/entities/{filter_fixture}/relationships",
        params={"effective_from": "2019-01-01", "effective_to": "2021-01-01"},
        headers=analyst_headers,
    )
    assert res.status_code == 200
    assert _rel_ids(res.json()) == {"rel-filter-1"}


def test_inverted_date_range_rejected(c, analyst_headers, filter_fixture):
    res = c.get(
        f"/api/v1/entities/{filter_fixture}/relationships",
        params={"effective_from": "2024-01-01", "effective_to": "2020-01-01"},
        headers=analyst_headers,
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "invalid_date_range"
