# SuggestedNextAction Component Design

## Overview

Create a minimal `SuggestedNextAction` component that displays the recommended next step for users based on their profile completion state. Appears after the last completed section to create momentum from progress.

## Problem Statement

Users finishing a section may feel uncertain about what to do next. The SuggestedNextAction component eliminates the "now what?" moment by immediately presenting the next logical step with contextual framing.

## Expert Perspectives

### Product
- Place between sections as contextual clarity, not at top (noise) or floating (anxiety-inducing)
- Show always, framing as "here's the next insight that unlocks what you just built"
- Position after the last completed section to create momentum from progress
- When all sections complete, simply don't render - the completed profile IS the celebration

### Technical
- Only 3 navigable sections need this: journey_map, metric_catalog, measurement_plan
- Core Identity and First Value are inline-editable, skip them
- Derive next action directly from completion state, no mapping abstraction needed

### Simplification Review (Jobs Review)
**Removed:**
- SECTION_CONFIG mapping abstraction - inline the 3 cases directly
- getHeading(lastCompleted) function - use simple inline conditionals
- Gradient border visual distinction - use simpler styling that doesn't add cognitive load
- Insertion index calculations - position at fixed logical points in the page flow

**Simplified:**
- Hard-code the sequence based on the existing section order
- Don't create special completion state handling - implicit in render logic

## Proposed Solution

A minimal component that:
1. Receives completion state from ProfilePage
2. Determines the first incomplete navigable section (journey_map → metric_catalog → measurement_plan)
3. Renders a simple card with contextual heading, one-line description, and CTA button
4. Returns null when nothing to suggest

## Design Details

### Component Structure

```typescript
// src/components/profile/SuggestedNextAction.tsx
interface SuggestedNextActionProps {
  nextSection: "journey_map" | "metric_catalog" | "measurement_plan" | null;
  lastCompleted: string | null;
}

export function SuggestedNextAction({ nextSection, lastCompleted }: SuggestedNextActionProps) {
  const navigate = useNavigate();

  if (!nextSection) return null;

  // Inline the 3 cases - no abstraction needed
  let heading: string;
  let description: string;
  let buttonLabel: string;
  let route: string;

  if (nextSection === "journey_map") {
    heading = lastCompleted === "core_identity"
      ? "Now let's map your user journey"
      : "Map your user journey";
    description = "A 10-minute conversation to identify your product's key lifecycle moments.";
    buttonLabel = "Start Overview Interview";
    route = "/setup/interview";
  } else if (nextSection === "metric_catalog") {
    heading = lastCompleted === "first_value"
      ? "Turn your first value moment into metrics"
      : "Generate your metric catalog";
    description = "Create a complete set of product metrics based on your journey.";
    buttonLabel = "Generate Metrics";
    route = "/metric-catalog";
  } else {
    heading = "Connect metrics to your data";
    description = "Map your metrics to events from your analytics platform.";
    buttonLabel = "Build Measurement Plan";
    route = "/measurement-plan";
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
      <h3 className="font-semibold text-gray-900">{heading}</h3>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      <Button onClick={() => navigate(route)} className="mt-3" size="sm">
        {buttonLabel}
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
```

### ProfilePage Integration

ProfilePage computes what to suggest and where to render:

```typescript
// Compute next section to suggest
const sections = profile.completeness.sections.slice(0, 5);
const completedIds = sections.filter(s => s.complete).map(s => s.id);
const navigableSections = ["journey_map", "metric_catalog", "measurement_plan"];
const nextSection = navigableSections.find(id => !completedIds.includes(id)) ?? null;
const lastCompleted = completedIds.length > 0 ? completedIds[completedIds.length - 1] : null;

// Render at fixed positions based on what's next
return (
  <div className="space-y-6">
    <CoreIdentitySection ... />
    {nextSection === "journey_map" && (
      <SuggestedNextAction nextSection={nextSection} lastCompleted={lastCompleted} />
    )}

    <JourneyMapSection ... />
    {nextSection === "metric_catalog" && (
      <SuggestedNextAction nextSection={nextSection} lastCompleted={lastCompleted} />
    )}

    <FirstValueSection ... />
    {/* metric_catalog suggestion already shown above if needed */}

    <MetricCatalogSection ... />
    {nextSection === "measurement_plan" && (
      <SuggestedNextAction nextSection={nextSection} lastCompleted={lastCompleted} />
    )}

    <MeasurementPlanSection ... />
  </div>
);
```

### Visual Design

- Light blue background (bg-blue-50) with subtle border (border-blue-200)
- No gradient, no special icon - blends with page flow
- Draws attention through position and copy, not visual weight

## Alternatives Considered

1. **Configuration object mapping** - Rejected as premature abstraction for only 3 cases
2. **Insertion index calculation** - Rejected as over-engineering; fixed positions are clearer
3. **Gradient border with Sparkles icon** - Rejected as adding visual noise without function
4. **Always showing at page top** - Rejected as becoming invisible noise

## Success Criteria

- Component renders the correct next step based on completion state
- CTA navigates to the appropriate interview/page
- Component does not render when all navigable sections are complete
- Visual design guides attention without feeling disruptive
