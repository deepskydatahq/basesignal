# MeasurementSpecSection Entity-Grouped UI Design

## Overview

Add an entity-grouped view to `MeasurementSpecSection` that displays entity cards with always-visible property schemas and nested `EventRow` components. A simple two-button toggle switches between entity and category perspectives, with the category view preserved as-is.

## Problem Statement

The current MeasurementSpecSection groups events by category (activation, value, retention, expansion). With the new entity framework (S001/S002), events belong to entities (User, Organization, Subscription, etc.). Users need an entity-first view to understand their measurement spec through the lens of "what things exist and what happens to them" rather than just "what category of event is this."

## Expert Perspectives

### Product
- Toggle right-aligned on same line as summary bar — it's a perspective shift on the same dataset, not navigation
- Confidence score stays visible in both views — it's about trust in the data, not the grouping
- Summary bar shows entity count alongside event count when entities present
- The magic moment is the seamless perspective shift when toggling between entity and category views

### Technical
- Simple two-button toggle (not Radix Tabs) — different mental model from page-level tab navigation
- ~10 lines inline JSX: `bg-gray-100` container, `white + shadow-sm` for active state
- Always-visible property table — entity properties define what an entity *is*, hiding behind collapse contradicts entity-first mental model
- Reuse EventRow as-is in both views — visual consistency, no modifications needed

### Simplification Review
- Removed separate component extractions (CategorySummaryBar, EntitySummaryBar, ViewToggle) — inline as JSX
- Removed Phase 1 refactoring — build entity view directly
- Kept always-visible property table (core to entity-first mental model)
- Kept Required column in property table (explicit acceptance criterion)
- Kept entity count in summary bar (explicit acceptance criterion)
- Inline event grouping logic — simple `filter()` calls rather than Map-based helper
- Entity cards stay as local function for readability (~30 lines with property table + events)

## Proposed Solution

Add `viewMode` state to `MeasurementSpecSection`. When entities exist, default to entity view. Render entity cards with always-visible property tables and nested EventRows. Provide a simple inline two-button toggle to switch to category view. Legacy data without entities renders category view with no toggle.

## Design Details

### Component Structure (all in MeasurementSpecSection.tsx)

```
MeasurementSpecSection
├── state: viewMode ("entity" | "category"), defaults based on hasEntities
│
├── Summary bar (single flex row)
│   ├── Left: "{n} entities" (when hasEntities) · "{m} events" · "{x}% confidence"
│   ├── Middle: category badges (both views)
│   └── Right (ml-auto): two-button toggle (only when hasEntities)
│       ├── "By Entity" button
│       └── "By Category" button
│       └── Styled: border rounded-md, active = white+shadow, inactive = bg-gray-100
│
├── Entity view (when viewMode === "entity")
│   ├── For each entity (with events first, then empty entities):
│   │   └── Bordered div (not Card component — simpler)
│   │       ├── Header: entity.name (h3) + Badge("{n} events") + description
│   │       ├── Property table (when properties exist, always visible)
│   │       │   Columns: Name (mono) | Type (badge) | Required (badge) | Description
│   │       └── EventRow[] filtered by entity_id match
│   └── Ungrouped section (events without entity_id)
│       ├── "Ungrouped" heading
│       └── EventRow[] in bordered container
│
└── Category view (when viewMode === "category" OR !hasEntities)
    └── Existing rendering logic, unchanged
```

### Key Implementation Notes

- `viewMode` state: `useState<"entity" | "category">(hasEntities ? "entity" : "category")`
- Event grouping: inline `events.filter(e => e.entity_id === entity.id)` per entity, `events.filter(e => !e.entity_id || !entityIds.has(e.entity_id))` for ungrouped
- Property table: use existing `Table`/`TableHeader`/`TableRow`/`TableCell` components
- Entity cards: simple bordered div with sections (header, properties, events)
- EventRow: reuse as-is, no modifications — same column headers in both views
- Toggle: inline JSX, ~10 lines, no component extraction
- Non-collapsible entity cards — always expanded, reduces interaction cost
- Entities with events shown first, empty entities after, ungrouped last

### Type Dependencies (from S001/S002)

```typescript
interface EntityProperty {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
  isRequired: boolean;
}

interface EntityDefinition {
  id: string;
  name: string;
  description: string;
  properties: EntityProperty[];
}

// Added to MeasurementSpec
entities?: EntityDefinition[];

// Added to TrackingEvent
entity_id?: string;
```

### Test Plan

1. Entity view default when entities exist
2. Entity card rendering (name, description, event count badge)
3. Entity property table (name, type, required, description columns)
4. Events nested under entity via EventRow
5. Toggle switches between entity and category views
6. Category view unchanged
7. Legacy data (no entities) shows category view, toggle hidden
8. Summary bar shows entity count alongside event count
9. Ungrouped events section for events without entity_id

## Alternatives Considered

1. **Radix Tabs for toggle** — Rejected: designed for page-level navigation with underline style. This is a view-mode toggle on the same data, different mental model.
2. **Collapsible property table** — Rejected: contradicts entity-first mental model. Users should see the schema immediately.
3. **Toggle in section header / separate line** — Rejected: separates cause from effect. Toggle belongs on the summary bar line.
4. **Map-based groupEventsByEntity helper** — Rejected: over-engineered for simple filter() calls.
5. **Separate component files** — Rejected: entity view, toggle, and summary changes are small enough to keep in one file.

## Success Criteria

- Entity view renders by default when entities exist in the measurement spec
- Entity cards show name, description, event count, property table, and nested events
- Toggle switches between entity and category views
- Legacy data (no entities) shows category view with toggle hidden
- Ungrouped events (no entity_id) appear in a dedicated section
- Summary bar shows entity count alongside event count
- Confidence visible in both views
- All existing category view behavior unchanged
