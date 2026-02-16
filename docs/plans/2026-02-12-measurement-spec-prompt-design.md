# Measurement Spec Prompt Rewrite — Double Three-Layer Framework

## Overview

Rewrite `MEASUREMENT_SPEC_SYSTEM_PROMPT` to follow the Double Three-Layer Framework: entities define reusable properties (designed once, inherited by all events), one entity is the heartbeat, activity names use past-tense verbs, events carry a perspective field (customer/product/interaction), and a new user state model defines 5 lifecycle states with event-based criteria.

## Problem Statement

The current prompt generates a flat entity-event structure without property inheritance, heartbeat identification, perspective classification, or user state modeling. The Double Three-Layer Framework requires all of these to produce measurement specs that model real product analytics setups.

## Expert Perspectives

### Technical
- **Drop min-2 event property requirement**: Events inherit entity properties; additional event-specific properties should be 0+. The safety net is entity-level property counts (3-7 per entity), not event-level minimums.
- **Structured user state criteria**: Use `{ event_name, condition }[]` not free-text strings. Makes downstream validation (S002/S003) programmatic rather than parsing English.
- **Parser bounds**: Keep parser entity bounds at 3-15 (current) — don't tighten parser in S001. The prompt instructs 3-7; parser flex is S002's concern.

### Simplification Review
- **S001 should focus on prompt rewrite only** — type definitions and parser validation belong to S002
- S001 writes the new prompt and JSON output schema; S002 adapts types and parser to match
- Parser in S001 should accept new fields passthrough-style (don't break, don't validate strictly)
- The Miro example should show anti-patterns (don't repeat entity properties on events)

## Proposed Solution

### Scope: Prompt rewrite + minimal parser tolerance

**S001 owns:** The `MEASUREMENT_SPEC_SYSTEM_PROMPT` text, JSON output format, Miro example, anti-patterns. Minimal parser changes to accept new fields without crashing (passthrough).

**S002 owns:** Strict type definitions (isHeartbeat, Perspective, UserStateDefinition, UserStateCriterion), parser validation (exactly-one heartbeat, valid perspective enum, 5-state user model, event_name cross-references), test coverage for all validation rules.

### New Prompt Structure

```
Step 1: Define Entities (3-7)
  - Mark exactly one as heartbeat (isHeartbeat: true)
  - Design 3-7 reusable properties per entity, inherited by ALL events

Step 2: Define Activities
  - Past-tense verbs: board_created, board_shared (NOT board_create)
  - entity_action naming format (unchanged regex)
  - Events inherit ALL parent entity properties — only specify ADDITIONAL event-specific props
  - Anti-pattern: "Do NOT invent properties per event"
  - Categories: activation, value, retention, expansion (unchanged)
  - maps_to: unchanged discriminated union
  - Target: 15-25 activities

Step 3: Assign Perspective
  - customer: journey/lifecycle state changes
  - product: entity lifecycle actions (CRUD on core objects)
  - interaction: UI-level actions (drag, zoom, filter)

Step 4: Define User State Model
  - 5 states: new, activated, active, at_risk, dormant
  - Each state: { state, description, criteria: [{ event_name, condition }] }
  - States should reference heartbeat entity activities
```

### Miro Example (in prompt)

```
Entities:
- Account (id: "account") — props: account_id, plan_type, created_at
- Board (id: "board", isHeartbeat: true) — props: board_id, template_used, member_count, is_shared
- Asset (id: "asset") — props: asset_id, asset_type, board_id

Activities:
- board_created (entity: board, perspective: product) — additional: none
- board_shared (entity: board, perspective: product) — additional: share_method, recipient_count
- account_created (entity: account, perspective: customer) — additional: signup_source
- asset_added (entity: asset, perspective: interaction) — additional: none

DON'T: board_created with properties [board_id, template_used, ...] — those are inherited
DO: board_created with properties [] — entity props come automatically

User State Model:
- new: [{ event_name: "account_created", condition: "within last 30 days" }]
- activated: [{ event_name: "board_created", condition: "count >= 1" }]
- active: [{ event_name: "board_created", condition: "count >= 1 within 30 days" }]
- at_risk: [{ event_name: "board_created", condition: "last occurrence 31-60 days ago" }]
- dormant: [{ event_name: "board_created", condition: "last occurrence > 60 days ago" }]
```

### JSON Output Schema (in prompt)

```json
{
  "entities": [
    {
      "id": "board",
      "name": "Board",
      "description": "...",
      "isHeartbeat": true,
      "properties": [...]
    }
  ],
  "events": [
    {
      "name": "board_created",
      "entity_id": "board",
      "description": "...",
      "properties": [],
      "trigger_condition": "...",
      "maps_to": { "type": "activation_level", "activation_level": 1 },
      "category": "activation",
      "perspective": "product"
    }
  ],
  "userStateModel": [
    {
      "state": "new",
      "description": "User signed up recently",
      "criteria": [{ "event_name": "account_created", "condition": "within last 30 days" }]
    }
  ],
  "confidence": 0.8
}
```

### Parser Changes (S001 — minimal passthrough)

1. **isHeartbeat on entities**: Parse `isHeartbeat` from entity JSON, default to `false` if missing. No strict validation in S001 (S002 validates exactly-one).
2. **perspective on events**: Parse `perspective` string from event JSON, store it. No enum validation in S001 (S002 validates).
3. **userStateModel**: Parse top-level `userStateModel` array if present, store as-is. No structural validation in S001 (S002 validates 5 states, criteria structure, event cross-references).
4. **Remove min-2 property requirement**: Events with 0 additional properties are valid.
5. **Entity count bounds**: Keep 3-15 (unchanged). S002 can tighten if needed.

### Type Changes (S001 — minimal)

Just enough to compile:
- `EntityDefinition.isHeartbeat?: boolean` (optional for backward compat)
- `TrackingEvent.perspective?: string` (optional, unvalidated)
- `MeasurementSpec.userStateModel?: unknown[]` (optional, raw)

S002 will make these required with proper types.

## Design Details

### Files Changed in S001

| File | Changes |
|------|---------|
| `convex/analysis/outputs/generateMeasurementSpec.ts` | Rewrite MEASUREMENT_SPEC_SYSTEM_PROMPT (lines 16-97). Parser: add isHeartbeat/perspective passthrough, parse userStateModel, remove min-2 property check. |
| `convex/analysis/outputs/types.ts` | Add optional isHeartbeat to EntityDefinition, optional perspective to TrackingEvent, optional userStateModel to MeasurementSpec |
| `convex/analysis/outputs/types.test.ts` | Update type compilation tests for new optional fields |
| `convex/analysis/outputs/generateMeasurementSpec.test.ts` | Update prompt content tests, update parser fixture with new fields, remove min-2 property test |

### Tests in S001

**Prompt content tests:**
- Contains "Define Entities (3-7)"
- Contains "isHeartbeat"
- Contains "3-7 reusable properties per entity"
- Contains "inherited by ALL events"
- Contains "past-tense" and past-tense examples
- Contains "Do NOT invent properties per event"
- Contains "Assign Perspective" with customer/product/interaction
- Contains "User State Model" with 5 state names
- Contains Miro example (Account, Board heartbeat, Asset)

**Parser tests:**
- Accepts response with isHeartbeat field on entities
- Accepts response with perspective field on events
- Accepts response with userStateModel array
- Accepts events with 0 additional properties
- Existing parser tests still pass with fixture updates (add new fields to fixtures)

## Alternatives Considered

1. **Full type/parser validation in S001**: Rejected — conflates prompt writing with type engineering. S002 already owns this.
2. **Free-text user state criteria**: Rejected — structured `{ event_name, condition }[]` enables programmatic validation in S003.
3. **Rename TrackingEvent to TrackingActivity**: Deferred — cosmetic rename across codebase is separate from prompt rewrite.
4. **Tighten parser entity bounds to 3-7 or 3-10**: Deferred to S002 — parser flex shouldn't change in a prompt-focused story.

## Success Criteria

1. New prompt text follows Double Three-Layer Framework structure
2. LLM output includes isHeartbeat, perspective, userStateModel fields
3. Parser accepts new fields without crashing
4. All existing tests pass with updated fixtures
5. New prompt content tests verify all acceptance criteria
