# Metric Variation Templates Design

## Overview

Define metric variation templates that can be applied to any measurement activity based on its lifecycle slot. This replaces hard-coded metric templates with composable variations while preserving rich, contextual guidance.

## Problem Statement

The current `metricTemplates.ts` has 8 hard-coded templates organized by generation phase. This doesn't scale when users define custom measurement activities. We need a system that:
- Generates appropriate metrics for any activity based on its lifecycle slot
- Maintains rich "whyItMatters" and "howToImprove" guidance
- Handles activities without a lifecycle slot

## Expert Perspectives

### Product
- Users don't think of "New Users" as "a rate variation on an acquisition slot" - some metrics are lifecycle anchors that exist regardless of journey shape
- The magic is contextual guidance that makes users feel supported - not raw formulas
- Primary activity = north star signal; secondary activities = optional engagement indicators
- One strong metric + secondary signals beats four ambiguous ones

### Technical
- With only 5 lifecycle slots x 4 variations (~20 combinations), formula abstraction doesn't pay off
- Pre-written templates are explicit, predictable, and easier to extend
- Slot-agnostic vs slot-specific is a real semantic distinction worth preserving
- The `isFirstValue` concept already exists for primary/secondary distinction

### Simplification Review

**Removed:**
- Override mechanism (speculative, not in requirements)
- variationType schema field (can derive from template if needed later)

**Retained (required by issue):**
- Slot-specific variation templates
- Templates mapped to lifecycle slots
- Generation from templates
- Fallback for slotless activities

## Proposed Solution

A two-tier template system:
1. **Slot-agnostic metrics** remain unchanged (New Users, MAU, DAU, etc.)
2. **Slot-specific metrics** generated per activity using variation templates

PRIMARY activities (`isFirstValue=true`) get full slot+variation metrics.
SECONDARY activities get lightweight tracking (count, frequency only).

## Design Details

### Template Structure

```typescript
// src/shared/metricTemplates.ts

export const METRIC_VARIATIONS = ["rate", "time_to", "frequency", "cohort"] as const;
export type MetricVariation = typeof METRIC_VARIATIONS[number];

export type SlotVariationTemplate = {
  variation: MetricVariation;
  name: string;           // e.g., "{{activity}} Rate"
  definition: string;     // Rich pre-written guidance
  formula: string;
  whyItMatters: string;
  howToImprove: string;
  category: MetricCategory;
  primaryOnly: boolean;   // true = skip for secondary activities
};

export const SLOT_METRIC_TEMPLATES: Record<LifecycleSlot, SlotVariationTemplate[]> = {
  account_creation: [...],
  activation: [...],
  core_usage: [...],
  revenue: [...],
  churn: [...],
};

export const FALLBACK_TEMPLATES: SlotVariationTemplate[] = [
  // count and frequency only for slotless activities
];
```

### Slot-Specific Templates

| Slot | Variations | Notes |
|------|------------|-------|
| `account_creation` | rate, time_to, cohort | No frequency (one-time event) |
| `activation` | rate, time_to, cohort | No frequency (one-time event) |
| `core_usage` | rate, time_to, frequency, cohort | All 4 (recurring action) |
| `revenue` | rate, time_to, frequency, cohort | All 4 (recurring event) |
| `churn` | rate, time_to, cohort | No frequency (one-time event) |

### Generation Logic

```typescript
// convex/metricCatalog.ts

export const generateFromMeasurementPlan = mutation({
  handler: async (ctx) => {
    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", ...)
      .collect();

    for (const activity of activities) {
      const templates = activity.lifecycleSlot
        ? SLOT_METRIC_TEMPLATES[activity.lifecycleSlot]
        : FALLBACK_TEMPLATES;

      const isPrimary = activity.isFirstValue;

      for (const template of templates) {
        if (template.primaryOnly && !isPrimary) continue;

        await ctx.db.insert("metrics", {
          name: interpolate(template.name, { activity: activity.name }),
          sourceActivityId: activity._id,
          // ... other fields
        });
      }
    }
  }
});
```

### Schema Change

```typescript
// convex/schema.ts - metrics table

// Change from:
relatedActivityId: v.optional(v.id("stages"))

// To:
sourceActivityId: v.optional(v.id("measurementActivities"))
```

## Alternatives Considered

### Pure Formula Generation
Generate guidance dynamically from formula type + slot context.

**Rejected:** Adds abstraction overhead without payoff for ~20 combinations. Pre-written templates are more predictable and capture domain knowledge explicitly.

### Reconceptualize All Metrics as Slot+Variation
Make "New Users" a rate variation of an implicit "acquisition" slot.

**Rejected:** Forces mental models that don't match how users think. Slot-agnostic metrics serve a different purpose (P&L-level view) than slot-specific metrics (activity tracking).

### Generate Full Variations for All Activities
Apply all 4 variations to every activity regardless of primary/secondary.

**Rejected:** Creates metric sprawl. Users want confidence, not quantity. Primary = deep insight, Secondary = engagement signals.

## Success Criteria

- [ ] Each lifecycle slot has pre-written templates for applicable variations
- [ ] Generation produces correct metrics per activity based on slot
- [ ] Primary activities get full variation set
- [ ] Secondary activities get count/frequency only
- [ ] Slotless activities get sensible fallback (count/frequency)
- [ ] All generated metrics have sourceActivityId for traceability
