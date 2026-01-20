# Event Detail Panel Design

## Overview

Add an event detail view on the Measurement Plan page that shows all metrics derived from a selected activity, completing bidirectional metric-event traceability.

## Problem Statement

Users need to understand which metrics were derived from specific activities in their measurement plan. Currently, metrics show their source activity, but there's no way to go the other direction: click an activity and see what metrics it generated.

## Expert Perspectives

### Product
The user's job is to understand which metrics matter for specific business activities they've defined. A direct, explicit reference tells that story clearly without name-matching heuristics that break when activity names diverge. Bidirectional traceability creates "magic moments" where clicking an activity immediately shows which derived metrics are watching it.

### Technical
The schema currently has metrics referencing `stages` (journey stages), not `measurementActivities`. The ideal fix is to refactor `metrics.relatedActivityId` to reference `measurementActivities` directly—the measurement plan is the system of record. However, for this issue, use client-side name matching as a bridge until the schema refactor is complete.

### Simplification Review
The Jobs review suggested removing the detail panel entirely in favor of direct navigation to Metric Catalog. However, the issue requirements explicitly specify a detail panel pattern for consistency with the product's progressive disclosure model. The panel is retained.

Simplifications applied:
- Keep the panel minimal (no redundant activity details already visible in the list)
- Use URL query params for metric navigation (shareable, back-button friendly)
- Document the name-matching bridge as temporary

## Proposed Solution

Add an `ActivityDetailPanel` slide-over component to the Measurement Plan page. When a user clicks an activity, the panel opens showing the activity name and a "Derived Metrics" section listing all metrics generated from that activity. Each metric is clickable, navigating to the Metric Catalog with that metric pre-selected.

### Data Bridging (Temporary)
Until the schema refactor consolidates metrics to reference `measurementActivities`:
1. Query `stages` from the overview journey
2. Match `measurementActivities.name` to `stages.name`
3. Filter `metrics` by matching `relatedActivityId` (stage ID)

This is documented as temporary and will be replaced by direct queries once the schema is updated.

## Design Details

### ActivityDetailPanel Component

Location: `src/components/measurement/ActivityDetailPanel.tsx`

```typescript
interface ActivityDetailPanelProps {
  activity: {
    name: string;
    entityName: string;
    lifecycleSlot: string;
  } | null;
  derivedMetrics: Array<{
    id: Id<"metrics">;
    name: string;
    category: string;
  }>;
  onClose: () => void;
  onMetricClick: (metricId: Id<"metrics">) => void;
}
```

**Sections:**
1. Header: Activity name + close button
2. Derived Metrics list (name, category, chevron)
3. Empty state when no metrics

**Empty State:**
"No metrics derived from this activity yet. Metrics are generated when you complete the journey setup."

### MeasurementPlanPage Changes

1. Add `selectedActivity` state
2. Add queries for `stages` and `metrics`
3. Add `getDerivedMetrics(activityName)` helper
4. Render `ActivityDetailPanel` when activity selected
5. Navigate to `/setup/metric-catalog?metric={id}` on metric click

### MetricCatalogPage Changes

1. Read `metric` query param on mount
2. Initialize `selectedMetricId` from query param if present

## Alternatives Considered

1. **Direct navigation without panel**: Simpler but loses the quick-scan capability. Users would need to navigate away from Measurement Plan just to check derived metrics.

2. **Modal instead of slide-over**: Blocks the view of the measurement plan. Slide-over maintains context.

3. **Inline expansion**: Considered expanding the activity row inline, but derived metrics list could be long and disrupt the plan layout.

## Success Criteria

- User can click any activity and see derived metrics in < 1 second
- Each metric in the panel is clickable and navigates to Metric Catalog
- Empty state is clear when no metrics exist
- Panel can be dismissed easily (close button, escape, click outside)
- URL reflects selected metric for shareability
