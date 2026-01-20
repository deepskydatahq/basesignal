# MeasurementPlanSection Design

## Overview

A summary section for the Profile page that displays the user's measurement plan—entities and their activities. Part of epic #35 (Profile Home Page).

## Problem Statement

Users need to see at a glance what they're measuring (entities, activities, properties) without navigating to the full measurement plan page. This section provides a scannable summary that builds confidence their measurement is configured correctly.

## Expert Perspectives

### Product
The summary's job is to build confidence that measurement is configured, not to be exhaustive. Optimize for the 90% case: scanning to confirm setup is complete, then moving on. The "View Full Plan" link serves users who want details.

### Technical
Focus on single-purpose: the profile is the overview, `/measurement-plan` is the deep dive. Don't replicate the full page experience in miniature. Receive data as props, don't own queries.

### Simplification Review
- **Removed**: Derived `status` prop—compute from `plan.length > 0` inline
- **Removed**: Empty state skeleton cards—let ProfileSection handle status badge
- **Simplified**: Activity truncation—show all activities initially, add truncation later if UX testing reveals need

## Proposed Solution

A pure view component that receives the measurement plan data from ProfilePage and renders entity cards with activity lists. Follows the same pattern as MetricCatalogSection: props-based, no data fetching.

## Design Details

### Props Interface

```typescript
interface MeasurementPlanSectionProps {
  plan: Array<{
    entity: { _id: Id<"measurementEntities">; name: string };
    activities: Array<{ _id: Id<"measurementActivities">; name: string }>;
    properties: Array<{ _id: Id<"measurementProperties">; name: string }>;
  }>;
}
```

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Measurement Plan                              3 entities ✓      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  12 activities · 8 properties                                   │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ User            │ │ Account         │ │ Feature         │   │
│  │ • Signed up     │ │ • Created       │ │ • Enabled       │   │
│  │ • Completed     │ │ • Upgraded      │ │ • Used          │   │
│  │   setup         │ │ • Churned       │ └─────────────────┘   │
│  │ • Logged in     │ └─────────────────┘                       │
│  └─────────────────┘                                           │
│                                                                 │
│                                        [View Full Plan →]       │
└─────────────────────────────────────────────────────────────────┘
```

### Empty State

When `plan.length === 0`, ProfileSection renders with `status="not_started"`. No skeleton cards needed—the status badge and empty section body communicate the state.

### Component Structure

```typescript
// src/components/profile/MeasurementPlanSection.tsx

import { Link } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";

interface MeasurementPlanSectionProps {
  plan: Array<{
    entity: { _id: Id<"measurementEntities">; name: string };
    activities: Array<{ _id: Id<"measurementActivities">; name: string }>;
    properties: Array<{ _id: Id<"measurementProperties">; name: string }>;
  }>;
}

export function MeasurementPlanSection({ plan }: MeasurementPlanSectionProps) {
  const entityCount = plan.length;
  const activityCount = plan.reduce((sum, e) => sum + e.activities.length, 0);
  const propertyCount = plan.reduce((sum, e) => sum + e.properties.length, 0);

  const status = entityCount > 0 ? "complete" : "not_started";
  const statusLabel = entityCount > 0 ? `${entityCount} entities` : "Not started";

  return (
    <ProfileSection
      title="Measurement Plan"
      status={status}
      statusLabel={statusLabel}
      actionLabel="View Full Plan"
      actionHref="/measurement-plan"
    >
      {entityCount > 0 ? (
        <>
          <p className="text-sm text-gray-600 mb-4">
            {activityCount} activities · {propertyCount} properties
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plan.map(({ entity, activities }) => (
              <EntityCard
                key={entity._id}
                name={entity.name}
                activities={activities.map(a => a.name)}
              />
            ))}
          </div>
        </>
      ) : null}
    </ProfileSection>
  );
}

function EntityCard({ name, activities }: { name: string; activities: string[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 className="font-medium text-gray-900 mb-2">{name}</h4>
      <ul className="space-y-1">
        {activities.map((activity, i) => (
          <li key={i} className="text-sm text-gray-600 flex items-start">
            <span className="mr-2">•</span>
            <span>{activity}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Data Flow

```
ProfilePage
  └── useQuery(api.measurementPlan.getFullPlan)
        └── MeasurementPlanSection plan={data}
```

ProfilePage fetches `getFullPlan` and passes the result directly. No transformation needed.

## Alternatives Considered

1. **Activity truncation with "+N more"** - Adds complexity (tracking which activities, calculating overflow, styling indicator). Deferred until UX testing reveals need.

2. **Skeleton cards for empty state** - Unnecessary visual noise. The ProfileSection status badge already communicates "not started."

3. **Component owns data fetching** - Would duplicate the query if ProfilePage also needs the data. Props-based is simpler.

## Success Criteria

- [ ] Entity cards render with correct names and activities
- [ ] Summary counts (activities, properties) are accurate
- [ ] "View Full Plan" navigates to `/measurement-plan`
- [ ] Empty state shows "Not started" status (no skeleton cards)
- [ ] Tests cover empty and populated states
