# Measurement Foundation Card Design

**Date:** 2026-01-05
**Status:** Approved
**Ticket:** Journey Progress Card on Homepage

## Overview

Add a progress overview card to the homepage that shows where the user is in their journey setup. Replaces the existing `JourneyRoadmap` component with a unified "Measurement Foundation" view.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Stages to track | All 4 (Overview Interview, First Value, Measurement Plan, Metric Catalog) - locked stages show "coming soon" |
| Placement | Replaces JourneyRoadmap entirely |
| Visual style | 2x2 card grid with status badges |
| Click behavior | Mixed - completed navigates to view/edit, incomplete shows next step, locked shows coming soon |
| Card content | Detailed - name, status badge, description, progress details |
| Header | "Measurement Foundation" |

## Component Architecture

### New Components

```
src/components/home/
├── MeasurementFoundationCard.tsx  (main container)
├── StageCard.tsx                   (individual stage tile)
```

### Data Requirements

New query `setupProgress.foundationStatus` returns unified status for all 4 stages:

```typescript
{
  overviewInterview: {
    status: "complete" | "in_progress" | "not_started",
    journeyId: Id<"journeys"> | null,
    slotsCompleted: number,
    slotsTotal: 5
  },
  firstValue: {
    status: "defined" | "not_defined",
    journeyId: Id<"journeys"> | null
  },
  measurementPlan: { status: "locked" },
  metricCatalog: { status: "locked" }
}
```

## Visual Design

### Card Container

- Header: "Measurement Foundation" with subtle icon
- 2x2 grid layout with consistent gap spacing
- Matches existing card styling (`bg-white rounded-lg border shadow-sm`)

### Stage Card States

| State | Visual Treatment |
|-------|------------------|
| `complete` | Green checkmark badge, full opacity, clickable |
| `in_progress` | Blue dot/spinner badge, full opacity, primary CTA styling |
| `not_started` | Gray empty circle, full opacity, secondary CTA styling |
| `not_defined` | Same as not_started (different label) |
| `locked` | Muted/40% opacity, lock icon, "Coming soon" text, not clickable |

### Stage Card Layout (~120px x 140px)

```
┌─────────────────────┐
│ [Icon]    [Badge]   │
│                     │
│ Stage Name          │
│ Description line    │
│                     │
│ Progress detail     │  ← only when in_progress
│ or CTA button       │
└─────────────────────┘
```

### Icons

- Overview Interview: `MessageSquare` or `Users`
- First Value: `Target` or `Zap`
- Measurement Plan: `FileText` or `ClipboardList`
- Metric Catalog: `BarChart3` or `Database`

## Interactions & Navigation

### Click Behavior by State

| Stage | State | Click Action |
|-------|-------|--------------|
| Overview Interview | complete | Navigate to `/journeys/{overviewJourneyId}` |
| Overview Interview | in_progress | Navigate to `/setup/interview` |
| Overview Interview | not_started | Navigate to `/setup/interview` |
| First Value | defined | Navigate to `/journeys/{firstValueJourneyId}` |
| First Value | not_defined | Navigate to `/interviews/first_value` |
| Measurement Plan | locked | No action, tooltip: "Coming soon" |
| Metric Catalog | locked | No action, tooltip: "Coming soon" |

### CTA Button Labels

| State | Label |
|-------|-------|
| complete | "View" (secondary style) |
| in_progress | "Continue" (primary style) |
| not_started | "Start" (primary style) |
| not_defined | "Define" (primary style) |
| locked | No button, "Coming soon" text |

### Progress Details

- Overview Interview (in_progress): "X of 5 lifecycle slots mapped"
- First Value: N/A (binary state)

## Backend Query

### `convex/setupProgress.ts` → `foundationStatus`

```typescript
export const foundationStatus = query({
  args: {},
  handler: async (ctx) => {
    // 1. Get current user's setup progress
    const progress = await getCurrentSetupProgress(ctx)

    // 2. Find overview journey (created during setup)
    const overviewJourney = await findJourneyByType(ctx, "overview")

    // 3. Find first_value journey
    const firstValueJourney = await findJourneyByType(ctx, "first_value")

    // 4. Get overview interview completion details if in progress
    const overviewDetails = overviewJourney
      ? await getCompletionStatus(ctx, overviewJourney._id)
      : null

    return {
      overviewInterview: {
        status: deriveOverviewStatus(progress, overviewJourney),
        journeyId: overviewJourney?._id,
        slotsCompleted: overviewDetails?.filledSlots ?? 0,
        slotsTotal: 5,
      },
      firstValue: {
        status: firstValueJourney ? "defined" : "not_defined",
        journeyId: firstValueJourney?._id,
      },
      measurementPlan: { status: "locked" },
      metricCatalog: { status: "locked" },
    }
  }
})
```

### Status Derivation for Overview Interview

- `setupProgress.status === "completed"` → `"complete"`
- `setupProgress.currentStep === "overview_interview"` → `"in_progress"`
- Otherwise → `"not_started"`

## Implementation Plan

### Files to Create

```
src/components/home/MeasurementFoundationCard.tsx
src/components/home/StageCard.tsx
```

### Files to Modify

```
convex/setupProgress.ts          → add foundationStatus query
src/routes/HomePage.tsx          → replace JourneyRoadmap with MeasurementFoundationCard
```

### Files to Delete

```
src/components/home/JourneyRoadmap.tsx
```

### Testing

- Unit tests for `foundationStatus` query (various state combinations)
- Component tests for `MeasurementFoundationCard` (renders correct states, click handlers)

### Edge Cases

- New user with no setup progress → all stages show appropriate initial state
- User who completed setup but has no first_value journey → Overview complete, First Value shows "Define"
- Loading state while query resolves

## Out of Scope

- Building Measurement Plan or Metric Catalog features (just show "locked")
- Modifying the setup flow itself
- Mobile-specific layouts (responsive grid handles smaller screens)
