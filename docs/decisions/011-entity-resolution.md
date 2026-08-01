# 011 — Entity resolution (Phase 6 component 5, reduced scope)

Status: accepted (Phase 6)
Date: 2026-08-01

## Decision

A real, auditable person-merge replacing the old admin stubs (which were
removed from admin.py when 010 landed — component 5 gets its own router).

**Reduced scope (signed off)**: Postgres-side merge only; persons only.

- `POST /api/v1/entity-resolution/merge` and
  `POST /api/v1/entity-resolution/merge/{event_id}/reverse`, both gated
  `entity:merge` — a permission held ONLY by ADMINISTRATOR (added at
  Phase 6 close-out to satisfy the every-endpoint-on-require_permissions
  convention; prior to that the endpoints sat on `require_roles(ADMIN)`,
  behavior identical).
- New table `entity_resolution_events` (no kickoff stub existed — this is
  the first genuinely new table of the phase): primary_entity_id,
  absorbed_entity_id, entity_type, performed_by_id, performed_at,
  reversed_at (nullable). Migration `a9c4e8d2f1b5`.
- New visibility pointer `persons.merged_into_id` (nullable FK to
  persons.id): set = absorbed; NULL = independent. Search and detail
  exclude absorbed ROWS (narrow, sanctioned lift in network_service's
  `_entity_union` person branch and `get_entity` person query). The
  absorbed NAME is not lost — it is retained on the surviving record
  (aliases union), so name search still finds the merged identity.

**Protected subjects are hard-blocked as primary OR absorbed** (422
protected_subject_merge_blocked) — checked BEFORE structural checks. The
protection flag can be redacted from lower-tier officers, so no merge may
silently collapse a protected person. Proven with the Phase-4 protected
subject AND a dedicated protected fixture, on both sides.

**Reversal is deliberately limited**: un-marks the merge (clears the
visibility pointer — the absorbed regains independent visibility,
searchable and detail-reachable again) and stamps reversed_at. The
merged FIELD COPIES stay on the primary — no undo of data (documented
limit; an accidental merge is recovered by reversal + a manual split,
not by an automated inverse).

## Inferred rules (flagged — brief 7.8 specifies no conflict rule)

- **Field conflict rule**: per scalar field, non-null wins; if both
  non-null, the more-recently-created record wins (applied to
  date_of_birth). **Aliases are a list-field variant: union, never
  replace** (both names stay searchable). Verified: ["Rajesh V"] ∪
  ["RKV"] and P2's null dob kept P1's 1982-04-11.
- **Classification is never downgraded**: the surviving record takes
  max(primary, absorbed) tier.
- **Entity types**: person only this phase (422 invalid_entity_type for
  anything else — organizations/vehicles have no protected flag and no
  graph story yet; flagged as out of scope).
- Structural guards: primary==absorbed 422; primary is itself absorbed
  422 (primary_already_absorbed); absorbed already merged 422
  (already_merged); nonexistent id 404 entity_not_found; non-admin 403.

## The known gap — graph re-pointing DEFERRED (prominent)

Neo4j re-pointing is **not built this phase**. The graph's relationships
keyed by the absorbed entity id remain: they are reachable via the
absorbed id only, which now 404s at the REST API (the row is hidden).
Readers using the graph for relationship lookups will see stale edges
anchored on a dead entity id; readers using the relational search/detail
see only the survivor. Documented, flagged, deferred to a later phase
that maps absorbed→primary at graph-query time. The verification made
deliberate NO graph fixture for the merged persons, so the stale-edge
behavior is stated but not exercised by real data.

## Verification evidence (real output)

- Gates: supervisor merge 403 role_not_permitted; bad type 422; same id
  422; nonexistent primary/absorbed 404; protected (both fixtures, both
  sides) 422.
- Merge P2→P1 (identical full names, aliases ["Rajesh V"]/["RKV"], dob
  1982-04-11/null): 201; absorbed gone from search (one Rajesh result);
  absorbed detail 404; surviving detail 200 with aliases
  ["Rajesh V","RKV"] and dob 1982-04-11.
- Structural: primary=absorbed-P2 → 422 primary_already_absorbed;
  absorbed=merged-P2 → 422 already_merged; protected+merged → 422
  protected (precedence proven).
- Reversal: supervisor 403; admin 200 reversed; absorbed detail 200 and
  searchable again (2 results); double-reverse 422 already_reversed;
  nonexistent event 404; re-merge after reversal 201.
- Direct DB: 3 event rows (2 reversed, 1 live), absorbed pointer =
  primary id, protected/neutral untouched, audit 5 rows 1:1
  (entity_merge_performed ×3, entity_merge_reversed ×2).
- Network regression (Phase 4 read paths, 15 assertions incl. tier and
  jurisdiction gating) run-to-run identical before and after the
  merged-row exclusion lift — the only read-path change is the absorbed
  row, everything else untouched.

## Known limits (honest)

- Graph re-pointing deferred (above); stale edges by absorbed id are
  reachable only through the graph and 404 through the API.
- No undo of field copies; reversal is visibility-only.
- person-only this phase; organizations/vehicles merge unsupported.
- Merge events are not listable via an endpoint (the table is queryable
  in DB; no read API this phase).
