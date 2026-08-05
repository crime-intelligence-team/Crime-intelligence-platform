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

Parameterization: every query takes $entity_id / $relationship_id (or the
list variants $entity_ids / $source_ids / $target_ids — see below) and is
executed with bound parameters via session.run() — values are never
string-interpolated. (The one unavoidable inline is the relationship TYPE
in MERGE, a Cypher limitation; those come only from closed constant sets
in our own seed/write code, never from request input.)

Merge clusters (011/999 §2.8): RELATIONSHIPS_OF_ENTITY and
shortest_paths_query take a LIST of entity ids ($entity_ids /
$source_ids / $target_ids), not a single id. A merged person's Neo4j
node is never rewritten (merge stays Postgres-only — no graph write),
so the caller (network_service._merge_cluster_ids) resolves the full set
of physical node ids that represent one logical identity (the surviving
primary plus every person transitively absorbed into it) and passes the
whole set here — this is the "re-point at graph-query time" from 011.
The `NOT m.entity_id IN $entity_ids` guard drops edges strictly between
two members of the same cluster (a stale pre-merge edge between the
primary and its own absorbed twin), since after merging they are one
identity and an edge to "itself" is meaningless.
"""

MAX_PATH_HOPS = 6

RELATIONSHIPS_OF_ENTITY = """
MATCH (n:Entity)-[r]->(m:Entity)
WHERE n.entity_id IN $entity_ids AND NOT m.entity_id IN $entity_ids
RETURN r.neo4j_relationship_id AS relationship_id,
       type(r) AS relationship_type,
       m.entity_id AS endpoint_entity_id,
       m.entity_type AS endpoint_entity_type,
       'outgoing' AS direction
UNION ALL
MATCH (n:Entity)<-[r]-(m:Entity)
WHERE n.entity_id IN $entity_ids AND NOT m.entity_id IN $entity_ids
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
    """allShortestPaths between two entity CLUSTERS, undirected — topology
    only; each edge's true direction (for RelationshipOut's source/target)
    and visibility are reconciled per-edge against the Postgres mirror by
    the caller, exactly as in RELATIONSHIPS_OF_ENTITY/RELATIONSHIP_DETAIL.

    $source_ids/$target_ids are lists (merge clusters — see module
    docstring), not single ids: the pattern matches from any node in the
    source cluster to any node in the target cluster, so a path can start
    or end on either a merge primary or one of its absorbed twins and
    still be found. Caller must ensure the two clusters are disjoint
    (network_service.find_paths short-circuits to [] when source and
    target resolve to the same merged identity — a path to "yourself" is
    meaningless).

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
MATCH (a:Entity), (b:Entity)
WHERE a.entity_id IN $source_ids AND b.entity_id IN $target_ids
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
