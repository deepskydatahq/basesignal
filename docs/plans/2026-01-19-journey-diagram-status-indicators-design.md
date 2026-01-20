# Journey Diagram Status Indicators Design

## Overview

Add definition status indicators to JourneyDiagram stages by extending the existing visual styling system. Each stage slot will display one of three states through border and background treatment: empty (dashed border, gray background), partial (solid border, amber background), or complete (solid border, blue background).

## Problem Statement

Users need to see at a glance which stages in their journey have complete definitions vs partially defined vs empty. Currently, the diagram only distinguishes between "has stage" and "no stage" - it doesn't show whether a stage has the required entity+action structured fields that make it measurable.

## Expert Perspectives

### Product

- **"Partially defined"** = has stage name + at least one of (entity OR action), but NOT both together
- The entity-action structure transforms vague intent ("activation") into measurable reality ("new users who completed onboarding")
- The indicator makes *remaining work visible* so users know what to fill in next
- Blue background alone is sufficient for "complete" - no checkmark needed
- Core job: "scan my journey and understand what's missing in ~2 seconds"

### Technical

- Pass pre-computed status as a single value to JourneyDiagram rather than extending the Stage interface
- Status logic is a *display concern*, not a stage property
- Keep business logic in JourneyMapSection, keep JourneyDiagram purely presentational
- Integrate status into existing border/background styling rather than adding new visual elements

### Simplification Review

- **No checkmarks or icons** - Color-coded backgrounds provide sufficient visual distinction
- **Keep status computation simple** - Inline logic in JourneyMapSection, no separate utility function
- **Three states are required** - Issue explicitly requests complete/partial/empty indicators
- **Reuse existing visual language** - Dashed/solid borders + background colors already communicate state

## Proposed Solution

Extend JourneyDiagram to accept a status prop per stage and render three visual states using the existing border/background styling system.

## Design Details

### Visual States

| Status | Border | Background | Meaning |
|--------|--------|------------|---------|
| `empty` | dashed gray | gray-50 | No stage assigned to slot |
| `partial` | solid amber | amber-50 | Has stage but missing entity or action |
| `complete` | solid blue | blue-50 | Has both entity AND action |

### Status Logic

```typescript
type StageStatus = "complete" | "partial" | "empty";

function getStageStatus(stage: Stage | undefined): StageStatus {
  if (!stage) return "empty";
  if (stage.entity && stage.action) return "complete";
  if (stage.entity || stage.action) return "partial";
  return "partial"; // Has name but no entity/action = partial
}
```

Note: A stage with only a name (no entity, no action) is still "partial" because the user has committed intent but hasn't specified the measurable activity.

### Data Flow

1. JourneyMapSection has full stage data from `api.stages.listByJourney` (includes entity, action)
2. JourneyMapSection computes status for each stage
3. JourneyMapSection passes stages to JourneyDiagram with status included
4. JourneyDiagram renders appropriate styling based on status

### Component Changes

**JourneyMapSection**
- Pass `entity` and `action` to JourneyDiagram (currently filtered out)
- No separate status computation needed - let JourneyDiagram handle it

**JourneyDiagram**
- Extend Stage interface to include optional `entity` and `action` fields
- Add inline status logic to determine visual state
- Update Tailwind classes based on status:
  - Empty: `border-dashed border-gray-300 bg-gray-50`
  - Partial: `border-solid border-amber-400 bg-amber-50`
  - Complete: `border-solid border-blue-500 bg-blue-50`

### Tailwind Classes

```typescript
const statusClasses = {
  empty: "border-dashed border-gray-300 bg-gray-50",
  partial: "border-solid border-amber-400 bg-amber-50",
  complete: "border-solid border-blue-500 bg-blue-50",
};
```

## Alternatives Considered

1. **Add status indicators as icons/dots** - Rejected because it adds visual complexity and doesn't integrate with existing styling
2. **Only two states (empty/filled)** - Rejected because issue explicitly requires three states
3. **Pre-compute status in parent** - Considered but simpler to pass entity/action and let JourneyDiagram compute status inline
4. **Add checkmark for complete state** - Rejected as unnecessary visual weight; color alone is sufficient

## Success Criteria

- Each stage slot shows a visual status indicator via border/background styling
- Three distinct states are clearly visible: empty (gray), partial (amber), complete (blue)
- Users can assess journey completeness at a glance (~2 seconds)
- Visual treatment integrates naturally with existing diagram styling
