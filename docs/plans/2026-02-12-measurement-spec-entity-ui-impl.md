# MeasurementSpecSection Entity UI — Implementation Plan

## Problem

The MeasurementSpecSection currently groups events by category (activation, value, retention, expansion). With the entity framework from S001/S002, `MeasurementSpec` gains an optional `entities: EntityDefinition[]` and `TrackingEvent` gains an optional `entity_id`. We need an entity-grouped view that shows entity cards with property schemas and nested events, plus a toggle to switch between entity and category views.

## Approach

All changes in `MeasurementSpecSection.tsx` and its test file. No new files. Inline the entity view, toggle, and updated summary bar as JSX within the existing component. Reuse `EventRow` as-is for both views.

## Changes

### `src/components/product-profile/MeasurementSpecSection.tsx`

**1. Update imports** — Add `EntityDefinition`, `EntityProperty` to the type import from `types.ts`.

**2. Add `viewMode` state** — `useState<"entity" | "category">` defaulting to `"entity"` when `measurementSpec.entities?.length` is truthy, else `"category"`.

```typescript
const hasEntities = (measurementSpec.entities?.length ?? 0) > 0;
const [viewMode, setViewMode] = useState<"entity" | "category">(
  hasEntities ? "entity" : "category"
);
```

**3. Update summary bar** — Three changes to the existing flex row:
- Show entity count before event count when entities present: `"{n} entities · "` prefix
- Category badges stay in both views
- Add right-aligned two-button toggle (only when `hasEntities`):

```tsx
{hasEntities && (
  <div className="ml-auto flex rounded-md bg-gray-100 p-0.5">
    <button
      type="button"
      className={`px-3 py-1 text-xs rounded ${viewMode === "entity" ? "bg-white shadow-sm font-medium" : "text-gray-600"}`}
      onClick={() => setViewMode("entity")}
    >By Entity</button>
    <button
      type="button"
      className={`px-3 py-1 text-xs rounded ${viewMode === "category" ? "bg-white shadow-sm font-medium" : "text-gray-600"}`}
      onClick={() => setViewMode("category")}
    >By Category</button>
  </div>
)}
```

**4. Conditionally render view** — Below the summary bar:
- `viewMode === "category"` (or `!hasEntities`): existing category rendering, unchanged
- `viewMode === "entity"`: entity cards + ungrouped section

**5. Entity view rendering** — For each entity in `measurementSpec.entities`:
- Filter events: `events.filter(e => e.entity_id === entity.id)`
- Render bordered div with:
  - Header: `entity.name` (h3) + event count badge + `entity.description`
  - Property table (when `entity.properties.length > 0`): columns Name (mono), Type (badge), Required (badge), Description — using existing `Table` components
  - Column headers for events (same grid as EventRow)
  - `EventRow` for each matching event
- Sort: entities with events first, then empty entities
- Ungrouped section: events where `!event.entity_id` or `entity_id` doesn't match any entity

**6. Ungrouped section** — Only rendered when ungrouped events exist:
- Heading "Ungrouped" with event count badge
- Same bordered container + column headers + EventRow pattern as categories

### `src/components/product-profile/MeasurementSpecSection.test.tsx`

**7. Update `makeEvent` fixture** — Accept optional `entity_id` (already works via `Partial<TrackingEvent>` spread, but add to some default events).

**8. Add `makeEntitySpec` helper** — Creates a spec with entities and entity_id on events:

```typescript
function makeEntitySpec(): MeasurementSpec {
  return makeSpec({
    entities: [
      {
        id: "user",
        name: "User",
        description: "Application user",
        properties: [
          { name: "email", type: "string", description: "User email", isRequired: true },
          { name: "plan", type: "string", description: "Plan type", isRequired: false },
        ],
      },
      {
        id: "feature",
        name: "Feature",
        description: "Product feature",
        properties: [
          { name: "feature_name", type: "string", description: "Name", isRequired: true },
        ],
      },
    ],
    events: [
      makeEvent({ name: "user_signed_up", entity_id: "user", category: "activation" }),
      makeEvent({ name: "feature_used", entity_id: "feature", category: "activation" }),
      makeEvent({ name: "value_delivered", entity_id: "user", category: "value" }),
      makeEvent({ name: "orphan_event", category: "retention" }), // no entity_id → ungrouped
    ],
    total_events: 4,
  });
}
```

**9. Nine test cases** (matching AC):

| # | Test | Key assertions |
|---|------|----------------|
| 1 | Entity view default when entities exist | `getByText("User")`, toggle visible, "By Entity" active |
| 2 | Entity card rendering | Each entity shows name, description, event count badge |
| 3 | Entity property table | Columns: name (mono), type (badge), required badge, description |
| 4 | Events nested under entity | EventRow names appear within entity card container |
| 5 | Toggle switches views | Click "By Category" → category headings appear, entity cards gone; click back |
| 6 | Category view unchanged | Legacy spec (no entities) renders identically to current tests |
| 7 | Legacy data no toggle | `queryByText("By Entity")` returns null when no entities |
| 8 | Summary bar entity count | Shows "{n} entities" text when entities present |
| 9 | Ungrouped section | Events without entity_id shown under "Ungrouped" heading |

## Key Decisions

1. **Inline all new JSX** — No separate component files. Entity card is ~30 lines, toggle is ~10 lines. Keeps the change self-contained.
2. **Inline `filter()` for event grouping** — No Map-based helper. Simple `events.filter(e => e.entity_id === entity.id)` per entity. The brainstorm design doc explicitly chose this over a helper function.
3. **Always-visible property table** — Not collapsible. Entity properties define what an entity *is*.
4. **Reuse EventRow as-is** — Same component in both views. No modifications needed.
5. **Two-button toggle** — Not Radix Tabs. Different mental model from page-level navigation.

## Testing

- Run `npm test` after implementation
- All 9 new tests plus all 6 existing tests must pass
- No modifications to existing test assertions (category view behavior unchanged)
- Test entity property table Required column (maps `isRequired: true` → "Required" badge, `isRequired: false` → "Optional" badge)

## Dependencies

- **S001** (basesignal-h2z): `EntityDefinition`, `EntityProperty` types, `MeasurementSpec.entities?`, `TrackingEvent.entity_id?` — must be merged before implementation
- **S002** (basesignal-h1n): Generator produces entities — must be merged for end-to-end but UI can be tested with fixture data
