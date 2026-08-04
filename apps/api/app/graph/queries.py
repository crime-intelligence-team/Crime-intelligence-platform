"""Cypher queries for the Neo4j graph layer (Phase 4).

Graph conventions (defined by our own writes; the graph starts empty):
- nodes: single label :Entity; properties entity_id (uuid string),
  entity_type ("person"|"organization"|"vehicle"|"device"|"address"),
  label (display label)
- edges: the relationship type IS the domain type (e.g. LINKED_TO,
  MEMBER_OF); the edge property neo4j_relationship_id equals
  RelationshipEdgeRef.neo4j_relationship_id in Postgres, which is also the
  API-facing relationship id (schemas.network.RelationshipOut)
- NO classification/confidence/verification properties anywhere in the
  graph: visibility metadata comes exclusively from the Postgres mirror
  (decision 000). Neo4j supplies topology only.

Parameterization: every query takes $entity_id / $relationship_id and is
executed with bound parameters via session.run() — values are never
string-interpolated. (The one unavoidable inline is the relationship TYPE
in MERGE, a Cypher limitation; those come only from closed constant sets
in our own seed/write code, never from request input.)
"""

MAX_PATH_HOPS = 6

RELATIONSHIPS_OF_ENTITY = """
MATCH (n:Entity {entity_id: $entity_id})-[r]->(m:Entity)
RETURN r.neo4j_relationship_id AS relationship_id,
       type(r) AS relationship_type,
       m.entity_id AS endpoint_entity_id,
       m.entity_type AS endpoint_entity_type,
       'outgoing' AS direction
UNION ALL
MATCH (n:Entity {entity_id: $entity_id})<-[r]-(m:Entity)
RETURN r.neo4j_relationship_id AS relationship_id,
       type(r) AS relationship_type,
       m.entity_id AS endpoint_entity_id,
       m.entity_type AS endpoint_entity_type,
       'incoming' AS direction
"""

RELATIONSHIP_DETAIL = """
MATCH (a:Entity)-[r]->(b:Entity)
WHERE r.neo4j_relationship_id = $relationship_id
RETURN a.entity_id AS source_entity_id,
       a.entity_type AS source_entity_type,
       b.entity_id AS target_entity_id,
       b.entity_type AS target_entity_type,
       type(r) AS relationship_type
"""


def shortest_paths_query(max_hops: int) -> str:
    """allShortestPaths between two entities, undirected — topology only;
    each edge's true direction (for RelationshipOut's source/target) and
    visibility are reconciled per-edge against the Postgres mirror by the
    caller, exactly as in RELATIONSHIPS_OF_ENTITY/RELATIONSHIP_DETAIL.

    max_hops CANNOT be a bound parameter: Cypher's variable-length
    relationship bound (`[*..N]`) must be a literal, the same limitation
    that already forces the relationship TYPE inline in MERGE elsewhere in
    this module. This function only asserts the closed 1..MAX_PATH_HOPS
    range (it does not clamp) — callers must validate/clamp max_hops
    themselves before calling, so a value can never reach the f-string
    from unvalidated request input.
    """
    assert 1 <= max_hops <= MAX_PATH_HOPS, f"max_hops must be 1..{MAX_PATH_HOPS}"
    return f"""
MATCH (a:Entity {{entity_id: $source_id}}), (b:Entity {{entity_id: $target_id}})
MATCH p = allShortestPaths((a)-[*..{max_hops}]-(b))
RETURN [r IN relationships(p) |
    {{
        relationship_id: r.neo4j_relationship_id,
        relationship_type: type(r),
        source_entity_id: startNode(r).entity_id,
        source_entity_type: startNode(r).entity_type,
        target_entity_id: endNode(r).entity_id,
        target_entity_type: endNode(r).entity_type
    }}
] AS edges
LIMIT $limit
"""
