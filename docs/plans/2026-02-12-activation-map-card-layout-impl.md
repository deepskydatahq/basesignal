# Implementation Plan: Activation Map Card Layout Redesign

**Task:** basesignal-2a5 — M006-E003-S001
**Design doc:** `docs/plans/2026-02-12-activation-map-card-layout-design.md`

## Overview

Rewrite ActivationMapSection from a horizontal-scroll stage strip to a responsive 2-column card grid with collapsible detail sections. Delete TransitionConnector, StageCard sub-component, and normalizeDropOffRisk. Follow the ICPProfilesSection pattern for layout, Card components, and collapsible state management.

## Files Changed

| File | Action |
|------|--------|
| `src/components/product-profile/ActivationMapSection.tsx` | Rewrite |
| `src/components/product-profile/ActivationMapSection.test.tsx` | Update |

No backend, schema, or type changes required.

## Tasks

### Task 1: Update tests for new card grid layout (Red phase)

**File:** `src/components/product-profile/ActivationMapSection.test.tsx`

Update the test file to match the new design before rewriting the component. Tests will fail (red) until the component is rewritten in Task 2.

**Changes:**

1. **Add imports:**
   - `userEvent` from `@testing-library/user-event`

2. **Add setup function** (match ICPProfilesSection test pattern):
   ```typescript
   function setup(activationMap: ActivationMap | null = makeMap()) {
     const user = userEvent.setup();
     render(<ActivationMapSection activationMap={activationMap} />);
     return { user };
   }
   ```

3. **Remove 2 tests:**
   - `"transition connectors show trigger events and timeframe"` — TransitionConnector deleted
   - `"handles drop_off_risk as { level, reason } object defensively"` — normalizeDropOffRisk deleted

4. **Update test:** `"stages render sorted by level as horizontal progression cards"`
   - Rename to `"stages render sorted by level in card grid"`
   - Use `setup()` helper
   - Same assertions: `getAllByTestId("stage-card")` length 3, text content checks for Signed Up / Engaged / Activated

5. **Update test:** `"each stage shows level + name and signal strength badge with correct color"`
   - Use `setup()` helper
   - Same assertions work unchanged (level badges, signal strength text + className checks)

6. **Update test:** `"trigger events and value moments render on each stage"`
   - Use `setup()` helper
   - Content is now inside collapsed sections; must expand before asserting
   - Verify count labels visible in collapsed state: buttons matching `/trigger events/i` and `/value moments/i` with counts
   - Click collapsible trigger button to expand, then assert content
   - Pattern: `await user.click(screen.getAllByRole("button", { name: /trigger events/i })[0])` then check for "Account created"

7. **Update test:** `"drop-off risk badge renders green/amber/red"`
   - Use `setup()` helper
   - Same assertions: check text content and className for risk colors

8. **Update test:** `"primary activation level highlighted with distinct border/background"`
   - Use `setup()` helper
   - Keep `ring-indigo-500` assertion
   - Change `bg-indigo-50` to `border-indigo-300` per design doc

9. **Update test:** `"empty state renders when activationMap is null"`
   - Use `setup(null)` helper
   - Same text assertion works: `/no activation map/i`

10. **Add test:** `"collapsible sections show counts and expand on click"`
    - Render with `makeMap()`
    - Assert 3 trigger buttons visible with counts: "Trigger Events (1)" per card
    - Assert 3 value moment buttons visible with counts: "Value Moments (1)" per card
    - Content hidden by default (Radix Collapsible hides children)
    - Click first trigger events button → "Account created" appears
    - Click again → "Account created" disappears

**`makeMap` helper:** Keep `transitions` in fixture data (harmless, just unused).

**Verification:** `npm test -- --run ActivationMapSection` — expect 7 tests, all failing.

---

### Task 2: Rewrite ActivationMapSection component (Green phase)

**File:** `src/components/product-profile/ActivationMapSection.tsx`

Replace the entire component to pass all tests from Task 1.

**Changes:**

1. **Replace imports:**
   ```typescript
   import { useState } from "react";
   import { ChevronDown, ChevronRight } from "lucide-react";
   import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
   import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
   import { Badge } from "@/components/ui/badge";
   import type { ActivationMap } from "./types";
   ```
   Remove: `StageTransition` type import. Remove: standalone `Card` import (now part of destructured import).

2. **Keep constants:**
   - `SIGNAL_COLORS` — unchanged
   - `RISK_COLORS` — unchanged

3. **Delete:**
   - `normalizeDropOffRisk` function
   - `StageCard` sub-component
   - `TransitionConnector` sub-component

