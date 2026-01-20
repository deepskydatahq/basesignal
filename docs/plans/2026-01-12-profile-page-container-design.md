# ProfilePage Container and Routing Design

## Overview

Create the ProfilePage container component that serves as the new home page, aggregating all user profile data through a single Convex query and rendering section components with proper loading states.

## Problem Statement

The current home page shows disconnected cards. Users need a unified "Product Profile" view that shows everything known about their product in one scrollable document, creating "pull" to complete more sections by showing empty gaps.

## Expert Perspectives

### Product
- Users' job is to configure their P&L measurement setup, not to wait
- Show the page structure immediately so users are oriented
- Empty sections should be visible (as grayed-out cards) to create curiosity gaps
- Completeness indicator gives users a sense of progress

### Technical
- Use container pattern: ProfilePage calls all queries, passes data to sections
- Create a single `getProfileData` query that composes data server-side for clean API
- Convex batches internal queries efficiently
- Unified loading state keeps things simple - wait for all data, then render
- In-place replacement routing: create ProfilePage, route `/` to it directly

### Simplification Review
- Removed "GettingStartedHero" concept - design doc specifies all 11 sections visible for everyone
- Keep loading state simple (single loading indicator, not per-section skeletons)
- ProfilePage container handles all state; sections are presentational

## Proposed Solution

Create `ProfilePage.tsx` as the container component at `src/components/profile/`, update routing to serve it at `/`, and add `profile.getProfileData` Convex query that aggregates identity, journey map, first value, metric catalog, measurement plan, and completeness data.

## Design Details

### Component Structure

```
src/components/profile/
└── ProfilePage.tsx              (container: data fetching, loading, layout)
```

Child components (separate issues):
- ProfileHeader.tsx
- ProfileSection.tsx (wrapper)
- CoreIdentitySection.tsx
- JourneyMapSection.tsx
- FirstValueSection.tsx
- MetricCatalogSection.tsx
- MeasurementPlanSection.tsx
- FutureSectionCard.tsx
- CompletenessIndicator.tsx

### Data Flow

```
ProfilePage
  └── useQuery(api.profile.getProfileData)
        ├── identity (from users table)
        ├── journeyMap (stages from overview journey)
        ├── firstValue (from firstValueDefinitions)
        ├── metricCatalog (grouped metrics)
        ├── measurementPlan (entities, activities, properties)
        └── completeness (calculated from above)
```

### Query Design

```typescript
// convex/profile.ts
export const getProfileData = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    // Compose data (Convex batches these)
    const overviewJourney = await getJourneyByType(ctx, "overview");
    const stages = overviewJourney
      ? await ctx.db.query("stages")
          .withIndex("by_journey", q => q.eq("journeyId", overviewJourney._id))
          .collect()
      : [];

    const firstValue = await ctx.db.query("firstValueDefinitions")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .first();

    const metrics = await ctx.db.query("metrics")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect();

    const entities = await ctx.db.query("measurementEntities")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect();

    const activityCount = await ctx.db.query("measurementActivities")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect()
      .then(a => a.length);

    const propertyCount = await ctx.db.query("measurementProperties")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect()
      .then(p => p.length);

    // Calculate completeness
    const completeness = calculateCompleteness({
      identity: user,
      stages,
      firstValue,
      metrics,
      entities,
    });

    return {
      identity: {
        productName: user.productName,
        websiteUrl: user.websiteUrl,
        businessModel: user.businessModel,
        revenueModels: user.revenueModels,
        companyStage: user.companyStage,
      },
      journeyMap: {
        stages,
        journeyId: overviewJourney?._id
      },
      firstValue,
      metricCatalog: {
        metrics: groupBy(metrics, "category"),
        totalCount: metrics.length,
      },
      measurementPlan: {
        entities,
        activityCount,
        propertyCount,
      },
      completeness,
    };
  },
});
```

### ProfilePage Component

```typescript
// src/components/profile/ProfilePage.tsx
export function ProfilePage() {
  const profileData = useQuery(api.profile.getProfileData);

  // Loading state
  if (profileData === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse">Loading profile...</div>
      </div>
    );
  }

  // Not authenticated
  if (profileData === null) {
    return <Navigate to="/sign-in" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header with completeness - separate issue */}
      <div className="mb-8">
        <h1>{profileData.identity.productName || "Your Product"}</h1>
        <div>{profileData.completeness.completed}/{profileData.completeness.total}</div>
      </div>

      {/* Sections - each a separate issue */}
      <div className="space-y-6">
        {/* Placeholders for child components */}
        <div>Core Identity Section</div>
        <div>Journey Map Section</div>
        <div>First Value Section</div>
        <div>Metric Catalog Section</div>
        <div>Measurement Plan Section</div>
        {/* Future sections grayed out */}
      </div>
    </div>
  );
}
```

### Routing Update

```typescript
// In App.tsx or routes config
<Route index element={<ProfilePage />} />
```

The old HomePage.tsx becomes dead code, cleaned up in Task 11 of the epic.

### Completeness Calculation

```typescript
function calculateCompleteness(data: ProfileData): CompletenessInfo {
  const sections = [
    { id: "core_identity", name: "Core Identity", complete: !!data.identity.productName },
    { id: "journey_map", name: "User Journey Map", complete: data.stages.length > 0 },
    { id: "first_value", name: "First Value Moment", complete: !!data.firstValue },
    { id: "metric_catalog", name: "Metric Catalog", complete: data.metrics.length > 0 },
    { id: "measurement_plan", name: "Measurement Plan", complete: data.entities.length > 0 },
    // Future sections (always incomplete for now)
    { id: "heartbeat", name: "Heartbeat Event", complete: false },
    { id: "activation", name: "Activation Definition", complete: false },
    { id: "active", name: "Active Definition", complete: false },
    { id: "at_risk", name: "At-Risk Signals", complete: false },
    { id: "churn", name: "Churn Definition", complete: false },
    { id: "expansion", name: "Expansion Triggers", complete: false },
  ];

  const completed = sections.filter(s => s.complete).length;
  return {
    sections,
    completed,
    total: sections.length,
    percentage: Math.round((completed / sections.length) * 100),
  };
}
```

## Alternatives Considered

1. **Compose queries in React** - Have ProfilePage call 5-6 separate useQuery hooks. Rejected because: creates more complex loading state management, completeness calculation needs all data anyway, single query is cleaner API.

2. **Each section owns its query** - More self-contained sections. Rejected because: complicates completeness indicator which needs to aggregate all section states.

3. **Modify HomePage in place** - Rename/refactor existing HomePage. Rejected because: in-place replacement gives cleaner git history and easier rollback if issues arise.

## Success Criteria

- [ ] `src/components/profile/ProfilePage.tsx` exists with layout container
- [ ] Route `/` renders ProfilePage instead of old home content
- [ ] `convex/profile.ts` has `getProfileData` query returning identity, journeyMap, firstValue, metricCatalog, measurementPlan, and completeness
- [ ] ProfilePage fetches data from query and shows loading state
- [ ] Tests pass for the new query and component
