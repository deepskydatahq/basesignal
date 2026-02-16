# Implementation Plan: M007-E003-S002 — Update Types and Validation for Property Inheritance and Heartbeat

**Task:** basesignal-mo1
**Design:** docs/plans/2026-02-12-measurement-types-validation-design.md
**Depends on:** basesignal-k19 (M007-E003-S001 — prompt rewrite). This story modifies the *types and parser* independently of the prompt text. The prompt (S001) produces the new fields; this story ensures the parser accepts and validates them.

---

## Overview

Add `isHeartbeat` to `EntityDefinition`, `perspective` to `TrackingEvent`, `UserState`/`UserStateCriterion` interfaces, `userStateModel` and `warnings` to `MeasurementSpec`. Extend the parser with four new validation steps. Update all test fixtures.

---

## Step 1: Type Changes in `convex/analysis/outputs/types.ts`

### 1a. EntityDefinition — add `isHeartbeat`

```diff
 export interface EntityDefinition {
   id: string;
   name: string;
   description: string;
   properties: EntityPropertyDef[];
+  isHeartbeat: boolean;
 }
```

### 1b. TrackingEvent — add `perspective`

```diff
+export type Perspective = "customer" | "product" | "interaction";
+
 export interface TrackingEvent {
   name: string;
   entity_id: string;
   description: string;
   properties: EventProperty[];
   trigger_condition: string;
   maps_to: MapsTo;
   category: string;
+  perspective: Perspective;
 }
```

### 1c. New interfaces: UserStateCriterion and UserState

Add after the MeasurementSpec types block (before `MeasurementInputData`):

```typescript
export interface UserStateCriterion {
  event_name: string;
  condition: string;
}

export interface UserState {
  name: string;
  definition: string;
  criteria: UserStateCriterion[];
}
```

### 1d. MeasurementSpec — add `userStateModel` and `warnings`

```diff
 export interface MeasurementSpec {
   entities: EntityDefinition[];
   events: TrackingEvent[];
   total_events: number;
   coverage: {
     activation_levels_covered: number[];
     value_moments_covered: string[];
   };
   confidence: number;
   sources: string[];
+  userStateModel: UserState[];
+  warnings?: string[];
 }
```

---

## Step 2: Parser Changes in `convex/analysis/outputs/generateMeasurementSpec.ts`

### 2a. Add constants

At the top of the file (after existing `VALID_PROPERTY_TYPES`):

```typescript
const VALID_PERSPECTIVES = ["customer", "product", "interaction"] as const;
const REQUIRED_USER_STATES = ["new", "activated", "active", "at_risk", "dormant"] as const;
```

### 2b. Update `parseEntities()` — add `isHeartbeat` extraction

In the entity loop, extract `isHeartbeat` with `=== true` fallback:

```typescript
entities.push({
  id: raw.id,
  name: raw.name,
  description: raw.description,
  properties,
  isHeartbeat: raw.isHeartbeat === true,
});
```

After the loop, validate exactly one heartbeat:

```typescript
const heartbeatCount = entities.filter(e => e.isHeartbeat).length;
if (heartbeatCount !== 1) {
  throw new Error(
    `Expected exactly 1 heartbeat entity, got ${heartbeatCount}`
  );
}
```

### 2c. Update event parsing — add `perspective` validation

Inside the event loop in `parseMeasurementSpecResponse()`, after category validation:

```typescript
// Validate perspective
if (!VALID_PERSPECTIVES.includes(raw.perspective as typeof VALID_PERSPECTIVES[number])) {
  throw new Error(
    `${eventLabel}: invalid perspective '${raw.perspective}'. Must be one of: ${VALID_PERSPECTIVES.join(", ")}`
  );
}
```

Add `perspective` to the constructed event object:

```typescript
const event: TrackingEvent = {
  ...existing fields...,
  perspective: raw.perspective as Perspective,
};
```

### 2d. Property duplication warnings

After the event loop (before computing coverage), build warnings array:

```typescript
const warnings: string[] = [];

// Build entity property lookup: entityId → Set<propertyName>
const entityPropertyMap = new Map<string, Set<string>>();
for (const entity of entities) {
  entityPropertyMap.set(entity.id, new Set(entity.properties.map(p => p.name)));
}

// Check each event's properties against its parent entity's properties
for (const event of events) {
  const entityProps = entityPropertyMap.get(event.entity_id);
  if (entityProps) {
    for (const prop of event.properties) {
      if (entityProps.has(prop.name)) {
        warnings.push(
          `Event '${event.name}' property '${prop.name}' duplicates a property on entity '${event.entity_id}'`
        );
      }
    }
  }
}
```

