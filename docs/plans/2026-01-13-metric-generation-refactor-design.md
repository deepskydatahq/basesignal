# Metric Generation Refactor Design

## Overview
Refactor metric generation to use measurementActivities as the single source of truth instead of stages. Each generated metric will store a `sourceActivityId` linking directly to the measurement activity (event) it measures.

## Problem Statement
Currently, metrics link to `stages._id` (journey visualization nodes) via `relatedActivityId`. This creates confusion because stages represent the user's mental P&L model, while measurementActivities represent the actual events to measure. Metrics should trace to concrete events, not abstract design nodes.

## Expert Perspectives

### Product
- The three-step flow (journey completion → measurement plan import → metric generation) is sound and should be enforced
- Metric generation should be read-only - if activities don't exist, that's a data integrity issue signaling incomplete setup
- Users should explicitly decide which activities to import before metrics are generated

### Technical
- Require measurementActivities to pre-exist; don't create on-demand
- Clean break preferred over backward compatibility - dual columns add permanent complexity
- Query by `lifecycleSlot` for consistency across the system
- Tests should create measurementActivities directly, reflecting the actual production flow

### Simplification Review
**Removed:**
- Migration script - just delete `relatedActivityId` and regenerate metrics (they're generated, not user-created)
- Explicit lifecycleSlot→metric type derivation layer - this is already implicit in template selection
- Dual-source generation - metrics should ONLY come from measurementActivities, not stages

**Simplified:**
- Single source of truth: measurementActivities drives metric generation exclusively
- No backward compatibility shims - clean schema change

## Proposed Solution

### Schema Change
Replace `relatedActivityId: v.optional(v.id("stages"))` with `sourceActivityId: v.id("measurementActivities")` in the metrics table.

### Generation Logic
Both `generateFromOverview` and `generateFromFirstValue` will:
1. Query measurementActivities by journeyId (and lifecycleSlot where applicable)
2. Generate metrics using existing template system
3. Store `sourceActivityId` on each generated metric

### No Migration Script
Since metrics are generated (not user-created), the migration is:
1. Change schema
2. Delete existing metrics (optional, or let them fail validation)
3. Regenerate from measurementActivities

## Design Details

### Files to Change

**convex/schema.ts**
- Change metrics table: `relatedActivityId` → `sourceActivityId: v.id("measurementActivities")`

**convex/metricCatalog.ts**
- `generateFromOverview`: Query measurementActivities instead of stages, use activity._id for sourceActivityId
- `generateFromFirstValue`: Query measurementActivities where lifecycleSlot === "activation", use activity._id

**convex/metricCatalog.test.ts**
- Update test setup to create measurementActivities directly
- Remove stage creation from test fixtures
- Verify sourceActivityId links correctly

## Alternatives Considered

1. **Keep both relatedActivityId and sourceActivityId** - Rejected: adds permanent complexity with conditional logic everywhere
2. **Create measurementActivities on-demand** - Rejected: hides data integrity issues and makes generation non-deterministic
3. **Use isFirstValue flag instead of lifecycleSlot** - Rejected: lifecycleSlot is more semantic and consistent

## Success Criteria
- [ ] Metrics table has `sourceActivityId` linking to `measurementActivities`
- [ ] `generateFromOverview` and `generateFromFirstValue` query measurementActivities
- [ ] Each generated metric traces directly to its source event via sourceActivityId
- [ ] Tests pass using direct measurementActivity creation
