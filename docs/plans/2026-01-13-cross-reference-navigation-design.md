# Cross-Reference Navigation Design

## Overview

Add bidirectional navigation between Measurement Plan and Metric Catalog using URL query parameters. Users can explore the relationship between events and metrics by clicking links that preserve selection context.

## Problem Statement

Users need to understand how metrics relate to measurement activities. Currently, these two views are disconnected - you can't easily jump from a metric to see where it's measured, or vice versa.

## Expert Perspectives

### Product
Use name-based linking because users think in terms of activity names, not IDs. The journey stage serves as the natural bridging concept - both metrics and measurement activities derive from it. URL params give us browser back/forward for free, which respects users' mental model of navigation.

### Technical
Both metrics (`relatedActivityId`) and measurementActivities already reference journey stages. No schema changes needed - use name-based matching at the UI layer. Keep navigation logic local to each page component; shared abstractions for 2-3 line operations add indirection without value.

### Simplification Review
**Removed:**
- Shared `useActivityNavigation.ts` hook - unnecessary abstraction
- `activityLookup.ts` helper file - premature abstraction for simple filters
- "View Related Metrics" button on MeasurementPlanPage - browser back button suffices for reverse navigation
- `sourceActivityName` prop on MetricDetailPanel - metric already contains activity context

**Simplified:**
- Unidirectional primary flow: Metric Catalog → Measurement Plan
- Each page handles its own URL params directly
- No new files or abstractions

## Proposed Solution

URL query parameters enable cross-page navigation with selection state preserved. Each page reads its own params on mount and highlights/selects the relevant item.

### URL Patterns
```
/measurement-plan?highlight=User%20Signs%20Up
/metric-catalog?activity=User%20Signs%20Up
```

### Navigation Flow

**Primary: Metric Catalog → Measurement Plan**
1. User selects a metric in MetricCatalogPage
2. MetricDetailPanel shows "View in Measurement Plan" link
3. Link navigates to `/measurement-plan?highlight=${activityName}`
4. MeasurementPlanPage reads param, expands entity, highlights activity

**Secondary: Measurement Plan → Metric Catalog**
1. User clicks activity row in MeasurementPlanPage
2. Row has "View Metrics" action (inline, minimal)
3. Navigates to `/metric-catalog?activity=${activityName}`
4. MetricCatalogPage filters/highlights metrics for that activity

**Browser Navigation**
- URL state enables back/forward to preserve selection
- No additional state management needed

## Design Details

### MeasurementPlanPage Changes
```typescript
// src/routes/MeasurementPlanPage.tsx
const [searchParams] = useSearchParams();
const highlightedActivity = searchParams.get('highlight');

// In EntityCard, auto-expand if contains highlighted activity
// In activity row, add highlight styling when name matches
```

Highlight styling:
```tsx
<div className={cn(
  "px-3 py-2 bg-gray-50 rounded-md",
  activity.name === highlightedActivity && "ring-2 ring-blue-500 bg-blue-50"
)}>
```

### MetricCatalogPage Changes
```typescript
// src/routes/MetricCatalogPage.tsx
const [searchParams, setSearchParams] = useSearchParams();
const activityFilter = searchParams.get('activity');

// Filter metrics to those matching activity (via relatedActivityId → stage name)
// Auto-select first matching metric if activityFilter present
```

### MetricDetailPanel Changes
```tsx
// src/components/metrics/MetricDetailPanel.tsx
// Extract activity name from metric's relatedActivityId by looking up stage

{activityName && (
  <div className="pt-4 border-t">
    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
      Source Activity
    </h4>
    <Link
      to={`/measurement-plan?highlight=${encodeURIComponent(activityName)}`}
      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
    >
      {activityName}
      <ArrowRight className="w-3 h-3" />
    </Link>
  </div>
)}
```

## Alternatives Considered

1. **Database relationship (metrics ↔ measurementActivities)** - Rejected because it requires schema changes and both already reference journey stages. Name-based matching works with existing data.

2. **Shared navigation hook** - Rejected as over-engineering. URL param handling is 2-3 lines per page; abstraction adds indirection without value.

3. **Bidirectional prominent navigation** - Simplified to make Metric Catalog → Measurement Plan the primary path. This matches user mental model (metrics are "what", plan is "where/how").

## Success Criteria

- [ ] Deep link `/measurement-plan?highlight=X` highlights correct activity
- [ ] Deep link `/metric-catalog?activity=X` filters/selects related metrics
- [ ] MetricDetailPanel shows source activity with working link
- [ ] Browser back/forward preserves selection state
- [ ] Non-existent activity in URL degrades gracefully (no selection, no error)