### 2e. Add `parseUserStateModel()` function

New function before `parseMeasurementSpecResponse()`:

```typescript
function parseUserStateModel(raw: unknown): UserState[] {
  if (!Array.isArray(raw)) {
    throw new Error("userStateModel must be an array");
  }
  if (raw.length !== 5) {
    throw new Error(`userStateModel must have exactly 5 states, got ${raw.length}`);
  }

  const seenNames = new Set<string>();
  const states: UserState[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;
    const label = `UserState ${i}`;

    if (typeof item.name !== "string" || !item.name) {
      throw new Error(`${label}: missing name`);
    }
    if (!REQUIRED_USER_STATES.includes(item.name as typeof REQUIRED_USER_STATES[number])) {
      throw new Error(
        `${label}: invalid name '${item.name}'. Must be one of: ${REQUIRED_USER_STATES.join(", ")}`
      );
    }
    if (seenNames.has(item.name)) {
      throw new Error(`${label}: duplicate state name '${item.name}'`);
    }
    seenNames.add(item.name);

    if (typeof item.definition !== "string" || !item.definition) {
      throw new Error(`${label}: missing definition`);
    }

    if (!Array.isArray(item.criteria)) {
      throw new Error(`${label}: missing criteria array`);
    }

    const criteria: UserStateCriterion[] = [];
    for (const c of item.criteria as Array<Record<string, unknown>>) {
      if (typeof c.event_name !== "string" || !c.event_name) {
        throw new Error(`${label}: criterion missing event_name`);
      }
      if (typeof c.condition !== "string" || !c.condition) {
        throw new Error(`${label}: criterion missing condition`);
      }
      criteria.push({ event_name: c.event_name, condition: c.condition });
    }

    states.push({ name: item.name, definition: item.definition, criteria });
  }

  return states;
}
```

### 2f. Update `parseMeasurementSpecResponse()` return

Parse `userStateModel` from the raw data and include `warnings` in the return value:

```typescript
// After event parsing, before return:
const userStateModel = parseUserStateModel(parsed.userStateModel);

return {
  entities,
  events,
  total_events: events.length,
  coverage: { ... },
  confidence: parsed.confidence,
  sources: [],
  userStateModel,
  ...(warnings.length > 0 ? { warnings } : {}),
};
```

### 2g. Update import for `Perspective` and `UserState` types

Add `Perspective`, `UserState`, `UserStateCriterion` to the import from `./types`.

---

## Step 3: Test Fixture Updates in `convex/analysis/outputs/generateMeasurementSpec.test.ts`

### 3a. Update `makeValidEntity()` — add `isHeartbeat: false` default

```typescript
function makeValidEntity(overrides?: Record<string, unknown>) {
  return {
    id: "issue",
    name: "Issue",
    description: "A trackable work item in the project",
    properties: [...],
    isHeartbeat: false,
    ...overrides,
  };
}
```

### 3b. Update `makeMinimalEntitySet()` — exactly one heartbeat

Mark the first entity as `isHeartbeat: true`:

```typescript
function makeMinimalEntitySet() {
  return [
    makeValidEntity({ id: "issue", name: "Issue", description: "A work item", isHeartbeat: true }),
    makeValidEntity({ id: "project", name: "Project", description: "A project container" }),
    makeValidEntity({ id: "board", name: "Board", description: "A kanban board" }),
  ];
}
```

### 3c. Update `makeValidEvent()` — add `perspective: "product"` default

```typescript
function makeValidEvent(overrides?: Record<string, unknown>) {
  return {
    ...existing fields...,
    perspective: "product",
    ...overrides,
  };
}
```

### 3d. Add `makeValidUserStateModel()` helper

```typescript
function makeValidUserStateModel(): Record<string, unknown>[] {
  return [
    { name: "new", definition: "User just signed up", criteria: [{ event_name: "session_started", condition: "first session" }] },
    { name: "activated", definition: "User completed key action", criteria: [{ event_name: "project_created", condition: "first project" }] },
    { name: "active", definition: "User regularly engaged", criteria: [{ event_name: "session_started", condition: "3+ sessions in 7 days" }] },
    { name: "at_risk", definition: "User engagement declining", criteria: [{ event_name: "session_started", condition: "no session in 14 days" }] },
    { name: "dormant", definition: "User inactive", criteria: [{ event_name: "session_started", condition: "no session in 30 days" }] },
  ];
}
```

### 3e. Update `makeValidResponse()` — include `userStateModel`

