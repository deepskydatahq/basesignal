# Recommendation Logic Design

## Overview

Implement logic that determines which action to recommend based on the user's profile completion state. The logic follows a fixed sequence of navigable sections while treating inline-editable sections as optional refinements.

## Problem Statement

Users need guidance on what to do next after completing each step of their product profile setup. Without clear direction, they may abandon the onboarding flow or miss critical steps.

## Expert Perspectives

### Product (Butterfield-style)
- Don't recommend Core Identity first—recommend the next interview
- The user's job is to understand their product's P&L, which happens through interview workflows
- Inline-editable sections are refinements, not blocking prerequisites
- If Core Identity needs completing, surface that friction at interview start, not as a blocking suggestion

### Technical (Abramov-style)
- Completeness ≠ sequencing: measure all 5 sections but only suggest navigation for 3
- The `calculateCompleteness()` function already tracks all sections holistically
- Recommendation logic can intelligently choose navigable sections without hiding the fuller context

### Simplification Review (Jobs-style)
**Cuts made:**
- Removed `lastCompleted` prop and contextual heading logic - adds complexity without value
- Made SuggestedNextAction self-contained rather than prop-driven
- Single render location instead of scattered conditionals

## Proposed Solution

### Design Decisions

**1. Only recommend navigable sections**
- `journey_map` - Requires Overview Interview workflow
- `metric_catalog` - Requires Generate Metrics workflow
- `measurement_plan` - Requires Build Measurement Plan workflow

**2. Skip inline-editable sections**
- `core_identity` - Editable directly on ProfilePage
- `first_value` - Editable directly on ProfilePage

**3. Fixed prioritization sequence**
```
journey_map → metric_catalog → measurement_plan
```

This matches the logical flow: map journey → generate metrics → build measurement plan.

### Recommendation Logic

```typescript
// In SuggestedNextAction.tsx - self-contained component
const NAVIGABLE_SEQUENCE = ["journey_map", "metric_catalog", "measurement_plan"] as const;

function getNextSection(completeness: CompletenessInfo):
  "journey_map" | "metric_catalog" | "measurement_plan" | null {
  const sectionMap = new Map(
    completeness.sections.map(s => [s.id, s.complete])
  );

  return NAVIGABLE_SEQUENCE.find(id => !sectionMap.get(id)) ?? null;
}
```

### Component Design

SuggestedNextAction is self-contained:
- Takes `profileId` as prop
- Fetches completeness data via `useQuery`
- Internally determines which section to recommend
- Returns `null` if all navigable sections complete

```tsx
export function SuggestedNextAction({ profileId }: { profileId: Id<"profiles"> }) {
  const profileData = useQuery(api.profile.getProfileData, { profileId });

  if (!profileData?.completeness) return null;

  const nextSection = getNextSection(profileData.completeness);
  if (!nextSection) return null;

  const config = SECTION_CONFIG[nextSection];

  return (
    <Card>
      <h3>{config.heading}</h3>
      <p>{config.description}</p>
      <Link to={config.route}>
        <Button>{config.cta}</Button>
      </Link>
    </Card>
  );
}

const SECTION_CONFIG = {
  journey_map: {
    heading: "Map Your User Journey",
    description: "Define the key moments in your user's lifecycle",
    cta: "Start Interview",
    route: "/setup/interview"
  },
  metric_catalog: {
    heading: "Generate Your Metrics",
    description: "Create metrics that measure each journey stage",
    cta: "Generate Metrics",
    route: "/metric-catalog"
  },
  measurement_plan: {
    heading: "Build Your Measurement Plan",
    description: "Connect metrics to your data sources",
    cta: "Build Plan",
    route: "/measurement-plan"
  }
};
```

### Edge Cases

| State | Behavior |
|-------|----------|
| **None complete** | Recommend `journey_map` |
| **Core Identity only** | Recommend `journey_map` |
| **Journey complete** | Recommend `metric_catalog` |
| **All 3 navigable complete** | Return `null`, don't render |

### Component Placement

Single render location in ProfilePage, after JourneyMapSection:

```tsx
<CoreIdentitySection />
<JourneyMapSection />
<SuggestedNextAction profileId={profileId} />
<FirstValueSection />
<MetricCatalogSection />
<MeasurementPlanSection />
```

The component internally determines whether to render based on completeness state.

## Alternatives Considered

1. **Recommend all sections including inline-editable** - Rejected because inline sections don't unlock new insights; they're refinements
2. **Context-aware headings based on lastCompleted** - Rejected during simplification review; adds complexity without proportional value
3. **Multiple render locations** - Rejected; single location is simpler and the component is self-aware

## Success Criteria

- [ ] `getNextSection()` function returns correct section based on completeness
- [ ] SuggestedNextAction renders only when there's a next step
- [ ] Clicking CTA navigates to correct workflow
- [ ] Component returns null when all navigable sections complete
- [ ] Tests cover all edge cases (none complete, partial, all complete)

## Files to Create/Modify

1. **Create**: `src/components/profile/SuggestedNextAction.tsx`
2. **Create**: `src/components/profile/SuggestedNextAction.test.tsx`
3. **Modify**: `src/components/profile/ProfilePage.tsx` - Add single SuggestedNextAction render
