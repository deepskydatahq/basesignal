# JourneyMapSection Design

## Overview

JourneyMapSection displays a horizontal flow diagram showing the user's journey stages grouped by lifecycle slot. It uses the existing ProfileSection wrapper and provides an "Edit Journey" action to navigate to the journey editor.

## Problem Statement

Users need to see a quick visual summary of their defined journey on the Profile Home Page. This helps them understand their journey structure at a glance and identify which lifecycle slots have been defined.

## Expert Perspectives

### Product
- Show empty slots as grayed-out placeholders so users get a complete mental model of the journey framework
- Visual hierarchy (filled vs grayed) communicates status without text
- The "Edit Journey" link provides a clear path forward for users who want to fill gaps
- One representative stage per slot keeps the view scannable

### Technical
- Group by `lifecycleSlot` using canonical LIFECYCLE_SLOTS order, not position.x coordinates
- Position.x is editor UI state, not business meaning
- Reuse `SLOT_INFO[slot].name` for display labels - no custom mapping
- Status derived from existing completion logic: canComplete → complete, stages.length > 0 → in_progress, else not_started

### Simplification Review
- Removed ArrowConnector sub-component - render arrows inline with slots
- Removed SlotBox sub-component - inline slot rendering in map loop
- Inlined status logic - simple 3-branch conditional doesn't need utility import
- Kept data fetching in JourneyMapSection (architectural separation from broader profile refactor)

## Proposed Solution

Two components:
1. **JourneyMapSection** - Container that fetches stages, computes status, wraps in ProfileSection
2. **JourneyDiagram** - Pure presentation component that renders the horizontal flow

### Data Flow
```
JourneyMapSection
  └─ useQuery(api.stages.list, { journeyId })
  └─ Compute status from stages
  └─ ProfileSection wrapper
       └─ JourneyDiagram (pure presentation)
```

### Visual Design
```
[Reach]──>[Activation]──>[Engagement]──>[Value Capture]──>[Retention]
 filled     filled         empty           empty           empty
```

- All 5 lifecycle slots always shown
- Filled slots: solid border, blue background, show stage name
- Empty slots: dashed border, gray background, show slot name only
- Arrows connect slots horizontally

## Design Details

### JourneyMapSection.tsx

```typescript
import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "../../../convex/_generated/api";
import { useProfile } from "../../contexts/ProfileContext";
import { ProfileSection } from "./ProfileSection";
import { JourneyDiagram } from "./JourneyDiagram";

export function JourneyMapSection() {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const stages = useQuery(
    api.stages.list,
    profile?.overviewJourneyId
      ? { journeyId: profile.overviewJourneyId }
      : "skip"
  );

  // Inline status calculation
  const status = (() => {
    if (!stages || stages.length === 0) return "not_started";
    const requiredSlots = ["account_creation", "activation", "core_usage"];
    const filledSlots = new Set(stages.map(s => s.lifecycleSlot));
    const allRequired = requiredSlots.every(slot => filledSlots.has(slot));
    return allRequired ? "complete" : "in_progress";
  })();

  const handleEditJourney = () => {
    if (profile?.overviewJourneyId) {
      navigate(`/journeys/${profile.overviewJourneyId}`);
    }
  };

  return (
    <ProfileSection
      title="Journey Map"
      status={status}
      action={
        profile?.overviewJourneyId
          ? { label: "Edit Journey", onClick: handleEditJourney }
          : undefined
      }
    >
      <JourneyDiagram stages={stages ?? []} />
    </ProfileSection>
  );
}
```

### JourneyDiagram.tsx

```typescript
import { LIFECYCLE_SLOTS, SLOT_INFO, type LifecycleSlot } from "../../shared/lifecycleSlots";

interface Stage {
  _id: string;
  name: string;
  lifecycleSlot: LifecycleSlot;
}

interface JourneyDiagramProps {
  stages: Stage[];
}

export function JourneyDiagram({ stages }: JourneyDiagramProps) {
  // Group stages by slot (first stage per slot)
  const stageBySlot = new Map<LifecycleSlot, Stage>();
  stages.forEach(stage => {
    if (!stageBySlot.has(stage.lifecycleSlot)) {
      stageBySlot.set(stage.lifecycleSlot, stage);
    }
  });

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {LIFECYCLE_SLOTS.map((slot, index) => {
        const stage = stageBySlot.get(slot);
        const isEmpty = !stage;
        const isLast = index === LIFECYCLE_SLOTS.length - 1;

        return (
          <div key={slot} className="flex items-center">
            {/* Slot box - inline, no sub-component */}
            <div
              className={`
                flex flex-col items-center justify-center
                w-28 h-20 rounded-lg border-2 px-2
                ${isEmpty
                  ? "border-dashed border-gray-300 bg-gray-50"
                  : "border-solid border-blue-500 bg-blue-50"
                }
              `}
            >
              <span className={`text-xs font-medium ${isEmpty ? "text-gray-400" : "text-blue-600"}`}>
                {SLOT_INFO[slot].name}
              </span>
              {stage && (
                <span className="text-sm font-semibold text-gray-900 text-center truncate w-full mt-1">
                  {stage.name}
                </span>
              )}
            </div>

            {/* Arrow - inline, no sub-component */}
            {!isLast && (
              <svg
                className="w-6 h-6 text-gray-400 mx-1"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

## Test Strategy

### JourneyMapSection.test.tsx
- No journey: renders without Edit Journey button, status is not_started
- Empty journey: Edit Journey button present, status is not_started
- Partial journey (some required slots): status is in_progress
- Complete journey (all required slots): status is complete
- Edit Journey click navigates to correct route

### JourneyDiagram.test.tsx
- Empty stages: all 5 slots shown as empty placeholders
- Partial stages: mix of filled and empty slots
- Full stages: all slots show stage names
- Slot order matches LIFECYCLE_SLOTS constant
- Uses SLOT_INFO names for labels

## Alternatives Considered

1. **Sort by position.x** - Rejected. Position is editor UI state, not business meaning. Canonical slot order is more meaningful for a summary view.

2. **Skip empty slots** - Rejected. Showing all slots gives users complete mental model of the framework and helps them see what's missing.

3. **Separate ArrowConnector/SlotBox components** - Rejected during simplification review. Inline rendering is simpler for this fixed 5-slot layout.

## Success Criteria

- Components render correctly for empty, partial, and complete journeys
- Status badge reflects journey completion accurately
- Edit Journey navigates to correct route
- All tests pass
- Visual design matches wireframe from profile-home-page-design.md
