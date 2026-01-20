# MetricCatalogSection Design

## Overview

A profile section component that displays a summary view of the user's metric catalog grouped by category, with a link to the full catalog page.

## Problem Statement

Users on the Profile Home Page need a quick summary of their metric coverage across P&L categories without navigating to the full metric catalog.

## Expert Perspectives

### Product
- Focus on the 4 existing MetricCategory values (reach, engagement, value_delivery, value_capture) - the wireframe's 5-column layout was a visual concept, not a data model change
- Use stacked vertical list layout - profile page is single-column, users are scanning coverage not comparing side-by-side
- Keep it minimal - this is a summary view with a link to dig deeper

### Technical
- Use existing `api.metrics.list` query and `CATEGORY_INFO` from metricTemplates.ts
- Vertical list handles variable metric counts per category gracefully
- Inline placeholder styling now, refactor to ProfileSection wrapper when that component exists

### Simplification Review
After Jobs-style review, the following was cut:
- **Removed `groupMetricsByCategory` helper** - Component receives metrics as props from ProfilePage (avoids redundant queries)
- **Simplified to pure view component** - Receives `metrics` prop, doesn't own data fetching
- **Streamlined empty state** - Binary has-metrics/no-metrics, no elaborate messaging
- **Clarified ProfileSection dependency** - Use inline styling; ProfileSection integration is a separate refactor

## Proposed Solution

MetricCatalogSection is a **pure view component** that:
1. Receives `metrics` array as a prop from ProfilePage
2. Groups metrics by the 4 existing categories
3. Renders a stacked vertical list with category headers
4. Shows total count in header and "View Full Catalog" link

### Data Flow
```
ProfilePage
  └─ useQuery(api.metrics.list) ─┐
                                 ├──► MetricCatalogSection (props: metrics)
                                 │
  └─ other profile queries ──────┘
```

## Design Details

### Props Interface
```typescript
interface MetricCatalogSectionProps {
  metrics: Array<{
    _id: string;
    name: string;
    category: string;
  }>;
}
```

### States
1. **Empty** (metrics.length === 0): Show simple placeholder, no elaborate messaging
2. **Populated**: Show category groups with metric names, total count, navigation link

### Layout
- Section card with rounded border
- Header: "Metric Catalog" title + "N metrics" badge
- Body: Stacked category groups (only categories with metrics)
- Footer: "View Full Catalog →" link

### Category Display
Reuse `CATEGORY_INFO` from `src/shared/metricTemplates.ts` for labels and colors:
- Reach (blue)
- Engagement (green)
- Value Delivery (purple)
- Value Capture (orange)

Categories with zero metrics are hidden.

## Alternatives Considered

1. **Grid layout (4 columns)** - Rejected: profile page is narrow, grid creates breakpoint complexity
2. **Self-contained data fetching** - Rejected: creates redundant queries, ProfilePage already has the data
3. **Wait for ProfileSection** - Rejected: can ship with inline styling now, refactor later

## Success Criteria

- [ ] Component renders metrics grouped by category
- [ ] Shows total count in header
- [ ] "View Full Catalog" navigates to `/metric-catalog`
- [ ] Tests cover empty and populated states
- [ ] No redundant data fetching (uses props from parent)
