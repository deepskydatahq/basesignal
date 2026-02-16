# Measurement Types & Validation Design

## Overview
Add three new type concepts and parser validation to enforce the Double Three-Layer Framework: heartbeat entity designation, event perspective classification, user state model, plus a warnings mechanism for non-fatal validation issues.

## Problem Statement
The current MeasurementSpec types don't capture key concepts from the Double Three-Layer Framework: which entity is the heartbeat, what perspective each event represents, or how user states are defined. The parser has no mechanism for non-fatal warnings.

## Expert Perspectives

### Technical
- Warnings belong as an optional field on MeasurementSpec itself (`warnings?: string[]`), not as a separate return type or console.warn. This is testable (assert on `spec.warnings`) and composes for future validation layers in S003.

### Simplification Review
- Reviewer flagged that the story bundles multiple concepts. However, all are explicit acceptance criteria for this story. Applied simplification: keep validation structural and mechanical, avoid over-abstracting, no new files or helpers.

## Proposed Solution

### Type Changes (types.ts)

**EntityDefinition** — add `isHeartbeat: boolean`

**TrackingEvent** — add `perspective: "customer" | "product" | "interaction"` (export `Perspective` type alias)

**New interfaces:**
- `UserStateCriterion`: `{ event_name: string, condition: string }`
- `UserState`: `{ name: string, definition: string, criteria: UserStateCriterion[] }`

**MeasurementSpec** — add `userStateModel: UserState[]` and `warnings?: string[]`

### Parser Changes (generateMeasurementSpec.ts)

1. **Heartbeat validation**: After parsing entities, count those with `isHeartbeat: true`. Throw if count !== 1.

2. **Perspective validation**: In event parsing loop, validate `perspective` is one of `"customer" | "product" | "interaction"`. Throw on invalid/missing.

3. **Property duplication warning**: After parsing all entities and events, check if any event property name matches a parent entity property name. Append to `warnings[]` (non-blocking).

4. **User state model parsing**: New `parseUserStateModel()` function validates:
   - Is an array of exactly 5 items
   - Each has name (one of: new, activated, active, at_risk, dormant), definition (string), criteria (array of {event_name, condition})
   - All 5 required names present, no duplicates

5. **Return value**: Include `userStateModel` and conditionally include `warnings` if non-empty.

### Test Updates

- Update all fixture factories to include new required fields (isHeartbeat, perspective, userStateModel)
- Add validation tests: heartbeat count (0, 1, 2), perspective validity, property duplication warning, user state model (count, names, structure)

## Design Details

### Constants
- `VALID_PERSPECTIVES = ["customer", "product", "interaction"] as const`
- `REQUIRED_USER_STATES = ["new", "activated", "active", "at_risk", "dormant"] as const`

### Error vs Warning
- **Errors (throw)**: missing/invalid perspective, wrong heartbeat count, invalid user state model
- **Warnings (append to warnings[])**: event property duplicates entity property name

### Backward Compatibility
- `isHeartbeat` defaults to `false` when not present in LLM output (via `=== true` check)
- `warnings` is optional on MeasurementSpec

## Alternatives Considered

1. **Warnings as separate return type** `{ spec, warnings[] }` — rejected because it ripples through callers
2. **Console.warn for warnings** — rejected because untestable without mocking
3. **Free-string perspective** — rejected because AC specifies exact 3 values
4. **UserState in separate module** — rejected because AC places it in these files

## Success Criteria
- All 9 acceptance criteria from the story pass
- All existing tests updated and passing
- No new files created
- Parser remains a single pass with clear error messages
