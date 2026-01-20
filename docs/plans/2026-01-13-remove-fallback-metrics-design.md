# Remove Fallback Metrics Design

## Overview

Remove generic "best practice" fallback metrics that lack event grounding. All metrics must derive from actual activities in the user's journey. Auto-select source activities from existing lifecycle signals, fail explicitly when required activities are missing.

## Problem Statement

Currently, `METRIC_TEMPLATES` generates metrics like "New Users", "MAU", "DAU" as defaults without mapping them to specific measurement activities. This creates inconsistency: some metrics have sources, some don't. Users can't trace where metrics come from.

## Expert Perspectives

### Product
- Metrics should require explicit activity selection for engagement (MAU, DAU, retention)
- Auto-select using `lifecycleSlot=core_usage` with transparency about the choice
- Missing activity should be a "teachable moment" prompting creation, not silent failure
- Treat metrics as regenerable artifacts, not precious user configs

### Technical
- Generic metrics without defined "active" action are unfalsifiable - can't trace, test, or defend
- Existing generation already checks for stages - make skip/block logic explicit
- Eliminate fallback strings that hide problems
- One activity reference field, not parallel fields

### Simplification Review
- Removed: MigrationBanner component (just regenerate cleanly)
- Removed: "Change source" dropdown (premature, add later if needed)
- Removed: Expansion of lifecycleSlot vocabulary (speculative)
- Simplified: Use existing `relatedActivityId` field, rename if needed
- Simplified: Surface errors via page error state, not dedicated components
- Simplified: Explicit skip/block in generation, no nested conditionals

## Proposed Solution

### Core Principle
Metrics either have a valid source activity or don't exist. No placeholders, no fallbacks, no orphans.

### Generation Rules by Metric Type

| Metric Type | Required Activity | If Missing |
|-------------|-------------------|------------|
| **Reach** (New Users) | None | Generate unconditionally |
| **Engagement** (MAU, DAU, DAU/MAU, 7-Day Retention) | `core_usage` stage | Skip silently - don't generate |
| **First Value** (Activation Rate, Time to First Value) | `activation` stage | Block with error prompting activity creation |

### Auto-Selection Logic
1. Query for stage with `lifecycleSlot=core_usage`
2. If found, use as source for engagement metrics
3. Query for stage with `lifecycleSlot=activation` or `isFirstValue=true`
4. If found, use as source for first value metrics
5. Display source activity name on metric card

## Design Details

### Schema Changes

```typescript
// metrics table - ensure relatedActivityId is used consistently
metrics: defineTable({
  journeyId: v.id("journeys"),
  name: v.string(),
  description: v.string(),
  formula: v.string(),
  unit: v.string(),
  pnlLayer: v.string(),
  relatedActivityId: v.optional(v.id("stages")), // Source activity
  templateKey: v.optional(v.string()), // For deduplication
})
```

No new fields needed. `relatedActivityId` already exists and points to stages.

### Generation Logic Changes

**In `generateFromOverview`:**
```typescript
// Find core_usage stage
const coreUsageStage = stages.find(s => s.lifecycleSlot === "core_usage");

// Engagement metrics: require core_usage
if (!coreUsageStage) {
  // Skip engagement metrics entirely - don't generate MAU/DAU/retention
  console.log("No core_usage stage - skipping engagement metrics");
} else {
  // Generate engagement metrics with coreUsageStage._id as relatedActivityId
  await createMetric({
    name: `${coreUsageStage.name} - Monthly Active Users`,
    relatedActivityId: coreUsageStage._id,
    // ...
  });
}

// Reach metrics: generate unconditionally
await createMetric({ name: "New Users", /* no relatedActivityId needed */ });
```

**In `generateFromFirstValue`:**
```typescript
const activationStage = stages.find(s =>
  s.lifecycleSlot === "activation" || s.isFirstValue
);

if (!activationStage) {
  throw new Error(
    "Cannot generate activation metrics: No first value activity defined. " +
    "Complete the First Value interview to define your activation moment."
  );
}

// Generate with source linked
await createMetric({
  name: "Activation Rate",
  relatedActivityId: activationStage._id,
  // ...
});
```

### UI Changes

1. **Metric card shows source**: Display "Based on: [Activity Name]" below metric name
2. **Error state**: When generation fails due to missing activity, show banner with link to relevant interview
3. **No migration UI**: Existing metrics regenerate on next cycle with new rules

### Migration Path

1. Existing metrics without proper source: Become stale
2. Next regeneration applies new rules
3. Metrics either get linked to activities or don't generate
4. No user-facing migration flow needed - just works

## Alternatives Considered

1. **Keep fallback templates with warning** - Rejected: Perpetuates the problem, users ignore warnings
2. **Require all activities upfront** - Rejected: Too much friction, blocks progress
3. **Placeholder metrics awaiting linkage** - Rejected: Adds complexity, metrics should just exist or not

## Success Criteria

- [ ] No metrics exist without `relatedActivityId` (except reach metrics)
- [ ] Engagement metrics only generate when `core_usage` stage exists
- [ ] First value metrics error clearly when activation stage missing
- [ ] Metric cards display their source activity
- [ ] Regeneration cleans up orphaned metrics
