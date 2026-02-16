# Entity-First Spec Generation — Implementation Plan

**Task:** basesignal-h1n (M006-E004-S002)
**Depends on:** basesignal-07h (M006-E004-S001 — entity types in types.ts)
**Design doc:** docs/plans/2026-02-12-entity-first-spec-generation-design.md

## Goal

Update `generateMeasurementSpec.ts` so the LLM produces entity definitions first (5-10), then events linked to those entities via `entity_id`. The parser validates entity structure, count bounds (3-15 hard), and entity-event linkage.

## Prerequisite: S001 Type Changes

This plan assumes S001 has landed. After S001, types.ts will have:
- `EntityProperty { name, type, description, isRequired }`
- `EntityDefinition { id, name, description, properties: EntityProperty[] }`
- `MeasurementSpec.entities?: EntityDefinition[]`
- `TrackingEvent.entity_id?: string`
- `EventProperty.isRequired: boolean`
- `MeasurementSpec.coverage: { activation_levels_covered, value_moments_covered }`

## Current State

- **System prompt**: Flat event list, no entity concept. Events use `entity_action` naming convention but entities aren't explicit.
- **Parser**: Validates events only. Returns `MeasurementSpec` without entities.
- **Tests**: 40+ tests covering event validation, categories, maps_to, coverage. No entity awareness.

## Design Decisions

