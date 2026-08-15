# 006 — Phase 5 scope decisions: attachments, pinned items, Case.address_id

Date: 2026-08-01
Status: Accepted
Applies to: Phase 5 (Case Workspace)

Three scope decisions for Phase 5, recorded together because each is a
"brief-adjacent but not brief-mandated" feature that must not be silently
invented, silently resolved, or silently dropped.

## 1. Attachments: punted this phase

The `POST /cases/{id}/attachments` stub endpoint
(`routers/cases.py`) has nothing behind it — no table, no storage
strategy. Decision: **leave the stub exactly as-is this phase.**

Rationale:
- The PRD never mentions attachments ("attachment" appears zero times).
  The Case Workspace brief scope is pins, notes, and export.
- A faithful implementation (multipart upload, path-traversal/size/MIME
  hardening, gated download endpoint, local-disk storage, migration)
  is a full phase of security-sensitive surface for an unstated
  requirement; S3/cloud storage is an explicit out-of-scope infra
  decision.
- The stub already returns an honest `_stub` shape and its `case:write`
  gate was confirmed in Sprint 1.

Revisit when: the brief is extended, or storage infra is decided.
The stub endpoint code is intentionally untouched — this doc is the
single source of truth for the decision.

## 2. Pinned items / saved case views: out of scope for Phase 5

The PRD (case workspace) asks for "pin items to a case workspace" and
"save a filtered network view to a case". No schema supports either —
they would need a junction table (e.g. case_entities / case_views).
Flagged as explicitly out-of-scope for this phase; not built, not
resolved. If wanted later, it is a new component with a new migration.

## 3. Case.address_id: still open, and create_case will not touch it

The Phase 2 flag (`Case` has no address/zone link used anywhere; the
model has no address_id column at all — the flag referred to a planned
link that was never built) remains an open schema question. This phase
builds `create_case` without populating or depending on any address
link: the created case carries `district_id` (jurisdiction) but no
address/zone linkage. The question stays open for a later phase where
incident location granularity is actually needed.

## 4. Note visibility tiers: minimum-viable enforcement (component 3)

The schema has no case-team membership table, no officer hierarchy
(no `manager_id` on Officer), and no note->approval link (the
AccessExceptionRequest workflow links to cases by string and its
endpoints are stubs). Enforcement therefore uses only real columns, and
each weaker-than-true tier is flagged:

- `private_author` — `note.author_id == viewer.id`. Fully real.
- `case_team` — `viewer.id == case.lead_officer_id OR viewer.id ==
  note.author_id`. This is the only case membership the schema can
  express. **Open schema question:** true case-team membership (multiple
  assigned officers) needs a junction table, same treatment as
  Case.address_id.
- `supervisory_chain` — `viewer.role in (SUPERVISOR, ADMINISTRATOR)`.
  Explicitly weaker than "chain" implies (a chain is per-officer
  ancestry, not a global role check). **Open schema question:** a real
  chain needs an officer hierarchy (manager_id or org table).
- `inter_unit_approved` — anyone who passes the case gate + note tier
  gate (widest tier). **Open question:** an approval gate on setting
  this marker belongs with the AccessExceptionRequest build-out.

Tier gate (note.classification within viewer tiers) dominates all four
visibility tiers, so a PROTECTED inter_unit_approved note is still
invisible to an under-tier viewer. Unknown visibility values in the DB
are fail-closed invisible (creation validates the vocabulary, so the API
never produces them).

## 5. Export: composition over new artifact generation (component 4)

`POST /cases/{id}/export` (gated exactly as the stub had it:
`require_step_up_auth` + `export:case`) now returns a real JSON
document instead of a stub shape. Design decisions:

- **Composition, not a new subsystem.** The document is the case plus
  every note that survives the same case gate + tier gate + visibility
  tier the live GET endpoints enforce (`get_case` + `_visible_notes`
  reused verbatim). No new gating code exists; the export content is
  exactly the workspace content the exporting officer sees (proven by
  test: export notes == GET /notes items, per officer).
- **Record-level redaction is the redaction.** Tier/visibility exclusion
  IS the platform's policy redaction. The per-field
  RedactionPolicyDecision engine is Phase 6 (core/classification.py);
  export does not reach ahead of it.
- **Highest-tier labeling, case included.** `classification` = the
  highest tier of the included content, and the case itself counts: a
  PROTECTED note on a RESTRICTED case labels the document protected;
  a SEALED case with only PROTECTED notes still labels it sealed.
  Neither "max of notes only" nor "case only" is correct.
- **Audit-only-on-success.** Every successful export writes an
  AuditLogEntry (action=export, resource_type=case, resource_id, ip,
  detail carrying export_id/case_number/note-count/classification) using
  the same shape auth_service uses for logins. Failed attempts (403/404/
  422) are rejected before the service and produce no rows — nothing in
  the platform audits failures today.
- **Each export is a distinct audited event** with its own export_id;
  artifact persistence/re-download is explicitly not built (no storage
  subsystem, same rule as attachments).

