# Triggering Measurement Plan and Metric Catalog Generation

## Overview

Design for how measurement plan and metric catalog generation gets triggered - both in the normal production flow after onboarding and for testing/regeneration scenarios.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Measurement plan trigger | Auto after interview | Foundational data needed for everything else |
| Metric catalog trigger | Explicit button | Interpretive output, user should control |
| Regeneration | Clean slate | Simpler v1, no customization preservation |
| Visibility | Contextual | "Generate" when empty, "Regenerate" when exists |

---

## Production Flow

### 1. Auto-Generate Measurement Plan

**Trigger:** When Overview Interview completes

**Location:** `convex/setupProgress.ts` in `completeStep("overview_interview")`

**Implementation:**
```typescript
// In completeStep mutation, after setting step to complete:
if (step === "overview_interview") {
  const journey = await ctx.db.query("journeys")
    .withIndex("by_user_and_type", q => q.eq("userId", userId).eq("type", "overview"))
    .first();

  if (journey) {
    await ctx.runMutation(internal.measurementPlan.importFromJourneyInternal, {
      journeyId: journey._id
    });
  }
}
```

**Behavior:**
- Runs server-side, no UI race conditions
- User lands on Review page with measurement plan already generated
- If generation fails, set `foundationStatus.measurementPlan.status` to `"error"`
- Review page shows "Retry" button on error

### 2. Explicit Metric Catalog Trigger

**Trigger:** Button on Review page

**Location:** `src/routes/SetupReviewPage.tsx`

**UI:**
```
✓ Journey Map         [View]
✓ Measurement Plan    [View]
○ Metric Catalog      [Generate]
```

**Implementation:**
```typescript
const generateMetricCatalog = useMutation(api.metricCatalog.generateFromOverview);
const generateFirstValue = useMutation(api.metricCatalog.generateFromFirstValue);

async function handleGenerateMetrics() {
  setGenerating(true);
  await generateMetricCatalog({});
  await generateFirstValue({});
  setGenerating(false);
}
```

**Behavior:**
- Calls both mutations in sequence
- Shows loading state during generation
- Updates to checkmark + "View" link when complete

---

## Inline Triggers on Feature Pages

### Measurement Plan Page

**Location:** `/src/routes/MeasurementPlanPage.tsx`

**States:**

| State | Button | Action |
|-------|--------|--------|
| No journey | Disabled | Tooltip: "Complete Overview Interview first" |
| Journey exists, no data | "Generate from Journey" (primary) | Call `importFromJourney` |
| Data exists | "Regenerate" (secondary, in header) | Confirm → delete → generate |

### Metric Catalog Page

**Location:** `/src/routes/MetricCatalogPage.tsx`

**States:**

| State | Button | Action |
|-------|--------|--------|
| No journey | Disabled | Tooltip: "Complete Overview Interview first" |
| Journey exists, no data | "Generate Metric Catalog" (primary) | Call both generate mutations |
| Data exists | "Regenerate" (secondary, in header) | Confirm → delete → generate |

### Regenerate Confirmation Dialog

```
Regenerate Measurement Plan?

This will replace all existing entities and activities with
fresh data from your Overview Journey.

Any manual edits will be lost.

[Cancel]  [Regenerate]
```

---

## Settings Debug Section

**Location:** `src/routes/SettingsPage.tsx` (new section)

**Component:** `src/components/settings/DevToolsSection.tsx`

**UI:**
```
Developer Tools
───────────────────────────────────────────────────
Measurement Foundation

[Regenerate Measurement Plan]  [Regenerate Metric Catalog]

[Reset All] - Clear measurement plan and metric catalog

Status:
  • Measurement Plan: 5 entities, 12 activities
  • Metric Catalog: 8 metrics
  • Last generated: 2 hours ago
───────────────────────────────────────────────────
```

**Implementation:**
- Query `foundationStatus` to show current counts
- "Reset All" calls delete mutations without regenerating
- Useful for testing empty states

---

## Data Dependencies

| Feature | Requires | Error Handling |
|---------|----------|----------------|
| Measurement Plan | Overview Journey with stages | "Complete the Overview Interview first" |
| Metric Catalog (overview) | Journey with `core_usage` stage | "Add a core usage activity to your journey" |
| Metric Catalog (first value) | Journey with `activation` stage | Skips silently (optional metrics) |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User updates journey after generation | Use inline "Regenerate" button |
| User has no journey | Buttons disabled with tooltip |
| Partial journey (missing stages) | Generate what's possible, skip missing |
| Generation in progress | Disable buttons, show spinner |
| Multiple browser tabs | Convex reactivity updates all tabs |
| Existing users (pre-feature) | Use inline "Generate" buttons on-demand |

---

## Files to Modify

### Backend (Convex)

| File | Changes |
|------|---------|
| `convex/setupProgress.ts` | Add auto-generation call in `completeStep` |
| `convex/measurementPlan.ts` | Add internal mutation for server-side import |
| `convex/metricCatalog.ts` | Add delete mutation for reset functionality |

### Frontend

| File | Changes |
|------|---------|
| `src/routes/SetupReviewPage.tsx` | Add "Generate Metric Catalog" button |
| `src/routes/MeasurementPlanPage.tsx` | Add Generate/Regenerate buttons |
| `src/routes/MetricCatalogPage.tsx` | Add Generate/Regenerate buttons |
| `src/routes/SettingsPage.tsx` | Add Developer Tools section |
| `src/components/settings/DevToolsSection.tsx` | New component |

---

## No Migration Required

Existing users who completed onboarding before these features:
- Can use inline "Generate" buttons on feature pages
- Can use Settings > Developer Tools to generate
- No backfill script needed - on-demand generation is sufficient