1. **Entity-first prompt section**: Add before "Event Naming Rules" to guide LLM thinking order.
2. **Hard count bounds 3-15, soft guidance 5-10**: Parser rejects <3 or >15. Prompt asks for 5-10.
3. **No event name prefix validation**: Trust `entity_id` field, not fragile string parsing. (Design doc decision — overrides AC #7 in story TOML.)
4. **Parser requires entities**: New-format responses must include entities. No backwards compat.
5. **Entity ID format**: `/^[a-z][a-z0-9_]*$/` — lowercase alphanumeric with underscores.
6. **Entity properties minimum**: Each entity must have at least 1 property.

## Implementation Steps

### Step 1: Update imports in generateMeasurementSpec.ts

Add `EntityDefinition` and `EntityProperty` to the import from `./types`.

**File:** `convex/analysis/outputs/generateMeasurementSpec.ts` (line 5-9)

```typescript
import type {
  MeasurementInputData,
  MeasurementSpec,
  TrackingEvent,
  EventProperty,
  EntityDefinition,
  EntityProperty,
} from "./types";
```

### Step 2: Update MEASUREMENT_SPEC_SYSTEM_PROMPT

Insert an "Entity-First Approach" section before "Event Naming Rules" and update the "Output Format" section.

**File:** `convex/analysis/outputs/generateMeasurementSpec.ts` (line 14-67)

Add before `## Event Naming Rules`:
```
## Entity Definitions
Before generating events, define the core entities in this product.
An entity is a noun — a thing users create, manage, or interact with.
Generate 5-10 entities derived from the value moments and activation criteria.

Each entity must have:
- id: lowercase identifier matching /^[a-z][a-z0-9_]*$/ (e.g., "board", "feature_flag")
- name: Human-readable name (e.g., "Board", "Feature Flag")
- description: What this entity represents in the product
- properties: Array of at least 1 property describing this entity
  - name: snake_case property name
  - type: "string" | "number" | "boolean" | "array"
  - description: What this property captures
  - isRequired: true or false
```

Update the `## Output Format` JSON example to include `entities` array and `entity_id` on events:
```json
{
  "entities": [
    {
      "id": "board",
      "name": "Board",
      "description": "A collaborative workspace for organizing issues",
      "properties": [
        { "name": "board_name", "type": "string", "description": "Name of the board", "isRequired": true }
      ]
    }
  ],
  "events": [
    {
      "entity_id": "board",
      "name": "board_created",
      ...existing fields...
    }
  ],
  "confidence": 0.7
}
```

Add rule: "Every event MUST include an entity_id referencing a defined entity's id"

### Step 3: Add entity validation constants

**File:** `convex/analysis/outputs/generateMeasurementSpec.ts` (after line 165)

```typescript
const ENTITY_ID_REGEX = /^[a-z][a-z0-9_]*$/;
const MIN_ENTITIES = 3;
const MAX_ENTITIES = 15;
```

### Step 4: Add entity parsing to parseMeasurementSpecResponse

Insert entity validation block between the confidence check (line 208) and the events loop (line 210).

```typescript
// Validate entities
if (!Array.isArray(parsed.entities)) {
  throw new Error("Missing required field: entities (must be array)");
}

if (parsed.entities.length < MIN_ENTITIES || parsed.entities.length > MAX_ENTITIES) {
  throw new Error(
    `entities must have ${MIN_ENTITIES}-${MAX_ENTITIES} items, got ${parsed.entities.length}`
  );
}

const validEntityIds = new Set<string>();
const entities: EntityDefinition[] = [];

for (let i = 0; i < parsed.entities.length; i++) {
  const raw = parsed.entities[i] as Record<string, unknown>;
  const label = `Entity ${i}`;

  // Validate id
  if (typeof raw.id !== "string" || !raw.id) {
    throw new Error(`${label}: missing id`);
  }
  if (!ENTITY_ID_REGEX.test(raw.id)) {
    throw new Error(`${label}: id '${raw.id}' does not match format /^[a-z][a-z0-9_]*$/`);
  }
  if (validEntityIds.has(raw.id)) {
    throw new Error(`${label}: duplicate entity id '${raw.id}'`);
  }

  // Validate name
  if (typeof raw.name !== "string" || !raw.name) {
    throw new Error(`${label}: missing name`);
  }

  // Validate description
  if (typeof raw.description !== "string" || !raw.description) {
    throw new Error(`${label}: missing description`);
  }

  // Validate properties
  if (!Array.isArray(raw.properties) || raw.properties.length < 1) {
    throw new Error(`${label}: must have at least 1 property`);
  }

  const entityProperties: EntityProperty[] = [];
  for (const prop of raw.properties as Array<Record<string, unknown>>) {
    if (typeof prop.name !== "string" || !prop.name) {
      throw new Error(`${label}: property missing name`);
    }
    if (!VALID_PROPERTY_TYPES.includes(prop.type as (typeof VALID_PROPERTY_TYPES)[number])) {
      throw new Error(`${label}: property '${prop.name}' has invalid type '${prop.type}'`);
    }
    if (typeof prop.description !== "string" || !prop.description) {
      throw new Error(`${label}: property '${prop.name}' missing description`);
    }
    entityProperties.push({
      name: prop.name,
      type: prop.type as EntityProperty["type"],
      description: prop.description,
      isRequired: prop.isRequired === true,
    });
  }

  validEntityIds.add(raw.id);
  entities.push({
    id: raw.id,
    name: raw.name,
    description: raw.description,
    properties: entityProperties,
  });
}
```

### Step 5: Add entity_id validation to event loop

Inside the events loop, after existing validations (before `events.push(...)`), add:

```typescript
// Validate entity_id
if (typeof raw.entity_id !== "string" || !raw.entity_id) {
  throw new Error(`${eventLabel}: missing entity_id`);
}
if (!validEntityIds.has(raw.entity_id)) {
  throw new Error(
    `${eventLabel}: entity_id '${raw.entity_id}' does not reference a defined entity`
  );
}
```

Include `entity_id` in the pushed TrackingEvent:
```typescript
events.push({
  ...existing fields,
  entity_id: raw.entity_id as string,
});
```

### Step 6: Include entities in return value

Update the return statement to include `entities`:

```typescript
return {
  events,
  total_events: events.length,
  coverage: { ... },
  confidence: parsed.confidence,
  sources: [],
  entities,
};
```

### Step 7: Update test fixtures

**File:** `convex/analysis/outputs/generateMeasurementSpec.test.ts`

Add new fixture factories:

```typescript
function makeValidEntityProperty(overrides?: Record<string, unknown>) {
  return {
    name: "entity_name",
    type: "string",
    description: "Name of the entity",
    isRequired: true,
    ...overrides,
  };
}

function makeValidEntity(overrides?: Record<string, unknown>) {
  return {
    id: "issue",
    name: "Issue",
    description: "A work item tracked in the system",
    properties: [
      makeValidEntityProperty(),
      makeValidEntityProperty({ name: "status", description: "Current status" }),
    ],
    ...overrides,
  };
}

function makeMinimalEntitySet(): Array<Record<string, unknown>> {
  return [
    makeValidEntity({ id: "issue", name: "Issue", description: "A work item" }),
    makeValidEntity({ id: "project", name: "Project", description: "A project container" }),
    makeValidEntity({ id: "board", name: "Board", description: "A kanban board" }),
  ];
}
```

Update `makeValidEvent` to include `entity_id`:
```typescript
function makeValidEvent(overrides?: Record<string, unknown>) {
  return {
    entity_id: "issue",
    name: "issue_created",
    ...rest unchanged...
    ...overrides,
  };
}
```

Update `makeValidResponse` to include entities:
```typescript
function makeValidResponse(overrides?: Partial<{
  entities: unknown[];
  events: unknown[];
  confidence: number;
}>) {
  const data = {
    entities: overrides?.entities ?? makeMinimalEntitySet(),
    events: overrides?.events ?? [makeValidEvent()],
    confidence: overrides?.confidence ?? 0.75,
  };
  return JSON.stringify(data);
}
```

### Step 8: Update existing tests

- Update `parseMeasurementSpecResponse` basic test to verify `spec.entities` has 3 items
- Update the fixture integration test (20-event test) to add entities and `entity_id` on every event
- Ensure all `makeValidResponse` calls still work (they'll get default entities)

### Step 9: Add new entity validation tests

```typescript
describe("entity validation", () => {
  // Structure
  it("rejects response without entities array");
  it("rejects entity with missing id");
  it("rejects entity with invalid id format (uppercase)");
  it("rejects entity with invalid id format (starts with digit)");
  it("rejects entity with missing name");
  it("rejects entity with missing description");
  it("rejects entity with no properties");
  it("rejects entity property with invalid type");
  it("rejects entity property with missing name");
  it("rejects entity property with missing description");
  it("defaults entity property isRequired to false");

  // Count bounds
  it("rejects fewer than 3 entities");
  it("rejects more than 15 entities");
  it("rejects duplicate entity ids");

  // Entity-event linkage
  it("rejects event with missing entity_id");
  it("rejects event with entity_id not in defined entities");
  it("accepts event name that does not prefix-match entity_id"); // explicit: no prefix validation
});
```

### Step 10: Add system prompt tests for entity section

```typescript
describe("MEASUREMENT_SPEC_SYSTEM_PROMPT", () => {
  it("contains entity definitions section");
  it("requests 5-10 entities");
  it("specifies entity id format regex");
  it("specifies entity property schema with isRequired");
  it("includes entities in output format example");
  it("requires entity_id on events");
});
```

### Step 11: Update integration test fixture

Update the 20-event integration test:
- Add 5 entities (project, issue, board, cycle, team) with realistic properties
- Add `entity_id` to each of the 20 events matching a defined entity
- Verify `spec.entities` has 5 items with correct structure
- Verify all events have `entity_id` set

## Files to Create/Modify

| File | Action |
|------|--------|
| `convex/analysis/outputs/generateMeasurementSpec.ts` | Modify: prompt, parser, imports, return value |
| `convex/analysis/outputs/generateMeasurementSpec.test.ts` | Modify: fixtures, existing tests, new test groups |

No new files needed.

## Testing Strategy

- **Unit tests** (parser): Entity structure validation, count bounds, linkage, property defaults
- **Unit tests** (prompt): Content assertions on MEASUREMENT_SPEC_SYSTEM_PROMPT
- **Integration test**: Full 20-event fixture with entities, end-to-end parse

Run: `npm test -- convex/analysis/outputs/generateMeasurementSpec.test.ts`

## Acceptance Criteria Mapping

| AC | How Verified |
|----|-------------|
| System prompt requests 5-10 entity definitions | Prompt content test |
| Prompt specifies entity schema | Prompt content test |
| Output JSON includes entities array | Parser returns entities, integration test |
| Parser extracts EntityDefinition[] | Entity structure validation tests |
| Parser validates entity_id references | Entity-event linkage tests |
| Parser rejects <3 or >15 entities | Count bounds tests |
| generateMeasurementSpec returns MeasurementSpec with entities | Integration test + return value includes entities |

**Note on AC #7 (name prefix validation):** The brainstorm design explicitly rejected this — trust `entity_id` field instead. A test explicitly asserts that mismatched prefixes are allowed.