4. **Component body:**
   ```typescript
   export function ActivationMapSection({
     activationMap,
   }: {
     activationMap: ActivationMap | null | undefined;
   }) {
     const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
     const toggle = (key: string) =>
       setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

     if (!activationMap) {
       return (
         <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
           No activation map available yet.
         </div>
       );
     }

     const sorted = [...activationMap.stages].sort((a, b) => a.level - b.level);

     return (
       <div>
         <h3 className="mb-4 text-base font-medium text-gray-900">
           Activation Map
         </h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {sorted.map((stage) => {
             const isPrimary = stage.level === activationMap.primary_activation_level;
             return (
               <Card
                 key={stage.level}
                 data-testid="stage-card"
                 className={isPrimary ? "ring-2 ring-indigo-500 border-indigo-300" : ""}
               >
                 <CardHeader>
                   <div className="flex items-center justify-between gap-2">
                     <div className="flex items-center gap-2">
                       <span className="text-sm font-semibold text-gray-500">
                         L{stage.level}
                       </span>
                       <CardTitle>{stage.name}</CardTitle>
                     </div>
                     <Badge className={SIGNAL_COLORS[stage.signal_strength] ?? SIGNAL_COLORS.medium}>
                       {stage.signal_strength}
                     </Badge>
                   </div>
                 </CardHeader>
                 <CardContent className="space-y-3">
                   <div className="flex items-center gap-1">
                     <span className="text-xs font-medium text-gray-500">Drop-off:</span>
                     <Badge className={RISK_COLORS[stage.drop_off_risk] ?? RISK_COLORS.medium}>
                       {stage.drop_off_risk}
                     </Badge>
                   </div>

                   <Collapsible
                     open={!!openSections[`${stage.level}-triggers`]}
                     onOpenChange={() => toggle(`${stage.level}-triggers`)}
                   >
                     <CollapsibleTrigger asChild>
                       <button className="flex items-center gap-2 w-full text-left text-sm font-medium text-gray-700">
                         {openSections[`${stage.level}-triggers`] ? (
                           <ChevronDown className="h-4 w-4" />
                         ) : (
                           <ChevronRight className="h-4 w-4" />
                         )}
                         Trigger Events ({stage.trigger_events.length})
                       </button>
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                       <ul className="mt-1 space-y-1 text-sm text-gray-600">
                         {stage.trigger_events.map((e) => (
                           <li key={e}>{e}</li>
                         ))}
                       </ul>
                     </CollapsibleContent>
                   </Collapsible>

                   <Collapsible
                     open={!!openSections[`${stage.level}-moments`]}
                     onOpenChange={() => toggle(`${stage.level}-moments`)}
                   >
                     <CollapsibleTrigger asChild>
                       <button className="flex items-center gap-2 w-full text-left text-sm font-medium text-gray-700">
                         {openSections[`${stage.level}-moments`] ? (
                           <ChevronDown className="h-4 w-4" />
                         ) : (
                           <ChevronRight className="h-4 w-4" />
                         )}
                         Value Moments ({stage.value_moments_unlocked.length})
                       </button>
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                       <ul className="mt-1 space-y-1 text-sm text-gray-600">
                         {stage.value_moments_unlocked.map((v) => (
                           <li key={v}>{v}</li>
                         ))}
                       </ul>
                     </CollapsibleContent>
                   </Collapsible>
                 </CardContent>
               </Card>
             );
           })}
         </div>
       </div>
     );
   }
   ```

5. **Key decisions:**
   - Collapsible sections inlined directly (no CollapsibleSection helper) — design doc says 2 sections/card doesn't warrant extraction
   - `useState` at top of component, not inside any condition
   - `data-testid="stage-card"` preserved on Card element
   - Primary level: `ring-2 ring-indigo-500 border-indigo-300` (no bg-indigo-50)
   - Empty state: dashed-border div (not Card wrapper)
   - No transition logic at all

**Verification:** `npm test -- --run ActivationMapSection` — expect 7 tests, all passing.

---

### Task 3: Final verification

Run full test suite and TypeScript check:

```bash
npm test -- --run
npx tsc --noEmit
```

Ensure no regressions in other test files.

## Test Strategy

| Test | Type | Status |
|------|------|--------|
| Stages render sorted by level in card grid | Unit (RTL) | Updated |
| Level + name and signal strength badge with colors | Unit (RTL) | Updated |
| Trigger events and value moments expand from collapsible | Unit (RTL + userEvent) | Updated |
| Drop-off risk badges render green/amber/red | Unit (RTL) | Updated |
| Primary activation level highlighted with ring/border | Unit (RTL) | Updated |
| Empty state renders when activationMap is null | Unit (RTL) | Updated |
| Collapsible sections show counts and expand on click | Unit (RTL + userEvent) | **New** |

**Removed tests:**
- Transition connectors (TransitionConnector deleted)
- Defensive drop_off_risk handling (normalizeDropOffRisk deleted)

## Acceptance Criteria Mapping

| AC | Covered By |
|----|------------|
| Responsive grid: grid-cols-1 md:grid-cols-2 | Component layout class |
| Card/CardHeader/CardContent components | Component structure |
| Level badge, name, signal strength badge in header | Test: level + name + signal badge |
| Collapsible trigger events with counts | Test: collapsible sections |
| Collapsible value moments with counts | Test: collapsible sections |
| Drop-off risk as colored badge | Test: drop-off risk badges |
| Primary level highlighted with indigo ring/border | Test: primary level highlighted |
| No horizontal scroll 375px-1440px | Grid layout replaces flex overflow-x-auto |
| data-testid="stage-card" preserved | All tests use getAllByTestId |
| Empty state for null activationMap | Test: empty state |
