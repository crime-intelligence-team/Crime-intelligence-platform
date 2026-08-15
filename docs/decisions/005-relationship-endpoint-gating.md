# 005 — Relationship endpoint gating: endpoints need independent visibility checks

Date: 2026-08-01
Status: Accepted
Applies to: Phase 4 component 6 (GET /entities/{id}/relationships, GET /relationships/{id})

## Problem

Reconciling a Neo4j edge against its `RelationshipEdgeRef` mirror row
(class/confidence filter) is not, by itself, sufficient to keep
PROTECTED/SEALED data from leaking through the relationship endpoints.
`RelationshipOut` embeds both endpoints as `EntitySummary` (label +
classification), and the mirror row does not know its own endpoints
(the model has no source/target entity columns — topology lives in the
graph only). A viewer could therefore:

- read a RESTRICTED_OPERATIONAL edge whose *endpoint* is a PROTECTED
  address, and learn the address's label and id;
- read an edge pointing at an entity in a district outside their
  jurisdiction (addresses only — the sole entity type with a
  jurisdiction path).

## Decision

Every endpoint entity referenced by a relationship is resolved in
Postgres and gated *independently* of the edge: record classification
within the viewer's tiers AND (address only) district jurisdiction,
reusing the exact rules of the entity-detail gate (decision 004 +
component 5). An edge whose endpoint is absent, malformed, or invisible
is omitted entirely from list responses and is a 404 on detail —
fail-closed, indistinguishable from "no such relationship".

Consequence: two relationship reads of the same edge can diverge between
viewers not only on the edge's own classification but on each endpoint's
visibility (demonstrated live: analyst sees E2/E4 but not E1, supervisor
sees all four mirrored edges, detective with CEN scope sees only E2).

## Related choice: no classification data in the graph

Neo4j nodes carry only `entity_id`, `entity_type`, `label`; edges only
`neo4j_relationship_id` plus the relationship type. No classification,
confidence, or verification properties exist in the graph. Visibility
metadata is exclusively a Postgres concern (decision 000), so a
compromised or misconfigured graph cannot inject clearance data into
responses. The cost is that the graph alone cannot answer "what is
visible to this viewer" — every read is a round-trip through the mirror.

## Flagged, not fixed: DISTRICT_OFFICER lacks relationship:view

During component 6 testing, the seeded DISTRICT_OFFICER (`officer`) was
expected to see a jurisdiction-gated relationship list but returned 403
`permission_denied` for `relationship:view`. The permission map
(`app/core/permissions.py`) intentionally does not grant
`relationship:view` to DISTRICT_OFFICER (it does grant it to DETECTIVE,
ANALYST, SUPERVISOR, ADMINISTRATOR).

This is likely a policy gap rather than an intent — district officers
work the ground and arguably need to see links between known entities in
their district — but the map is on the project's do-not-touch list, so
it is flagged here for a future policy review, not changed. The
jurisdiction-gated relationship path is exercised in tests through a
seeded DETECTIVE (home district CEN), which has both the permission and
a scope. No code path depends on DISTRICT_OFFICER having the
permission; granting it later is a one-line policy change plus
re-testing.
