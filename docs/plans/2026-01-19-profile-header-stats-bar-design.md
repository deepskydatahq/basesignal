# ProfileHeader Quick Stats Bar Design

## Overview

Add a quick stats bar to ProfileHeader showing three key counts: Metrics, Entities, and Activities. These represent the measurement completeness triangle that product leaders care about.

## Problem Statement

Product leaders need an at-a-glance signal of how complete their measurement setup is. The current "X of Y" completeness text is redundant with the progress bar and doesn't answer the real question: "What have I built?"

## Expert Perspectives

### Product
- Stats should answer the measurement completeness triangle: "What am I measuring?" (Metrics), "Who am I measuring?" (Entities), "How do I know it happened?" (Activities)
- Replace the "X of Y" text since the progress bar already communicates completion visually
- Keep the header compact - one visual row respects user time

### Technical
- Metrics, Entities, and Activities map 1:1 to the core data structures
- Pass full objects to the component, let it extract counts (single source of truth)
- Don't over-engineer with callbacks for navigation that hasn't been validated

### Simplification Review (Jobs Review)
**Verdict: SIMPLIFY**

Removed:
- `onStatClick` callback - navigation is premature, ship stats display first
- Hover affordances - no navigation = no clickable styling needed
- Extracted `stats` prop - pass full objects, let component extract counts

Simplified:
- Stats display only, no navigation infrastructure
- Clean layout without pipe separators

## Proposed Solution

Replace the "X of Y" completeness text with three stat counts, displayed inline with the progress bar.

### Visual Layout

```
[Progress Bar]  5 Metrics · 3 Entities · 12 Activities
```

### Data Sources

| Stat | Source |
|------|--------|
| Metrics | `metricCatalog.totalCount` |
| Entities | `measurementPlan.entities.length` |
| Activities | `measurementPlan.activityCount` |

### Props Update

```typescript
interface ProfileHeaderProps {
  identity: {
    productName: string;
    productDescription?: string;
    hasMultiUserAccounts: boolean;
    businessType?: string;
    revenueModels?: string[];
  };
  completeness: {
    completed: number;
    total: number;
  };
  // Add these - pass full objects, component extracts counts
  metricCatalog: {
    totalCount: number;
  };
  measurementPlan: {
    entities: Array<unknown>;
    activityCount: number;
  };
}
```

### Styling

- Text: `text-sm text-gray-600` (matches existing)
- Separator: centered dot (·) with spacing
- No hover effects or cursor changes (not clickable in v1)

### Empty States

Display zero counts normally: "0 Metrics · 0 Entities · 0 Activities"
- Same visual treatment
- Counts serve as progress indicators - zero is valid state

## Design Details

### Component Changes

**ProfileHeader.tsx:**
1. Add `metricCatalog` and `measurementPlan` to props
2. Replace lines 72-74 (the "X of Y" span) with stats display
3. Extract counts: `metricCatalog.totalCount`, `measurementPlan.entities.length`, `measurementPlan.activityCount`

**ProfilePage.tsx:**
1. Pass `metricCatalog` and `measurementPlan` from `profileData` to ProfileHeader

### Test Coverage

- Renders correct counts from props
- Handles zero counts gracefully
- Displays stats in correct format with separators

## Alternatives Considered

1. **Add stats as a new row below badges** - Rejected: adds height, less compact
2. **Make stats clickable to navigate to sections** - Deferred: validate need first, avoid premature infrastructure
3. **Show stages and properties instead** - Rejected: those are implementation details, not meaningful at a glance
4. **Keep "X of Y" and add stats** - Rejected: redundant with progress bar

## Success Criteria

- [ ] Stats bar displays 3 counts: Metrics, Entities, Activities
- [ ] Values pulled from real data via props
- [ ] Visual design fits cohesively (replaces "X of Y", maintains header height)
- [ ] Zero counts display correctly
- [ ] Tests verify rendering and data binding
