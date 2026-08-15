# 001 — DistrictQuickSummary: active_alerts / priority_entities stubbed as 0

**Date:** 2026-07-30  
**Component:** District service (`district_service.py`)

## Context

The `DistrictQuickSummary` schema defines `active_alerts: int` and `priority_entities: int`. No `Alert` or `PriorityEntity` model exists yet — these are planned for Phase 3.

## Decision

Stub both fields as `0` in `get_district_summary()` with a `TODO(Phase 3)` comment. Do not derive them from existing tables (e.g. counting open cases or high-classification entities), because there is no defined business rule for what constitutes a "priority" — any derived value would be arbitrary and would risk conflicting with the real Phase 3 model.

## Consequences

- The frontend will see `0` for these fields until Phase 3 models are built and wired in.
- No false business logic is committed.
- The stubs are trivial to replace when real queries exist.
