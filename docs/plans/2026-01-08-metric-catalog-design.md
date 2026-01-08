# Metric Catalog (v1) Design

## Overview

Generate a Metric Catalog - a curated set of 6-8 well-defined product metrics with clear definitions, calculation methods, and usage guidance. Auto-generated progressively after Overview Interview and First Value confirmation.

## Problem Statement

Product teams need standardized metrics to measure performance, but defining metrics with clear formulas and context is time-consuming. After users complete their Overview Interview and First Value confirmation, we have enough context to generate a personalized metric catalog automatically.

## Scope

This design covers the core v1 features:
- Data model for metrics
- Metric templates with personalization
- Progressive generation logic
- Catalog view with card grid + detail panel
- Dashboard integration

**Deferred to v2:**
- Metric management UI (add/edit/remove)
- Export functionality (PDF, CSV, shareable link)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Generation trigger | Progressive | Generate defaults after Overview, add First Value metrics later |
| Personalization | Activity names only | Insert their activity names into templates; keep advice generic |
| UI layout | Card grid | Matches dashboard patterns, fits 6-8 metrics well |
| Detail expansion | Side panel | Consistent with journey editor, allows comparison |
| Content source | Hardcoded templates | Predictable, no AI latency, quality controlled |

---

## Data Model

### Schema

```typescript
// convex/schema.ts
metrics: defineTable({
  // Identity
  productId: v.id("products"),

  // Content
  name: v.string(),                    // "Activation Rate"
  definition: v.string(),              // Plain language, personalized
  formula: v.string(),                 // Human-readable, with activity names
  whyItMatters: v.string(),            // Business context
  howToImprove: v.string(),            // Actionable levers

  // Metadata
  metricType: v.string(),              // "default" | "generated"
  templateKey: v.optional(v.string()), // "activation_rate" - links to template
  relatedActivityId: v.optional(v.id("stages")),  // Optional journey link
  order: v.number(),                   // Display sequence
})
  .index("by_product", ["productId"])
  .index("by_product_and_order", ["productId", "order"])
```

### Key Decisions

- **`metricType`** instead of `is_default` boolean - cleaner for filtering
- **`templateKey`** links back to template for regeneration if templates change
- **`relatedActivityId`** points to a stage for navigation to journey map
- **Scoped to product** - each product gets its own catalog

---

## Metric Templates

### Template Structure

```typescript
// src/shared/metricTemplates.ts
type MetricTemplate = {
  key: string;
  name: string;
  definition: string;
  formula: string;
  whyItMatters: string;
  howToImprove: string;
  category: "reach" | "engagement" | "value_delivery" | "value_capture";
  generatedAfter: "overview" | "first_value";
};
```

### Default Metrics (after Overview Interview)

| Key | Name | Category |
|-----|------|----------|
| `new_users` | New Users | Reach |
| `mau` | Monthly Active Users | Engagement |
| `dau` | Daily Active Users | Engagement |
| `dau_mau_ratio` | DAU/MAU Ratio | Engagement |
| `retention_d7` | 7-Day Retention | Engagement |
| `core_action_frequency` | {Core Action} Frequency | Engagement |

### First Value Metrics (after confirmation)

| Key | Name | Category |
|-----|------|----------|
| `activation_rate` | Activation Rate | Value Delivery |
| `time_to_first_value` | Time to First Value | Value Delivery |

### Personalization Slots

Templates use placeholders replaced at generation time:
- `{{firstValueActivity}}` → "First Project Created"
- `{{coreAction}}` → "Report Generated"
- `{{productName}}` → "Basesignal"

---

## Generation Logic

### Two Generation Triggers

**1. After Overview Interview completion:**

```typescript
// convex/metricCatalog.ts
export const generateFromOverview = mutation({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, { journeyId }) => {
    // 1. Get the journey and its stages
    // 2. Find core_usage activity for {{coreAction}} slot
    // 3. Generate metrics where generatedAfter === "overview"
    // 4. Interpolate activity names into templates
    // 5. Insert metrics with order 1-6
  }
});
```

**2. After First Value confirmation:**

```typescript
export const generateFromFirstValue = mutation({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, { journeyId }) => {
    // 1. Get the first_value journey and its stages
    // 2. Find the activation activity for {{firstValueActivity}} slot
    // 3. Generate metrics where generatedAfter === "first_value"
    // 4. Append to existing catalog (order 7-8)
  }
});
```

### Trigger Points

- **Overview**: Called when interview status changes to "complete"
- **First Value**: Called when first_value journey is marked complete

### Idempotency

- Check if metrics with same `templateKey` already exist for this product
- Skip if already generated (don't duplicate)
- Allows re-running without creating duplicates

---

## Catalog View UI

### Route

`/metric-catalog` (new page)

### Component Structure

```
MetricCatalogPage
├── Header ("Metric Catalog" + subtitle)
├── MetricGrid (CSS grid, 2 columns)
│   └── MetricCard (×6-8)
│       ├── Name (bold)
│       ├── Definition (truncated, 2 lines)
│       ├── Category badge (Reach/Engagement/etc)
│       └── Click → opens detail panel
└── MetricDetailPanel (slide-in from right)
    ├── Name + Category
    ├── Definition (full)
    ├── Formula (monospace/highlighted)
    ├── "Why It Matters" section
    ├── "How to Improve" section
    └── Related Activity link (if applicable)
```

### State Management

- `selectedMetricId` controls which metric's detail panel is open
- `null` = panel closed
- Panel has close button + clicking outside closes

### Empty State

- If no metrics yet: "Complete the Overview Interview to generate your Metric Catalog"
- Link to start the interview

### Styling

- Card grid: `grid grid-cols-2 gap-4`
- Cards: White background, subtle border, hover shadow
- Category badges: Color-coded
  - Blue = Reach
  - Green = Engagement
  - Purple = Value Delivery
  - Orange = Value Capture
- Detail panel: 400px width, slide animation, gray-50 background

---

## Dashboard Integration

### Foundation Status Updates

```typescript
// Update convex/setupProgress.ts foundationStatus query
metricCatalog: {
  status: hasAnyMetrics ? "complete"
        : overviewComplete ? "in_progress"
        : "locked",
  metricsCount: numberOfMetrics,
}
```

### Status Progression

| Status | Condition | Card Behavior |
|--------|-----------|---------------|
| `locked` | Overview not complete | Gray, disabled, "Complete Overview Interview first" |
| `in_progress` | Some metrics exist | Clickable, badge "5/8 metrics" |
| `complete` | All metrics generated | Clickable, green checkmark, "8 metrics" |

### Navigation

- Clicking MeasurementFoundationCard → `/metric-catalog`
- Metric detail "Related Activity" link → `/journeys/:id` with stage selected

### Notification (nice-to-have)

After generation, show toast: "Your Metric Catalog is ready" with link

---

## Success Criteria

1. After Overview Interview completion, 6 default metrics appear in catalog
2. After First Value confirmation, 2 additional metrics are added
3. Metric formulas include the user's actual activity names
4. Users can view full metric details in side panel
5. Related Activity links navigate to correct journey/stage
6. Dashboard card reflects catalog status accurately

---

## Open Questions

None - all design decisions resolved during brainstorming.

---

*Created via /brainstorm from issue #5*
