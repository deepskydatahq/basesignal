# Profile Home Page Design

**Date:** 2026-01-12
**Status:** Draft
**Epic:** Product Profile - Phase 1

## Overview

Replace the current home page with a unified Product Profile view - a single-column, document-style page that shows everything known about the customer's product. The Profile becomes the central artifact in Basesignal, creating "pull" for users to complete more interviews by showing empty sections as curiosity gaps.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Route | `/` (replaces current home) |
| Layout | Single column, document-style, max-width ~900px |
| Section visibility | All 11 sections visible; incomplete ones grayed out |
| Journey Map display | Static visual diagram (not interactive canvas) |
| Completeness tracking | Header indicator with expandable checklist |

## Profile Sections (V1)

### Sections with Data (Ready to Display)

| # | Section | Data Source | Status |
|---|---------|-------------|--------|
| 1 | Core Identity | `users` table, Overview Interview | Ready |
| 2 | User Journey Map | `stages` from overview journey | Ready |
| 3 | First Value Moment | `firstValueDefinitions` | Ready |
| 4 | Metric Catalog | `metrics` table | Ready |
| 5 | Measurement Plan | `measurementEntities/Activities/Properties` | Ready |

### Future Sections (Grayed Out)

| # | Section | Interview Required |
|---|---------|-------------------|
| 6 | Heartbeat Event | Heartbeat Interview |
| 7 | Activation Definition | Activation Interview |
| 8 | Active Definition | Activity Interview |
| 9 | At-Risk Signals | Risk Signals Interview |
| 10 | Churn Definition | Churn Interview |
| 11 | Expansion Triggers | Expansion Interview |

## Component Architecture

### New Components

```
src/components/profile/
├── ProfilePage.tsx              (main page container)
├── ProfileHeader.tsx            (logo, name, completeness)
├── ProfileSection.tsx           (reusable section wrapper)
├── CoreIdentitySection.tsx      (section 1)
├── JourneyMapSection.tsx        (section 2)
├── FirstValueSection.tsx        (section 3)
├── MetricCatalogSection.tsx     (section 4 summary)
├── MeasurementPlanSection.tsx   (section 5 summary)
├── FutureSectionCard.tsx        (grayed out placeholder)
├── CompletenessIndicator.tsx    (header progress)
└── JourneyDiagram.tsx           (static SVG/React visualization)
```

### Files to Modify

```
src/routes/HomePage.tsx          → Replace content with ProfilePage
src/App.tsx                      → Update route if needed
```

### Files to Remove

```
src/components/home/MeasurementFoundationCard.tsx  → Absorbed into Profile
src/components/home/StageCard.tsx                  → Replaced by ProfileSection
```

## Visual Design

### Design System Reference

Using existing shadcn/ui + Tailwind patterns:

| Element | Classes |
|---------|---------|
| Page container | `max-w-4xl mx-auto px-6 py-8` |
| Section card | `rounded-lg border border-gray-200 bg-white p-6 mb-6` |
| Section title | `text-lg font-semibold text-gray-900` |
| Status badge (complete) | `inline-flex items-center text-xs font-medium text-green-700` |
| Status badge (incomplete) | `inline-flex items-center text-xs font-medium text-gray-500` |
| Grayed section | `opacity-50` + dashed border `border-dashed` |
| CTA button (primary) | `bg-black text-white hover:bg-gray-800` |
| CTA button (disabled) | `bg-gray-100 text-gray-400 cursor-not-allowed` |

### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo]  Product Name                        ████░░░░ 4/11     │
│          One-line description                                   │
│          B2B SaaS • Seat Subscription                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Core Identity                              ✓ Complete   │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ [Screenshot]  Website: basesignal.com                   │   │
│  │               Business Model: B2B, Multi-user           │   │
│  │               Revenue: Seat Subscription                │   │
│  │               Stage: Seed                        [Edit] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ User Journey Map                           ✓ Complete   │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │                                                         │   │
│  │  [Signed Up]──▶[Onboarded]──▶[Active]──▶[Paying]──▶[Retained]│
│  │     Reach      Activation   Engagement  Value Cap  Retention │
│  │                                                         │   │
│  │                                          [Edit Journey] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ First Value Moment                         ✓ Defined    │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ "Created First Report"                                  │   │
│  │ Users experience the core benefit when they generate    │   │
│  │ their first report and see insights...                  │   │
│  │                                                         │   │
│  │ Expected: Within 3 days    Confirmed: Jan 10, 2026      │   │
│  │                                                  [Edit] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Metric Catalog                          12 metrics      │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │  Reach          Activation      Engagement              │   │
│  │  • New Signups  • Activation    • Active Users          │   │
│  │  • Trial Starts   Rate          • Feature Adoption      │   │
│  │                 • Time to                               │   │
│  │  Value Capture    Activate      Retention               │   │
│  │  • Conversion                   • Retention Rate        │   │
│  │  • MRR                          • Churn Rate            │   │
│  │                                                         │   │
│  │                                    [View Full Catalog]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Measurement Plan                       3 entities       │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │  User              Workspace           Report           │   │
│  │  • Signed up       • Created           • Created        │   │
│  │  • Completed setup • Invited member    • Shared         │   │
│  │  • Upgraded        • Connected data    • Exported       │   │
│  │                                                         │   │
│  │  12 activities • 8 properties      [View Full Plan]     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│  ╎ ○ Heartbeat Event                       Not Defined    ╎   │
│  ╎ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ╎   │
│  ╎ The single event that indicates a user is active.      ╎   │
│  ╎ If they do this, they're engaged. If not, at risk.     ╎   │
│  ╎                                                        ╎   │
│  ╎                    [ Define with Interview ] (disabled) ╎   │
│  ╎                    Requires: Overview Interview         ╎   │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                                                 │
│  [... more future sections ...]                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Section Card States

| State | Visual Treatment |
|-------|------------------|
| Complete | Full opacity, solid border, green checkmark, "Edit" action |
| In Progress | Full opacity, solid border, blue indicator, "Continue" action |
| Not Started (ready) | Full opacity, solid border, gray circle, "Start Interview" action |
| Not Started (locked) | 50% opacity, dashed border, lock icon, disabled CTA with prerequisite text |

### Journey Diagram Component

Static SVG-based visualization:

```tsx
// JourneyDiagram.tsx
interface Stage {
  name: string;
  lifecycleSlot: "reach" | "activation" | "engagement" | "value_capture" | "retention";
  hasDefinition: boolean;
}

// Visual: horizontal flow with nodes and arrows
// Each node shows:
// - Stage name (user-defined)
// - Lifecycle slot label (below, smaller, gray)
// - Filled/empty dot indicating definition status
// Hover: tooltip with stage definition if available
```

### Completeness Indicator

**Collapsed (in header):**
```
████████░░░░░░░░░░░░  4 of 11
```

**Expanded (dropdown):**
```
Profile Completeness

✓ Core Identity
✓ User Journey Map
✓ First Value Moment
✓ Metric Catalog
○ Measurement Plan
○ Heartbeat Event
○ Activation Definition
○ Active Definition
○ At-Risk Signals
○ Churn Definition
○ Expansion Triggers

[ Complete Next Section ]
```

Status labels based on completion:
- 0-3: "Getting Started"
- 4-6: "Taking Shape"
- 7-9: "Well Defined"
- 10-11: "Complete"

## Data Requirements

### New Query: `profile.getProfileData`

```typescript
export const getProfileData = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    // Core Identity
    const identity = {
      productName: user.productName,
      websiteUrl: user.websiteUrl,
      businessModel: user.businessModel,
      revenueModels: user.revenueModels,
      companyStage: user.companyStage,
      // ... other fields
    };

    // Journey Map
    const overviewJourney = await getJourneyByType(ctx, "overview");
    const stages = overviewJourney
      ? await getStagesForJourney(ctx, overviewJourney._id)
      : [];

    // First Value
    const firstValue = await getFirstValueDefinition(ctx, user._id);

    // Metrics summary
    const metrics = await getMetrics(ctx, user._id);
    const metricsByCategory = groupBy(metrics, "category");

    // Measurement Plan summary
    const entities = await getMeasurementEntities(ctx, user._id);
    const activityCount = await countActivities(ctx, user._id);
    const propertyCount = await countProperties(ctx, user._id);

    // Completeness
    const completeness = calculateCompleteness({
      identity,
      stages,
      firstValue,
      metrics,
      entities,
    });

    return {
      identity,
      journeyMap: { stages, journeyId: overviewJourney?._id },
      firstValue,
      metricCatalog: {
        metrics: metricsByCategory,
        totalCount: metrics.length
      },
      measurementPlan: {
        entities,
        activityCount,
        propertyCount
      },
      completeness,
    };
  }
});
```

