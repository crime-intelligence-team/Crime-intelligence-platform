# 007 — Phase 6 scope: Alert + PriorityEntity schema (component 2)

Date: 2026-08-01
Status: Accepted (sign-off on substance; degree-signal mechanism corrected
below after the fact, no behavior change to the approved definition)
Applies to: Phase 6 (Governance Workflows)

## 1. Alert vocabulary — verified against the actual brief, not the stub

The `schemas/dashboard.py` stub carried four `type` values. Verification
against the PRD text (the same method used for "attachment" and case
status):

| Stub value | Brief evidence | Verdict |
|---|---|---|
| `resurfaced_offender` | PRD line 180: "resurfacing offenders" | brief-derived |
| `new_inter_district_link` | PRD line 180: "new cross-district links" | brief-derived |
| `confidence_change` | none; closest is line 180 "significant changes" | **inferred interpretation** |
| `case_escalation` | zero hits ("escalat" nowhere in PRD) | **not brief-derived — DROPPED** |

Final vocabulary: `{resurfaced_offender, new_inter_district_link,
confidence_change}`. Alerts table migrated (alembic `b3a7c11e4d92`).

**Triggers — honest per type:** `confidence_change` gains a real write
path in component 6 (fires on an accepted confidence dispute).
`new_inter_district_link` needs an edge-creation/ingestion path that
does not exist (graph is seeded); `resurfaced_offender` needs temporal
activity data that does not exist. Those two types are schema-supported
but not yet generated — same treatment as repeat_offender below.

**Serving:** `GET /alerts` (tier + jurisdiction gated, `alert:read`
permission added additively to ANALYST/SUPERVISOR/ADMINISTRATOR — the
same roles holding `dashboard:view`). `dashboard_service.py` remains
untouched; its stub fields stay stubbed (sign-off answer 4).

## 2. PriorityEntity — computable definition, computed-on-read

Brief line 174 names the content: "High-priority criminals, gangs,
repeat offenders, linked vehicles, and phones." Nothing defines
"high-priority" operationally.

Signals (computed on read, never stored — no refresh job, consistent
with the project's deferred-background pattern):

1. `Person.is_protected_subject = 1` — sensitive-tag proxy (PRD
   line 486). Rank 0.
2. ≥ 1 relationship edge whose mirror row references an **open** case.
   Rank 1.
3. relationship degree ≥ `PRIORITY_DEGREE_THRESHOLD` (named config
   constant, value 3 — **inferred**, the brief is silent; logged here
   as such). Rank 2.

Entities with none of the three are not priority. Rank order protected >
case-linked > degree; deterministic tie-break; one entry per entity.

Type handling: `person`, `gang` (`Organization.org_type = 'gang'`),
`vehicle`, `device` are computable. `repeat_offender` is kept in the
vocabulary as **defined but currently non-computable** (no arrest/
repeat data exists anywhere — there is no incidents table) — same
treatment as the dashboard's active_gangs stubs, not silently removed.
`address` is dropped from priority: PRD line 174 does not include it
(Location Intelligence's "hot streets" territory, a different concept).

## 3. Mechanism correction (after sign-off) — no behavior change

The approved degree/case-linked signals were originally described as
computable from mirror rows alone. **Falsified by inspection:**
`RelationshipEdgeRef` carries no endpoint columns —
`source_identifier` is an opaque provenance string (seeded values like
`phase4-seed-rel-e1-phase4`), not an entity reference; endpoints live
only in Neo4j (node `entity_id` = entity row UUID).

Corrected mechanism, same signals: per candidate entity, traverse the
graph with the existing `RELATIONSHIPS_OF_ENTITY` query (no changes to
the do-not-touch graph layer), batch-lookup mirrors by
`neo4j_relationship_id`, evaluate signals. Cost: one traversal per
candidate entity — acceptable at current dataset size; a single
aggregate degree query would need a new Cypher in `graph/queries.py`
and is deliberately not requested this phase.

**Graph-down behavior:** fail-closed 503 `graph_unavailable` (same as
the relationship endpoints) — a degraded priority list would silently
omit the linked-entity signals, which is worse than an error.

## 4. Reused seams

- `GET /priority-entities` serves the computed list (same `alert:read`
  gate, same pagination envelope).
- Schema: `PriorityEntity` read shape reused as-is
  (`schemas/dashboard.py`); `Alert` read shape extended with nullable
  `entity_type`/`entity_id`/`district_id` (the dashboard stub predates
  the real table and constructs no Alert objects, so nothing breaks).
- Alert `district_id` is the subject's district (jurisdiction gate);
  NULL-district alerts are invisible to jurisdiction-scoped officers
  (nothing to scope against — same semantics as cases). Cross-district
  alert pairs (two districts on one alert) remain an open question
  (006 §6-style flag).
- No read/unread status field: the brief never names one.
