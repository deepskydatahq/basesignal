# Implementation Plan: MeasurementSpecSection (basesignal-x1d)

## Summary

Build `MeasurementSpecSection` — a single-file, props-driven display component that renders an AI-generated measurement spec. Shows a summary bar (total events, confidence, category breakdown), events grouped by category as collapsible cards, and expandable property detail tables.

## Files to Create

1. `src/components/product-profile/MeasurementSpecSection.tsx` (~150 lines)
2. `src/components/product-profile/MeasurementSpecSection.test.tsx` (~120 lines)

## Files to Modify

None. Component is self-contained; parent integration happens in a separate task (basesignal-ohe).

## Implementation Steps

### Step 1: Create `src/components/product-profile/MeasurementSpecSection.tsx`

**Props:**
```typescript
interface Props {
  measurementSpec: MeasurementSpec | null | undefined
}
```

**Imports:**
- `useState` from `react`
- `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` from `../ui/table`
- `Badge` from `../ui/badge`
- `Collapsible, CollapsibleContent, CollapsibleTrigger` from `../ui/collapsible`
- `ChevronRight, ChevronDown` from `lucide-react`
- `MeasurementSpec` type from `../../../convex/analysis/outputs/types`

**Component structure (top to bottom):**

1. **Empty state guard** — if `!measurementSpec`, render muted paragraph: "No measurement spec generated yet"

2. **Group events by category** — inline `reduce` over `measurementSpec.events` to produce `Record<string, TrackingEvent[]>`

3. **Summary bar** — flex row containing:
   - Total events count (`spec.total_events`)
   - Confidence as percentage (`Math.round(spec.confidence * 100)%`)
   - Per-category count badges with category-specific colors

4. **Category sections** — iterate `Object.entries(grouped)`, for each category:
   - Section header: capitalized category name + count Badge
   - Category color map: `activation=indigo`, `value=emerald`, `retention=amber`, `expansion=purple`, fallback=`gray`

5. **Event cards** — each event is a `Collapsible` (not a table row):
   - **Trigger**: flex row with:
     - ChevronRight/ChevronDown toggle
     - Event name in `font-mono`
     - Description (truncated via `truncate` class)
     - Trigger condition
     - `maps_to` badge:
       - `value_moment` → emerald "Value Moment"
       - `activation_level` → indigo `"Activation L{level}"`
       - `both` → purple "Both"
   - **Content**: bordered `Table` with property rows:
     - Columns: Name, Type, Description
     - Data from `event.properties`

**State management:** Single `useState<Set<string>>` tracking which events are expanded (keyed by event name), or individual `useState<boolean>` per event using a wrapper pattern. Simplest approach: use `Collapsible` with its own internal state (no controlled state needed) since we don't need to programmatically toggle events.

**Key decision — uncontrolled Collapsibles:** Since there's no requirement to programmatically open/close events, use uncontrolled `Collapsible` (no `open`/`onOpenChange` props). This eliminates state management entirely. The chevron icon can use CSS rotation via `data-[state=open]` attribute from Radix.

Correction: Radix Collapsible doesn't propagate state to children for icon switching without controlled mode. Use controlled mode with `useState` per the FieldMappingsSection pattern. Track open state with a `Set<number>` (event index as key).

### Step 2: Create `src/components/product-profile/MeasurementSpecSection.test.tsx`

**Test fixture:**
```typescript
const fixture: MeasurementSpec = {
  events: [
    {
      name: "user_activated",
      description: "User completes onboarding",
      properties: [
        { name: "activation_score", type: "number", description: "Score 0-100" },
        { name: "source", type: "string", description: "Activation source" },
      ],
      trigger_condition: "Onboarding steps completed",
      maps_to: { type: "activation_level", activation_level: 1 },
      category: "activation",
    },
    {
      name: "feature_used",
      description: "User uses core feature",
      properties: [
        { name: "feature_name", type: "string", description: "Name of feature" },
      ],
      trigger_condition: "Feature interaction detected",
      maps_to: { type: "value_moment", moment_id: "vm-1" },
      category: "activation",
    },
    {
      name: "value_delivered",
      description: "User achieves outcome",
      properties: [],
      trigger_condition: "Outcome metric threshold reached",
      maps_to: { type: "both", moment_id: "vm-2", activation_level: 2 },
      category: "value",
    },
  ],
  total_events: 3,
  activation_levels_covered: [1, 2],
  value_moments_covered: ["vm-1", "vm-2"],
  confidence: 0.85,
  sources: ["interview", "analytics"],
}
```

**Setup function:**
```typescript
function setup(measurementSpec: MeasurementSpec | null = null) {
  const user = userEvent.setup()
  render(<MeasurementSpecSection measurementSpec={measurementSpec} />)
  return { user }
}
```

**5 tests (1:1 with acceptance criteria):**

1. **"summary shows total events, confidence score, and category breakdown counts"**
   - `setup(fixture)`
   - Assert "3" total events text
   - Assert "85%" confidence
   - Assert category count badges (activation: 2, value: 1)

2. **"events grouped by category with header and count badge"**
   - `setup(fixture)`
   - Assert "Activation" heading with "2" badge
   - Assert "Value" heading with "1" badge

3. **"event card shows name, description, trigger condition, maps_to badge"**
   - `setup(fixture)`
   - Assert "user_activated" visible (mono text)
   - Assert "User completes onboarding" visible
   - Assert "Onboarding steps completed" visible
   - Assert "Activation L1" badge visible

4. **"click event card expands to show properties table"**
   - `setup(fixture)`
   - Assert "activation_score" NOT visible initially
   - Click on "user_activated" trigger
   - Assert "activation_score" visible
   - Assert "number" type visible
   - Assert "Score 0-100" description visible

5. **"empty state renders when no measurement spec exists"**
   - `setup(null)`
   - Assert "No measurement spec generated yet" visible
   - Assert no summary bar or category sections (`queryByText("Activation")` → null)

### Step 3: Verify

```bash
npm test -- --run src/components/product-profile/MeasurementSpecSection.test.tsx
npm run lint
```

All 5 tests must pass. No lint errors.

## Testing Strategy

- Pure display component — no Convex mocks, no router mocks needed
- `userEvent.setup()` for click interactions (expand/collapse)
- `getByRole`, `getByText` as primary queries
- `queryByText` for absence assertions
- Setup function pattern consistent with `MeasurementPlanSection.test.tsx`

## Acceptance Criteria Verification

| Criterion | Test | Verification |
|-----------|------|--------------|
| Summary shows total events, confidence score, and category breakdown counts | Test 1 | Assert text content for totals, percentage, and category badges |
| Events grouped by category with header and count badge | Test 2 | Assert category headers with correct count badges |
| Table per category: event name, description, trigger condition, maps_to badge | Test 3 | Assert all event fields visible in the collapsed trigger view |
| Collapsible row detail shows properties table (name, type, description) | Test 4 | Click trigger, assert properties table appears with correct columns |
| Empty state renders when no measurement spec exists | Test 5 | Null prop shows empty message, no data sections |

## Dependencies

- **basesignal-ohe** (ProductProfilePage) blocks this task for integration, but the component itself is self-contained and can be built independently — it receives data via props.
- No new Convex queries needed.

## Risks

- None significant. Component is display-only with well-defined types from `convex/analysis/outputs/types.ts`.
- Chevron toggle requires controlled `Collapsible` state (per FieldMappingsSection pattern).