```typescript
function makeValidResponse(overrides?: Partial<{
  entities: unknown[];
  events: unknown[];
  confidence: number;
  userStateModel: unknown[];
}>) {
  const data = {
    entities: overrides?.entities ?? makeMinimalEntitySet(),
    events: overrides?.events ?? [makeValidEvent()],
    confidence: overrides?.confidence ?? 0.75,
    userStateModel: overrides?.userStateModel ?? makeValidUserStateModel(),
  };
  return JSON.stringify(data);
}
```

---

## Step 4: New Test Cases in `convex/analysis/outputs/generateMeasurementSpec.test.ts`

### 4a. Heartbeat validation tests

```
describe("parseMeasurementSpecResponse heartbeat validation")
  - "accepts exactly one heartbeat entity"
  - "rejects zero heartbeat entities" (all isHeartbeat: false)
  - "rejects two heartbeat entities"
  - "defaults isHeartbeat to false when missing from raw data"
```

### 4b. Perspective validation tests

```
describe("parseMeasurementSpecResponse perspective validation")
  - "accepts all three valid perspectives: customer, product, interaction"
  - "rejects invalid perspective value"
  - "rejects missing perspective field"
  - "parsed event includes perspective field"
```

### 4c. Property duplication warning tests

```
describe("parseMeasurementSpecResponse property duplication warnings")
  - "returns no warnings when no property names overlap"
  - "returns warning when event property duplicates entity property name"
  - "returns multiple warnings for multiple duplicates"
  - "warnings field is undefined when no warnings"
```

### 4d. User state model validation tests

```
describe("parseMeasurementSpecResponse userStateModel validation")
  - "parses valid 5-state user state model"
  - "rejects non-array userStateModel"
  - "rejects fewer than 5 states"
  - "rejects more than 5 states"
  - "rejects invalid state name"
  - "rejects duplicate state names"
  - "rejects state missing definition"
  - "rejects state missing criteria array"
  - "rejects criterion missing event_name"
  - "rejects criterion missing condition"
```

---

## Step 5: Type Test Updates in `convex/analysis/outputs/types.test.ts`

### 5a. EntityDefinition test — add `isHeartbeat`

Update the existing `EntityDefinition` test fixture to include `isHeartbeat: false` (or `true`) and assert on it.

### 5b. TrackingEvent test — add `perspective`

Update existing `TrackingEvent` test fixtures to include `perspective: "product"` (or other values) and assert on it.

### 5c. New `Perspective` type test

```
describe("Perspective type")
  - "supports all three perspective values"
```

### 5d. New `UserState` and `UserStateCriterion` type tests

```
describe("UserStateCriterion")
  - "includes event_name and condition"

describe("UserState")
  - "includes name, definition, criteria"
```

### 5e. MeasurementSpec test — add `userStateModel` and `warnings`

Update existing `MeasurementSpec` test fixtures to include `userStateModel: [...]` and assert on it. Add a test for `warnings?: string[]`.

---

## Validation Order in Parser

1. Parse and validate top-level fields (entities, events, confidence) — *existing*
2. Parse entities with `isHeartbeat` extraction — *modified*
3. Validate exactly 1 heartbeat — *new*
4. Parse events with `perspective` validation — *modified*
5. Property duplication warnings — *new*
6. Parse `userStateModel` — *new*
7. Compute coverage — *existing*
8. Return spec with `userStateModel` and optional `warnings` — *modified*

---

## Files Modified

| File | Changes |
|------|---------|
| `convex/analysis/outputs/types.ts` | Add `isHeartbeat`, `Perspective`, `perspective`, `UserStateCriterion`, `UserState`, `userStateModel`, `warnings` |
| `convex/analysis/outputs/generateMeasurementSpec.ts` | Add constants, update `parseEntities()`, add perspective/heartbeat/property-dup validation, add `parseUserStateModel()`, update return |
| `convex/analysis/outputs/types.test.ts` | Update fixtures, add Perspective/UserState/UserStateCriterion tests |
| `convex/analysis/outputs/generateMeasurementSpec.test.ts` | Update all fixtures, add ~20 new test cases |

No new files created.

---

## Acceptance Criteria Mapping

| AC | Implementation |
|----|----------------|
| EntityDefinition gains `isHeartbeat: boolean` | Step 1a |
| TrackingEvent gains `perspective` | Step 1b |
| New UserState interface | Step 1c |
| MeasurementSpec gains `userStateModel` | Step 1d |
| Parser validates exactly one heartbeat entity | Step 2b |
| Parser validates valid perspective field | Step 2c |
| Parser warns if event properties duplicate entity property names | Step 2d |
| Parser validates userStateModel has 5 states | Step 2e |
| All existing measurement spec tests updated and passing | Steps 3 + 4 |
