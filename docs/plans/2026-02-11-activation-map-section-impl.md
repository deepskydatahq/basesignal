# Implementation Plan: ActivationMapSection Component

**Task:** basesignal-v9d — M005-E003-S002: Build ActivationMapSection component
**Design doc:** `docs/plans/2026-02-11-activation-map-section-design.md`

## Overview

Build a pure presentational component that renders activation stages as a horizontal scrolling row of cards with transition connectors. Each stage shows signal strength, trigger events, value moments, and drop-off risk. The primary activation level is visually highlighted.

## Prerequisites

- **Dependency:** basesignal-ohe (ProductProfilePage) — but ActivationMapSection is standalone and can be built independently since it only receives `activationMap: ActivationMap` as props.
- **Existing UI components:** `Card`, `CardHeader`, `CardTitle`, `CardContent` from `src/components/ui/card.tsx`, `Badge` from `src/components/ui/badge.tsx`
- **Backend types:** `ActivationMap`, `ActivationStage`, `StageTransition`, `SignalStrength` from `convex/analysis/outputs/types.ts`
- **Types re-export:** `src/components/product-profile/types.ts` may already exist from ValueMomentsSection; add `ActivationMap` re-export if needed.

## Tasks

### Task 1: Ensure types re-export file exists

**File:** `src/components/product-profile/types.ts`

If already created by ValueMomentsSection task, add ActivationMap types:

```typescript
export type { ActivationMap, ActivationStage, StageTransition } from "../../../convex/analysis/outputs/types";
```

If not yet created, create the file with all needed re-exports.

### Task 2: Write tests for ActivationMapSection

**File:** `src/components/product-profile/ActivationMapSection.test.tsx`

Write tests first (TDD), covering all 8 acceptance criteria.

**Test fixture (stages deliberately out of order to verify sorting):**
```typescript
const mockActivationMap: ActivationMap = {
  stages: [
    {
      level: 2, name: "Learner", signal_strength: "medium",
      trigger_events: ["completed tutorial"], value_moments_unlocked: ["first insight"],
      drop_off_risk: "medium",
    },
    {
      level: 1, name: "Explorer", signal_strength: "weak",
      trigger_events: ["signed up", "browsed docs"], value_moments_unlocked: ["account access"],
      drop_off_risk: "high",
    },
    {
      level: 3, name: "Champion", signal_strength: "strong",
      trigger_events: ["shared dashboard"], value_moments_unlocked: ["team value"],
      drop_off_risk: "low",
    },
  ],
  transitions: [
    { from_level: 1, to_level: 2, trigger_events: ["completed onboarding"], typical_timeframe: "1-3 days" },
    { from_level: 2, to_level: 3, trigger_events: ["invited teammate"], typical_timeframe: "1-2 weeks" },
  ],
  primary_activation_level: 2,
  confidence: 0.8,
  sources: ["website"],
};
```

**Setup function:**
```typescript
function setup(props: { activationMap?: ActivationMap | null } = {}) {
  return render(<ActivationMapSection activationMap={props.activationMap ?? null} />);
}
```

**8 tests:**

1. **Stages sorted by level** — Render with mock data (stages out of order). Query all stage cards, verify order is Explorer (1), Learner (2), Champion (3).
2. **Level + name and signal strength badge** — Check "Level 1: Explorer" text exists, badge shows "weak" with gray color class.
3. **Trigger events and value moments** — Check "signed up", "browsed docs", "account access" render.
4. **Drop-off risk badge colors** — Check "high" risk gets red class, "medium" gets amber, "low" gets green.
5. **Transition connectors** — Check "completed onboarding" and "1-3 days" text renders between stages.
6. **Primary activation highlight** — Find the Learner card (level 2 = primary), assert it has `ring-indigo-500` class.
7. **Object-shaped drop_off_risk** — Render with `drop_off_risk: { level: "high", reason: "complex onboarding" }` cast as `any`, verify "high" badge renders.
8. **Empty state** — Render with `activationMap={null}`, verify "No activation map available" text.

No Convex mocking needed — pure presentation component.

### Task 3: Build ActivationMapSection component

**File:** `src/components/product-profile/ActivationMapSection.tsx`

**Imports:**
```typescript
import type { ActivationMap, StageTransition } from "../../../convex/analysis/outputs/types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
```

**Constants (module-level):**
```typescript
const SIGNAL_COLORS: Record<string, string> = {
  very_strong: "bg-indigo-100 text-indigo-800",
  strong: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  weak: "bg-gray-100 text-gray-800",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};
```

**Helper (in-file):**
```typescript
function normalizeDropOffRisk(risk: unknown): "low" | "medium" | "high" {
  if (typeof risk === "string") return risk as "low" | "medium" | "high";
  if (risk && typeof risk === "object" && "level" in risk) {
    return (risk as { level: string }).level as "low" | "medium" | "high";
  }
  return "medium"; // safe default
}
```

**Component structure (~80-100 lines total):**
1. Guard: if `!activationMap || !activationMap.stages.length` → render `<p>No activation map available</p>`
2. Sort stages: `const sortedStages = [...activationMap.stages].sort((a, b) => a.level - b.level)`
3. Render flex row: `<div className="flex items-center gap-2 overflow-x-auto pb-2">`
4. For each stage (with index):
   - If `index > 0`: render transition connector div with arrow (→), trigger events, and timeframe from `activationMap.transitions.find(t => t.from_level === sortedStages[index-1].level && t.to_level === stage.level)`
   - Render `<Card className="min-w-[240px] shrink-0 ...">` with `ring-2 ring-indigo-500 bg-indigo-50` if primary
   - `<CardHeader>`: "Level {level}: {name}" + `<Badge>` with signal strength
   - `<CardContent>`: trigger events list, value moments list, drop-off risk badge

**No extracted sub-components.** Everything inlined per design review.

### Task 4: Run tests and verify

```bash
npm test -- --run ActivationMapSection
npm run lint
```

Verify all 8 tests pass and no lint errors.

## Files Summary

### Files to Create
1. `src/components/product-profile/ActivationMapSection.tsx` (~80-100 lines)
2. `src/components/product-profile/ActivationMapSection.test.tsx` (~100 lines)

### Files to Modify
1. `src/components/product-profile/types.ts` — add ActivationMap type re-exports (create if not exists)

## Testing Strategy

- **Type:** React component unit tests with RTL
- **Approach:** Pure presentational component — no Convex mocking needed. Just render with props and assert output.
- **Coverage:** All 8 acceptance criteria mapped to 8 tests
- **Command:** `npm test -- --run ActivationMapSection`

## Acceptance Criteria

All 8 tests pass, mapping 1:1 to the story's acceptance criteria:
1. Stages render as horizontal progression cards sorted by level
2. Each stage shows level + name, signal strength badge (color-coded)
3. Trigger events and value moments unlocked display on each stage
4. Drop-off risk indicator renders as green/amber/red
5. Transition connectors between stages show trigger events and timeframe
6. Primary activation level highlighted with distinct border/background
7. Handles drop_off_risk as both { level, reason } object and string defensively
8. Empty state renders when no activation map exists
