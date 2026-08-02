# 000 — Graph store split: Neo4j source of truth, Postgres mirror

**Date:** 2026-07-11 (originally implicit; written up 2026-07-31)
**Status:** accepted (Phase 0 decision, formally documented during Phase 4)
**Component:** Graph store architecture (`RelationshipEdgeRef` in
`app/models/entities.py`; `app/graph/driver.py`)

## Context

The platform maintains criminal-entity relationships (person↔gang, person↔person,
person↔incident, etc.) in Neo4j. Postgres is the relational/classified store for all
entities. From Phase 0 the design has been: **Neo4j is the source of truth for graph
edges; Postgres holds a mirror row per edge** (`RelationshipEdgeRef`) carrying the
classification/confidence metadata that relational queries need.

This decision was previously only implicit in `entities.py`'s docstring
("the edge lives primarily in Neo4j, this row is the Postgres-side pointer used for
classification/confidence filtering in relational queries") and in chat history. This
document formalizes it and records the read-side reconciliation rule that Phase 4
defines.

## Decision

1. **Neo4j is the source of truth for edge existence and shape.** Which nodes connect
   to which, and the Neo4j edge ID, live in Neo4j. Cypher is the only traversal
   mechanism.
2. **Postgres `RelationshipEdgeRef` is the enforcement layer.** Classification tier,
   confidence band, and verification status for an edge come only from the mirror row.
   Neo4j is never trusted alone for what a viewer is allowed to see.
3. **Read-side reconciliation (Phase 4 rule):**
   - Neo4j supplies traversal/shape only: candidate edges + their Neo4j edge IDs.
   - Postgres decides visibility: each candidate edge is looked up in
     `RelationshipEdgeRef` by `neo4j_relationship_id`, tier-filtered against the
     viewer's classification entitlement, then enriched with
     confidence/classification from the mirror row.
   - **Fail-closed on missing mirror:** an edge present in Neo4j with no
     `RelationshipEdgeRef` row is treated as absent — an unclassified edge cannot be
     shown to anyone. It is never surfaced with default metadata.
   - **Postgres wins on disagreement:** if the mirror row classifies an edge
     PROTECTED/SEALED (or otherwise above the viewer's tier), the edge is filtered
     out of traversal results — the raw edge in Neo4j does not leak.

## Write path (deferred — no create endpoint until after Phase 4)

Chosen design, **not yet implemented**: application-layer dual write.

- On relationship creation: write Neo4j edge first, then insert the
  `RelationshipEdgeRef` mirror row in the same request.
- Compensation for partial failure (two databases, no distributed transaction):
  if the Postgres insert fails after the Neo4j write succeeded, best-effort delete
  the just-created Neo4j edge and return 500. A lost edge is safer than an
  unclassified edge.
- Explicitly rejected for now: Postgres-first writes with background reconciliation
  to Neo4j — introduces an async job class of problem not appropriate to build
  before a write endpoint exists.

## Consequences

- Every relationship read is a two-store operation: Cypher for shape, Postgres for
  gate. Cost is one extra indexed lookup per batch of edge IDs.
- The fail-closed rule means ingestion must create both the Neo4j edge and its mirror
  row atomically (per the write path above) or the edge is invisible until the mirror
  exists.
- `relationship:view` permission still gates the endpoint layer; this decision governs
  record-level enforcement inside it.