## 6. Open schema questions and deferred surface: master list

Single reference point for every open item accumulated across the
project; origin docs in parentheses. Grouped by kind:

### Open schema questions (need a migration/schema change to resolve)

1. **Case.address_id / case↔zone linkage** — the model has no address_id
   column; the Phase 2 flag referred to a planned link never built.
   create_case does not populate or depend on it (006 §3).
2. **Real case-team membership** — no junction table; `case_team` is
   minimum-viable as lead-or-author (006 §4). Multiple assigned officers
   need a case_team table.
3. **Real officer hierarchy** — no `manager_id`/org table; the
   `supervisory_chain` note tier is a role-collapse (SUPERVISOR/
   ADMINISTRATOR), weaker than per-officer ancestry (006 §4).
4. **inter_unit approval workflow** — AccessExceptionRequest is now REAL
   (Phase 6 component 4, 009): case-scoped, approve/deny/revoke,
   step-up-gated approval, inline expiry. Still open: it links to cases
   by string and NEVER to notes; `inter_unit_approved` note visibility
   remains the widest tier (case-team gate, 009); case renumbering
   would orphan exceptions (no renumbering path exists). Exception
   scope is CASE-scoped only — district-scoped exceptions were
   deliberately not built (009).

### Scope decisions (closed by decision, not by omission)

5. **Attachments** — zero PRD occurrences; stub left untouched; needs
   storage infra decision to revisit (006 §1).
6. **Pinned items / saved case views** — out of scope; need case_entities
   / case_views junction tables if ever built (006 §2).
7. **Zone scoring** — viability decision recorded, not built (003).

### Deferred engines / seams (explicitly later-phase)

8. **Redaction engine scope (LIVE, confirmed at Phase 6 close-out)** — the
   REAL RedactionPolicyDecision engine (component 3, 008) is used ONLY by
   case export (post-serialize masking + `redact_note_ids` request
   option). Every OTHER read path — dashboard, entity detail, note
   lists, search — uses the coarse classification-tier gate and NEVER
   consults RedactionPolicyDecision. Export with no active rules is
   byte-identical to pre-component-3 behavior (re-verified at
   close-out). Extending the engine to more read paths is open work,
   not a latent bug.
9. **MFA verify** — the challenge endpoint remains an OTP placeholder
   stub. STEP-UP re-auth is REAL since component 1 (001):
   `require_step_up_auth()` performs an actual assertion + same-password
   check and precedes permission checks; export, exception approval and
   similar gates use it. Real MFA (TOTP) remains a Phase 0 seam.
10. **Alerts / alert priority** — REAL since component 2 (007): `alerts`
    table, alert:read/alert:manage, degree-based priority from Neo4j +
    mirrors. Live trigger today: ONLY `confidence_change` (component 6,
    010 — fires on accepted edge/zone-score disputes).
    `resurfaced_offender` and `new_inter_district_link` remain
    schema-supported but UNTRIGGERED — no ingestion path exists to fire
    them (007).
11. **Case status vocabulary** — `{open, closed}` is the minimal
    complement of the only state the brief names ("open"); no wider
    vocabulary exists (006 §2 of this file / component 2 receipts).

### Phase 6 additions (LIVE gaps, not historical notes)

12. **Neo4j edge re-pointing on entity merge — LIVE DEFERRED GAP**
    (component 5, 011). A merge hides the absorbed person's relational
    row (merged_into_id) but does NOT re-point the graph: Neo4j
    relationships keyed by the absorbed entity id remain reachable only
    by that id, which 404s through the REST API. Readers using the
    graph (relationship list via network_service) can still surface
    edges anchored on an absorbed id. Postgres mirrors of those edges
    survive the merge untouched (they are real data) — a confidence
    review against an absorbed entity's edge succeeds (verified at
    close-out: no 404, no crash; the mirror remains the writable
    target). Re-pointing absorbed→primary at graph-query time is open
    work; until then stale graph edges are the documented state.
13. **Confidence review mirror-only write path** (component 6, 010) —
    an accepted dispute updates ONLY the Postgres mirror (score, band,
    verification_status). Verified safe on every CURRENT read path:
    decision 000 removed classification/confidence/verification
    properties from the graph entirely; `network_service._relationship_out`
    reads confidence exclusively from `RelationshipEdgeRef` (checked at
    close-out). No current display can go stale. A future feature that
    stores confidence on Neo4j edges must sync or re-derive it — that
    sync is deferred.
14. **Entity resolution reduced-scope reversal** (component 5, 011) —
    reversal un-marks the merge (visibility pointer) and stamps
    reversed_at; merged FIELD COPIES stay on the primary (no data
    undo). An accidental merge is recovered by reversal + manual split,
    not by an automated inverse.
15. **Redaction scope asymmetry re-stated** — see item 8: engine = export
    only; everything else tier-gated. Kept here too because it is the
    most-cited Phase 6 scope line.
