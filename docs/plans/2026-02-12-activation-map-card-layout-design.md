# Activation Map Card Layout Design

## Overview

Redesign ActivationMapSection from a linear horizontal-scroll stage layout to a responsive card-based grid. Each activation stage becomes a self-contained Card component with collapsible detail sections. TransitionConnector is removed entirely.

## Problem Statement

The current ActivationMapSection uses a horizontal scroll strip with inline transition connectors between stages. This causes content overflow on narrow viewports, doesn't match the card-based grid pattern used by ICPProfilesSection, and the transition connectors add visual complexity without unique information (trigger events already live on stage cards).

## Expert Perspectives

### Product
- Transition connectors add visual noise without unique data value — trigger events are already on the cards
- Level badges and primary-level ring serve different purposes: badge is informational (which level), ring is navigational (which matters most)
- Collapsible sections respect the user's attention — show counts upfront, details on demand

### Technical
- Drop transitions entirely: stages are self-contained units, not edges; edges don't fit a grid layout
- Follow composition over configuration: stages compose into a grid, transitions were an implementation detail
- Mirror ICPProfilesSection pattern for codebase consistency
- Inline stage card JSX in the map callback — no StageCard sub-component needed

### Simplification Review
- Inline Radix Collapsible directly in each card's render — with only 2 collapsible sections per card, extracting a CollapsibleSection helper is premature abstraction
- Trust TypeScript types for drop_off_risk instead of defensive shape-checking
- RISK_COLORS as a simple 3-entry constant map, no utility function needed
- Remove normalizeDropOffRisk entirely

## Proposed Solution

Replace the horizontal flex layout with a CSS grid. Each stage renders as a Card with CardHeader (badges + name) and CardContent (risk badge + inline collapsible sections). TransitionConnector is deleted.

## Design Details

### Layout
- `grid grid-cols-1 md:grid-cols-2 gap-4` replaces `flex overflow-x-auto`
- Section heading sits above the grid, not inside a wrapping Card
- The outer wrapping Card is removed

### Stage Cards (inlined, no extracted sub-component)
- `Card` with `data-testid="stage-card"`
- Primary level: `ring-2 ring-indigo-500 border-indigo-300`
- **CardHeader:** Level badge ("L1"), stage name (CardTitle), signal strength Badge
- **CardContent:** Drop-off risk Badge, collapsible trigger events, collapsible value moments

### Collapsible Sections (inlined, no extracted helper)
- `useState<Record<string, boolean>>` for expansion state
- Keys: `${stage.level}-triggers`, `${stage.level}-moments`
- All sections start collapsed
- Inline Radix `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` directly in JSX
- Button shows label + count ("Trigger Events (3)"), toggles content visibility
- ChevronDown/ChevronRight icon in trigger button

### Drop-off Risk Badge
- `RISK_COLORS` constant: `{ high: "bg-red-100 text-red-800", medium: "bg-amber-100 text-amber-800", low: "bg-green-100 text-green-800" }`
- Trust the TypeScript type — no defensive shape checking
- Use Badge component for consistency with ICPProfilesSection

### Signal Strength Badge
- Existing `SIGNAL_COLORS` constant retained
- Rendered using Badge component

### Empty State
- Dashed-border empty state for null/undefined activationMap (matches ICPProfilesSection style)
- `rounded-lg border-2 border-dashed border-gray-300 p-8 text-center`

### Removals
- `StageCard` sub-component: inlined into map callback
- `TransitionConnector` sub-component: deleted
- `normalizeDropOffRisk` function: deleted (trust TypeScript types)
- Outer wrapping `Card`: removed
- `StageTransition` import: removed

### New Imports
- `useState` from "react"
- `ChevronDown`, `ChevronRight` from "lucide-react"
- `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` from "@/components/ui/collapsible"
- `CardHeader`, `CardTitle`, `CardContent` from "@/components/ui/card"
- `Badge` from "@/components/ui/badge"

### Test Updates

**Remove:**
- Transition connector test ("transition connectors show trigger events and timeframe")
- normalizeDropOffRisk defensive test ("handles drop_off_risk as { level, reason } object defensively")

**Update:**
- "stages render sorted by level" — same assertions work with grid layout (getAllByTestId + text check)
- "trigger events and value moments render on each stage" — click collapsible triggers to expand first, verify counts in collapsed state
- "primary activation level highlighted" — update assertion to check for `ring-indigo-500` / `border-indigo-300`
- "empty state renders when activationMap is null" — check for dashed-border div pattern

**Add:**
- Collapsible sections show counts collapsed, items when expanded
- Drop-off risk badges render with correct color classes

## Alternatives Considered

