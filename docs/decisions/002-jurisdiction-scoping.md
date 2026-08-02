# 002 — Jurisdiction scoping for district queries

**Date:** 2026-07-30  
**Component:** District service (`district_service.py`)

## Context

District endpoints need to scope results based on the requesting officer's role and home district. The `Officer` model has `home_district_id`.

## Decision

- **DISTRICT_OFFICER** and **DETECTIVE** — queries are filtered to `officer.home_district_id` only.
- **ANALYST**, **SUPERVISOR**, and **ADMINISTRATOR** — see all districts unfiltered.

This aligns with the permission set those three roles already hold (`dashboard:view`, `risk:view`, `audit:view`), which imply cross-district visibility.

Access exceptions (`AccessExceptionRequest`) are explicitly **out of scope** for this filter. The approval workflow is not yet implemented — there is no working "approved and not expired" query to rely on. Half-implementing exception checking against an incomplete workflow would be worse than not checking at all.

## Implementation

A helper function `get_accessible_district_ids(officer)` returns `None` (meaning "no filter — sees all") for ANALYST/SUPERVISOR/ADMINISTRATOR, or `list[UUID]` of accessible district IDs for DISTRICT_OFFICER/DETECTIVE. This is reusable across all district queries rather than duplicated.

## Consequences

- DISTRICT_OFFICER and DETECTIVE with a null `home_district_id` will see zero districts. This is intentional and will surface misconfigured officers during onboarding.
- The filter is a simple role check, not a table join — cheap to evaluate.
- When the access exception workflow is real, a second filter layer can be added alongside this one without changing the role-based rule.