### Completeness Calculation

```typescript
function calculateCompleteness(data: ProfileData): CompletenessInfo {
  const sections = [
    { id: "core_identity", complete: !!data.identity.productName },
    { id: "journey_map", complete: data.stages.length > 0 },
    { id: "first_value", complete: !!data.firstValue },
    { id: "metric_catalog", complete: data.metrics.length > 0 },
    { id: "measurement_plan", complete: data.entities.length > 0 },
    // Future sections always incomplete for now
    { id: "heartbeat", complete: false },
    { id: "activation", complete: false },
    { id: "active", complete: false },
    { id: "at_risk", complete: false },
    { id: "churn", complete: false },
    { id: "expansion", complete: false },
  ];

  const completed = sections.filter(s => s.complete).length;
  const total = sections.length;

  return {
    sections,
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
    status: getStatusLabel(completed),
  };
}
```

## Interactions & Navigation

### Section Actions

| Section | State | Primary Action | Secondary Action |
|---------|-------|----------------|------------------|
| Core Identity | Complete | Edit (modal) | - |
| Journey Map | Complete | Edit Journey (navigate) | - |
| First Value | Defined | Edit (modal) | - |
| First Value | Not Defined | Define (interview) | - |
| Metric Catalog | Has metrics | View Full Catalog | Regenerate |
| Measurement Plan | Has entities | View Full Plan | - |
| Future sections | Locked | Disabled CTA | Shows prerequisite |
| Future sections | Ready | Start Interview | - |

### Navigation Targets

| Action | Target |
|--------|--------|
| Edit Core Identity | Modal overlay |
| Edit Journey | `/journeys/{overviewJourneyId}` |
| Edit First Value | Modal overlay or `/interviews/first_value` |
| View Full Catalog | `/metric-catalog` |
| View Full Plan | `/measurement-plan` |
| Start [X] Interview | `/interviews/{interviewType}` |

## Implementation Plan

### Phase 1: Core Structure (Tasks 1-3)

1. **Create ProfilePage container and routing**
   - New `ProfilePage.tsx` with layout structure
   - Update routing to serve at `/`
   - Add `profile.getProfileData` query

2. **Create ProfileHeader component**
   - Product logo/name display
   - Business model badges
   - Completeness indicator (collapsed)

3. **Create ProfileSection wrapper component**
   - Consistent card styling
   - Status badge rendering
   - Complete/incomplete visual states

### Phase 2: Ready Sections (Tasks 4-8)

4. **CoreIdentitySection** - Display existing user data with edit capability

5. **JourneyMapSection** - Static diagram from overview stages

6. **FirstValueSection** - Display definition with edit capability

7. **MetricCatalogSection** - Summary grid with category grouping

8. **MeasurementPlanSection** - Entity cards with activity counts

### Phase 3: Future Sections & Polish (Tasks 9-11)

9. **FutureSectionCard** - Grayed placeholder with prerequisites

10. **CompletenessIndicator** - Expandable checklist with progress

11. **Remove old components** - Clean up MeasurementFoundationCard, StageCard

## Testing Strategy

| Component | Test Type | Key Scenarios |
|-----------|-----------|---------------|
| `getProfileData` query | Convex test | Empty state, partial data, full data |
| ProfilePage | RTL | Renders all sections, handles loading |
| ProfileSection | RTL | Complete/incomplete states, click handlers |
| JourneyDiagram | RTL | Renders stages, hover tooltips |
| CompletenessIndicator | RTL | Progress calculation, expand/collapse |

## Out of Scope

- Interactive journey editing on Profile page (use existing editor)
- Real-time metric values (Phase 2 with data connection)
- Sharing/export functionality (separate epic)
- Mobile-specific layouts (responsive handles it)
- Future section interviews (separate issues)

## Open Questions

1. Should the Profile have a "share preview" even before export is built?
2. Should we show interview history/timestamps for each section?
3. How do we handle users who skip setup and land on an empty Profile?

## Success Criteria

- Users can see their complete Profile in one scrollable view
- Empty sections create visible "gaps" that encourage completion
- Completeness indicator accurately reflects Profile state
- All existing data (from setup flow) displays correctly
- Page loads quickly (<1s) even with all sections
