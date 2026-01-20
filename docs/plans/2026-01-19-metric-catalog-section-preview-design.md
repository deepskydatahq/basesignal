# MetricCatalogSection Preview Design

## Overview

Transform MetricCatalogSection from a verbose per-metric list into a compact visual summary showing category distribution at a glance via a horizontal segmented bar and count labels.

## Problem Statement

The current MetricCatalogSection lists every metric by name under category headers. For a profile preview, this is overwhelming and competes with the full catalog page. Users need to see metric distribution quickly, not read through every metric name.

## Expert Perspectives

### Product
- Show only categories with metrics (hide empty ones) - the preview should feel like progress, not deficit
- Don't show a "completeness report card" with zeros - save gap messaging for actionable moments
- Keep the component as a summary-only status card, not a container
- "View Full Catalog" link is the right pattern - details belong on the dedicated page
- Respect the profile page's job: "show me my P&L shape fast"

### Technical
- Leverage existing CATEGORY_INFO and METRIC_CATEGORIES from metricTemplates.ts
- Use established category colors (blue=Reach, green=Engagement, purple=Value Delivery, orange=Value Capture)
- Reuse ProfileSection wrapper pattern with action button
- Calculate proportional widths inline: `(count / totalMetrics) * 100`

### Simplification Review
- **Removed:** Per-metric bullet point listing - this belongs in the full catalog, not the preview
- **Simplified:** Empty state copy to be more concise
- **Committed:** Fully to visual summary approach (bar + counts) rather than hybrid list/summary

## Proposed Solution

Replace the metric listing with:
1. A horizontal segmented bar showing proportional category distribution
2. A legend row with colored dots and "Category: N" counts
3. Maintain total count in status label and "View Full Catalog" action

## Design Details

### Visual Layout

```
┌─────────────────────────────────────────────────────────┐
│ Metric Catalog                    8 metrics   [View...] │
├─────────────────────────────────────────────────────────┤
│ [====blue====][====green========][purple][orange]       │
│                                                         │
│ ● Reach: 2   ● Engagement: 4   ● Value Del.: 1  ● V.C: 1│
└─────────────────────────────────────────────────────────┘
```

### Component Structure

```tsx
export function MetricCatalogSection({ metrics }: MetricCatalogSectionProps) {
  const navigate = useNavigate();

  // Group metrics by category
  const grouped = METRIC_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = metrics.filter((m) => m.category === category);
      return acc;
    },
    {} as Record<MetricCategory, Metric[]>
  );

  // Only show categories that have metrics
  const populatedCategories = METRIC_CATEGORIES.filter(
    (cat) => grouped[cat].length > 0
  );

  const hasMetrics = metrics.length > 0;
  const statusLabel = hasMetrics ? `${metrics.length} metrics` : "0 metrics";

  return (
    <ProfileSection
      title="Metric Catalog"
      status={hasMetrics ? "complete" : "not_started"}
      statusLabel={statusLabel}
      actionLabel="View Full Catalog"
      onAction={() => navigate("/metric-catalog")}
    >
      {hasMetrics ? (
        <div className="space-y-3">
          {/* Distribution bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            {populatedCategories.map((category) => {
              const count = grouped[category].length;
              const widthPercent = (count / metrics.length) * 100;
              return (
                <div
                  key={category}
                  className={`${CATEGORY_COLORS[category]} first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${widthPercent}%` }}
                  title={`${CATEGORY_INFO[category].label}: ${count}`}
                />
              );
            })}
          </div>

          {/* Category legend with counts */}
          <div className="flex flex-wrap gap-4">
            {populatedCategories.map((category) => {
              const info = CATEGORY_INFO[category];
              const count = grouped[category].length;
              return (
                <div key={category} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[category]}`} />
                  <span className="text-sm text-gray-600">
                    {info.label}: {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          No metrics yet. Complete the Overview Interview to get started.
        </p>
      )}
    </ProfileSection>
  );
}
```

### Color Constants

```typescript
const CATEGORY_COLORS: Record<MetricCategory, string> = {
  reach: "bg-blue-500",
  engagement: "bg-green-500",
  value_delivery: "bg-purple-500",
  value_capture: "bg-orange-500",
};
```

## Alternatives Considered

1. **Show all four categories with zeros** - Rejected: adds visual noise and feels like a deficit report rather than progress
2. **Expand-in-place interaction** - Rejected: wastes vertical space, adds complexity; details belong on dedicated page
3. **Keep per-metric listing** - Rejected: overwhelming for preview, competes with full catalog

## Success Criteria

- [ ] Empty state shows concise message
- [ ] Single category renders full-width bar segment
- [ ] Multiple categories show proportional segments in P&L order
- [ ] Legend accurately shows counts for populated categories only
- [ ] "View Full Catalog" navigates to /metric-catalog
- [ ] Distribution is scannable at a glance without reading individual metrics
