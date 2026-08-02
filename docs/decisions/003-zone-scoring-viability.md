# 003 — Zone risk scoring: factor viability and the Case.address_id gap

**Date:** 2026-07-30  
**Component:** Zone risk scoring (`risk_service.py`)

## Context

Zone risk scoring needs real, zone-granularity signals. Seven factors were initially proposed, five of which claimed to match Case/Person records to zones via point-in-polygon on `addresses.geocoded_point`.

## What is actually queryable at zone granularity today

Verified against `entities.py`:

- `Case` has `district_id` → `districts.id` only. No address/zone link.
- `Person` has no location field at all.
- `Address` has `district_id` and `geocoded_point`, but no back-reference to Case or Person.
- `Zone.geometry` exists (POLYGON, SRID 4326); the only spatial join possible is `ST_Contains(zone.geometry, addresses.geocoded_point)`.

## Why five of seven factors were rejected

"Open case density", "recent incident recency", "persons of interest density", "protected subject presence", and "high-severity case share" all require a Case→Address or Person→Address join that **does not exist**. Matching at `Case.district_id == Zone.district_id` would make every zone in a district score identically — a district-level proxy dressed up as a zone-level signal. Rejected for that reason.

## Decision

Build zone scoring on genuinely zone-level data only:

- Address density within zone geometry
- Zone geometry area / density normalization
- Derived density ratio

District-level proxies are explicitly out of scope until the schema change below lands. Scores computed from density-only inputs are provisional: the `recommended_interpretation` field and `top_factors` descriptions must say so plainly, and the confidence band must be capped at `probable` (never `verified`) until real case/incident data feeds in.

## Open, approved-later schema change

Adding `Case.address_id` (FK → `addresses.id`) and a Person location path is an **open schema change** requiring explicit approval before implementation. Until it lands, zone scoring reflects zone density, not crime activity.
