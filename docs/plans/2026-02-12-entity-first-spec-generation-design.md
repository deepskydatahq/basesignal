# Entity-First Spec Generation Design

## Overview

Update `generateMeasurementSpec.ts` to produce entity definitions before events. The system prompt instructs the LLM to define 5-10 entities first, then generate events linked to those entities. The parser validates entity structure and entity-event linkage.

## Problem Statement

The current measurement spec generator produces a flat list of events categorized by `EventCategory`. Events lack structural connection to the product entities they relate to. This makes it harder to reason about coverage ("which entities have tracking?") and produces specs that feel like a grab-bag rather than a coherent measurement plan.

## Expert Perspectives

### Technical
- Design against S001 types. S001 provides `EntityDefinition`, `EntityProperty`, `MeasurementSpec.entities?`, and `TrackingEvent.entity_id?`.
- Coverage structure inconsistency (flat vs nested) is out of scope — separate cleanup task.
- Drop event name prefix validation. Trust the explicit `entity_id` field instead of fragile string parsing. The `entity_action` naming stays as prompt guidance, not parser validation.
- Entity count bounds: 3-15 hard (parser), 5-10 soft (prompt guidance).

### Simplification Review
- Consolidated entity schema into one prompt section with single JSON example.
- Streamlined test plan: group by validation concern, not individual fields.
- Removed defensive backwards-compatibility language — the prompt and parser change together by design.
- Resolved AC #6 ambiguity: name prefix validation is definitively dropped.

## Proposed Solution

Three changes to `generateMeasurementSpec.ts`, all additive to existing logic:

### 1. System Prompt Update

Add "Entity-First Approach" section before "Event Naming Rules":
- Request 5-10 entity definitions (nouns the product manages)
- Entity schema: `id` (lowercase alphanumeric, regex `/^[a-z][a-z0-9_]*$/`), `name`, `description`, `properties[]`
- Entity property schema: `name`, `type` (string|number|boolean|array), `description`, `isRequired`
- Each entity must have at least 1 property

Update "Output Format" section:
- Add `entities` array to JSON example alongside `events`
- Add `entity_id` field to event example
- Add instruction: "Every event MUST include an entity_id referencing a defined entity"

### 2. Parser Update

**Entity validation (new, before events loop):**
- Validate `entities` is an array with 3-15 items
- For each entity: validate `id` (regex, no duplicates), `name`, `description`, `properties[]` (at least 1)
- For each entity property: validate `name`, `type` in valid set, `description`; default `isRequired` to false
- Build `validEntityIds: Set<string>` for event linkage

**Event-entity linkage (addition to events loop):**
- Validate every event has `entity_id` string
- Validate `entity_id` exists in `validEntityIds`
- Include `entity_id` in constructed `TrackingEvent`

**Return value:**
- Include `entities` array in returned `MeasurementSpec`

### 3. Test Updates

**Updated fixtures:** `makeValidEntity()`, `makeMinimalEntitySet()` (3 entities), `makeValidEvent()` with `entity_id`, `makeValidResponse()` with entities

**New tests grouped by concern:**
- Entity structure validation: missing/invalid id, name, description, properties, property types
- Entity count bounds: rejects <3, rejects >15, duplicate IDs
- Entity-event linkage: missing entity_id, unresolved entity_id, explicit test that name prefix != entity_id is allowed
- Integration: updated fixture with 5 entities and entity_id on all events

## Design Details

### Entity ID Format
Entity IDs match `/^[a-z][a-z0-9_]*$/` — lowercase with optional underscores. Examples: `issue`, `board`, `feature_flag`, `api_key`.

### Entity Properties vs Event Properties
Entity properties define what data the entity carries. Event properties define what data the event records. `EntityProperty` uses `isRequired`, `EventProperty` uses `required`. The type system enforces this distinction.

### Parser Requires Entities
The new parser requires entities in the response. Old-format responses without entities are rejected. This is by design — the prompt and parser change together.

## Alternatives Considered

1. **Validate event name prefix matches entity_id** — Rejected. Creates fragile string parsing dependencies. Trust the explicit `entity_id` field.
2. **Include S001 type changes in S002** — Rejected. S001 is an explicit dependency; duplicating that work adds scope and risks conflicts.
3. **Fix coverage structure inconsistency** — Deferred. Affects multiple consumers. Separate cleanup task.

## Success Criteria

- All acceptance criteria met (AC #6 revised: trust entity_id, no prefix validation)
- Existing tests updated with entity data and passing
- New tests cover entity validation, count bounds, entity-event linkage
- `generateMeasurementSpec` returns `MeasurementSpec` with populated `entities`