1. **Fold transition data into cards** — Add "Typical time to reach" from transitions into each card. Rejected: redundant with trigger events, adds complexity without clear user value.
2. **Extract StageCard sub-component** — Separate component for each card. Rejected: ~50-65 lines of JSX doesn't warrant extraction, inlining keeps layout logic visible in one place.
3. **Extract CollapsibleSection helper** — Mirror ICPProfilesSection's CollapsibleSection pattern. Rejected by simplification review: with only 2 collapsible sections per card, extraction is premature abstraction. Inline Radix Collapsible directly.

## Implementation Plan

### Task 1: Rewrite ActivationMapSection.tsx

**File:** `src/components/product-profile/ActivationMapSection.tsx`

Replace the entire component. Key changes:

1. **Imports** — Add `useState` from react, `ChevronDown`/`ChevronRight` from lucide-react, `Collapsible`/`CollapsibleContent`/`CollapsibleTrigger` from ui/collapsible, `CardHeader`/`CardTitle`/`CardContent` from ui/card, `Badge` from ui/badge. Remove `StageTransition` type import.

2. **Delete** — `normalizeDropOffRisk` function, `StageCard` sub-component, `TransitionConnector` sub-component.

3. **Keep** — `SIGNAL_COLORS` and `RISK_COLORS` constants (already correct).

4. **Empty state** — Change from `<Card><p>` to dashed-border div matching ICPProfilesSection pattern:
   ```tsx
   <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
     No activation map available yet.
   </div>
   ```

5. **Main layout** — Remove outer `<Card>` wrapper. Keep `<h3>` heading above the grid. Replace `flex overflow-x-auto` with `grid grid-cols-1 md:grid-cols-2 gap-4`.

6. **Stage cards** — Each stage renders inline in the `.map()` callback:
   - `<Card data-testid="stage-card" className={isPrimary ? "ring-2 ring-indigo-500 border-indigo-300" : ""}>`
   - `<CardHeader>` with flex row containing:
     - Level badge span ("L1")
     - `<CardTitle>` with stage name
     - `<Badge className={SIGNAL_COLORS[stage.signal_strength]}>` for signal strength
   - `<CardContent className="space-y-3">` with:
     - Drop-off risk row: label + `<Badge className={RISK_COLORS[stage.drop_off_risk]}>`
     - Inline `<Collapsible>` for trigger events with count label
     - Inline `<Collapsible>` for value moments with count label

7. **Collapsible state** — `useState<Record<string, boolean>>({})` with toggle function, keyed by `${stage.level}-triggers` and `${stage.level}-moments`. ChevronDown when open, ChevronRight when closed.

8. **No transition logic** — Remove the `transitions.find()` lookup and `TransitionConnector` rendering entirely.

### Task 2: Update ActivationMapSection.test.tsx

**File:** `src/components/product-profile/ActivationMapSection.test.tsx`

1. **Add import:** `userEvent` from `@testing-library/user-event`

2. **Remove tests:**
   - "transition connectors show trigger events and timeframe" — TransitionConnector is deleted
   - "handles drop_off_risk as { level, reason } object defensively" — normalizeDropOffRisk is deleted

3. **Update test:** "stages render sorted by level as horizontal progression cards"
   - Rename to "stages render sorted by level in card grid"
   - Same assertions (getAllByTestId + textContent checks) — these work unchanged

4. **Update test:** "trigger events and value moments render on each stage"
   - Content is now inside collapsible sections, starts collapsed
   - Need to click the collapsible trigger button to expand before asserting content
   - Verify count labels are visible in collapsed state: "Trigger Events (1)", "Value Moments (1)"
   - After clicking trigger, verify items render

5. **Update test:** "primary activation level highlighted with distinct border/background"
   - Keep `ring-indigo-500` assertion (unchanged)
   - Change `bg-indigo-50` assertion to `border-indigo-300` (design doc specifies border, not background)

6. **Update test:** "empty state renders when activationMap is null"
   - Assert the dashed-border pattern: check for the text and absence of stage cards (same assertions work)

7. **Add test:** "collapsible sections show counts collapsed and items when expanded"
   - Render with makeMap()
   - Verify collapsed trigger buttons show counts
   - Click a trigger button
   - Verify items appear in expanded content
   - Click again to collapse, verify items hidden

8. **`makeMap` helper** — Keep `transitions` in the test data (it's harmless, just unused now). No changes needed.

### Task 3: Verify

- Run `npm test` to ensure all tests pass
- Verify no TypeScript errors with the build

## Success Criteria

- All 9 acceptance criteria from the story pass
- No horizontal scroll at any viewport width 375px-1440px
- Visual consistency with ICPProfilesSection card grid
- Tests pass with collapsible interaction coverage
