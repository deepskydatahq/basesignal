# MeasurementSpecSection Design

## Overview
A single display component that renders a measurement spec with summary stats, events grouped by category as collapsible cards, and expandable property detail tables. Receives `MeasurementSpec | null | undefined` and handles empty state inline.

## Problem Statement
The Product Profile View (M005) needs to display AI-generated measurement specifications showing which events to track, grouped by category (activation, value, retention, expansion), with expandable property details per event.

## Expert Perspectives

### Product
- The measurement spec is the actionable output of the analysis pipeline — it answers "what should I track?"
- Categories map cleanly to the P&L framework layers (reach → activation, engagement → value, etc.)
- Display should be scannable: summary first, then drill into categories and events

### Technical
- **Collapsible cards, not table rows.** Radix Collapsible wraps content in a `<div>`, which is invalid inside `<tbody>`. Instead of fighting HTML semantics, each event renders as a collapsible card with a row-like flex layout trigger and an expandable properties Table inside.
- Mental model: "A category is a section, each event is an expandable card" rather than "a table with expandable rows."
- This mirrors the existing `FieldMappingsSection` pattern where Collapsible wraps whole sections.

### Simplification Review
- **Flattened structure**: No separate helper components (`EventCard`, `CategorySection`, `MapsToLabel`, `groupEventsByCategory`). Everything renders inline in the main component, keeping it to ~150 lines.
- **Categories from data**: Instead of hardcoding a fixed category order constant, let categories emerge from the data. If ordering is needed for visual hierarchy, use a simple sort.
- **Single component file**: All logic co-located in one file. Internal helpers only if truly needed for readability.

## Proposed Solution

Single file: `src/components/product-profile/MeasurementSpecSection.tsx`

### Structure
1. **Empty state guard** — if no spec, show "No measurement spec generated yet" message
2. **Summary bar** — flex row showing total events, confidence score (as percentage), and per-category count badges with category colors
3. **Category sections** — group events by category, render each group as a section with colored header + count badge
4. **Event cards** — each event is a `Collapsible` where:
   - Trigger: flex row with chevron icon, event name (mono), description (truncated), trigger condition, maps_to badge
   - Content: bordered `Table` showing properties (name, type, description)

### Category Colors
- activation = indigo
- value = emerald
- retention = amber
- expansion = purple

### MapsTo Badge
Discriminated union rendered as colored Badge:
- `value_moment` → emerald "Value Moment"
- `activation_level` → indigo "Activation L{level}"
- `both` → purple "Both"

### Props
```typescript
interface Props {
  measurementSpec: MeasurementSpec | null | undefined
}
```

## Design Details

### Data Flow
```
MeasurementSpec prop
  → null check (empty state)
  → group events by category (inline reduce)
  → render summary bar from spec.total_events, spec.confidence, category counts
  → iterate categories, render section per group
    → iterate events, render Collapsible card per event
      → expand to show properties Table
```

### UI Components Used
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` — for properties sub-tables
- `Badge` — for category counts, maps_to labels
- `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` — for expandable event cards
- `ChevronRight` / `ChevronDown` from lucide-react — expand/collapse indicators

### Test Plan (5 tests → 5 acceptance criteria)
1. Summary bar renders total events, confidence percentage, category count badges
2. Events grouped by category with header and count badge
3. Event card shows name, description, trigger condition, maps_to badge
4. Click event card → properties table appears with name/type/description columns
5. Null prop renders empty state message

## Alternatives Considered

**Table with collapsible rows** — Rejected because Radix Collapsible outputs `<div>` which is invalid inside `<tbody>`. Would cause HTML validation issues with accessibility tools and browser extensions.

**Multiple component files** — Rejected per simplification review. Single file with inline rendering is clearer for a display-only component of this size.

**Fixed category ordering constant** — Removed per simplification review. Categories emerge from data; if ordering matters, a simple sort suffices.

## Success Criteria
- All 5 unit tests pass covering the acceptance criteria
- Component renders correctly with real `MeasurementSpec` data from `convex/analysis/outputs/types.ts`
- Empty state handles null/undefined gracefully
- Collapsible cards expand/collapse without DOM validation issues
