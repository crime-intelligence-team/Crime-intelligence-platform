# 004 — Dashboard classification gating (redaction-before-aggregation, partial)

Status: accepted (Phase 3)
Date: 2026-07-31

## Decision

Dashboard aggregation (`services/dashboard_service.py`) applies record-level
classification-tier filtering BEFORE every count/aggregation, gated on the
viewing officer's role. This is a partial implementation of brief 7.5's
"redaction filtering must run before aggregation" rule, NOT the full
`RedactionPolicyDecision` engine (deferred to Phase 6).

## What exists vs. what was invented

- Existed: `ClassificationLevel` enum + `CLASSIFICATION_RANK` (models/base.py);
  every sensitive entity carries a `classification` column
  (`ClassificationMixin`, default RESTRICTED_OPERATIONAL).
- Invented: `ROLE_MAX_CLASSIFICATION` — a role -> highest-tier mapping. No such
  mapping existed anywhere in the codebase before Phase 3; permissions.py
  governs actions, not data visibility. This mapping is new policy:

  | Role | Max tier visible in dashboard counts |
  |---|---|
  | DISTRICT_OFFICER | RESTRICTED_OPERATIONAL |
  | DETECTIVE | RESTRICTED_OPERATIONAL |
  | ANALYST | RESTRICTED_OPERATIONAL |
  | SUPERVISOR | PROTECTED |
  | ADMINISTRATOR | SEALED |

  (DISTRICT_OFFICER/DETECTIVE currently lack `dashboard:view`; the entries are
  fail-safe if permissions ever change.)

## Justification of the tier table (inferred, not brief-specified)

The PRD (`docs/prd/crime-intelligence-platform-prd.pdf`) requires access
"permitted by role, jurisdiction, assignment, and data sensitivity" and
"role-based and record-level authorization," but says NOTHING explicit about
which roles may see PROTECTED/SEALED records. The table below is an inferred
interim default, not brief-mandated policy; each row is open to adjustment on
approval.

- RESTRICTED_OPERATIONAL is the ClassificationMixin default tier — the
  "working tier" every record carries unless explicitly raised. Field roles
  (DISTRICT_OFFICER/DETECTIVE) and ANALYST cap there by fail-closed default.
- SUPERVISOR -> PROTECTED: brief describes the role as oversight/coordination
  (broader jurisdiction summaries, priority trends, team outputs), i.e. one
  tier above the working tier. Not SEALED because ADMINISTRATOR is the only
  role holding redaction:manage + classification:override + system:configure —
  the top tier belongs to the tool-owning role.
- ANALYST -> RESTRICTED_OPERATIONAL despite risk:compute/dashboard:view:
  permission strings are action grants, not clearance grants — the brief
  treats action permissions and data sensitivity as separate dimensions.
  Zone scoring also reads no incident data today (decision 003: single
  address-density factor), so analyst risk work needs no PROTECTED case data.
  TRIPWIRE: Revisit ANALYST's tier when Phase 6 introduces Alert/PriorityEntity
  models — if either carries PROTECTED-tier content and ANALYST is expected to
  consume it via dashboard:view, ANALYST's cap must be raised then, not assumed
  correct by default.

## Honest limits (do not imply more safety than exists)

1. This is record-level tier gating. A `RedactionPolicyDecision` that redacts a
   FIELD inside an otherwise-visible record is not applied by this filter —
   nothing in the codebase reads `RedactionPolicyDecision` rows yet. Count
   inference protection holds only at tier boundaries until Phase 6.
2. Per-field redaction gaps are NOT detectable from the dashboard; a later
   Phase 6 filter must slot into the same predicate location
   (`Case.classification.in_(classification_filter(role))`) to close the gap.

## Scope of this decision

- KPIs `total_incidents`, `open_cases`: tier-filtered real counts.
- `active_gangs`, `high_priority_entities`: stubbed 0 (no status/active column
  on Organization, no district_id on Organization, no priority definition).
- Trends 7d/30d/90d: tier-filtered, `COALESCE(source_timestamp, created_at)`,
  complete days only (today excluded — partial-day bucket misreads on a line).
- Hotspots: top-5 districts by trailing-30d incident count within the
  officer's accessible jurisdiction; movement = current window vs prior
  window, strict comparison. District granularity only — Case has no
  zone_id/address_id (see decision 003; Case.address_id change still open).
- `priority_entities`, `alerts`: empty-list stubs (no models exist; Phase 6).
