# Measurement Entity Types Design

## Overview
Extend `convex/analysis/outputs/types.ts` with EntityDefinition and EntityProperty interfaces, add optional fields to MeasurementSpec and TrackingEvent, and fix two existing type-vs-runtime mismatches (EventProperty missing `isRequired`, MeasurementSpec flat coverage fields).

## Problem Statement
The measurement spec type system needs explicit entity definitions so that generated specs can group events by product entity (e.g., Board, User, Team). Currently the LLM generates events in entity_action format but there's no type-level representation of the entities themselves. Additionally, two existing type mismatches need fixing: EventProperty is missing the `isRequired` field the parser already produces, and MeasurementSpec has flat coverage fields when the parser returns a `coverage` sub-object.

## Expert Perspectives

### Technical
- Fix both pre-existing mismatches in S001 — types should be honest about what the runtime produces
- The parser and tests already use nested `coverage` and `required` fields; the types are catching up to reality
- EntityDefinition.id is an LLM-generated string identifier, not a Convex DB reference
- Keep EntityProperty and EventProperty as separate interfaces (different domain concepts: entity schema vs event payload)

### Simplification Review
- Reviewer questioned whether `EntityDefinition` belongs on `MeasurementSpec` (separation of concerns)
- **Rejected**: The AC explicitly requires it, and S002 generator produces entities inline with the spec. LLM-generated entity model is distinct from user's measurement plan entities in DB.
- Reviewer suggested merging `EntityProperty`/`EventProperty` into one type
- **Rejected**: AC explicitly requires separate `EntityProperty` interface. Domain semantics differ even if structure is similar today.
- Valid observation: three type systems (output types, Convex schema, parser runtime) need to stay aligned — this story fixes two existing drift points

## Proposed Solution

### New Types (in types.ts)
```typescript
export interface EntityProperty {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
  isRequired: boolean;
}

export interface EntityDefinition {
  id: string;
  name: string;
  description: string;
  properties: EntityProperty[];
}
```

### Modified Types
- **EventProperty**: add `isRequired: boolean`
- **TrackingEvent**: add optional `entity_id?: string`
- **MeasurementSpec**: restructure coverage to `coverage: { activation_levels_covered: number[]; value_moments_covered: string[] }`, add optional `entities?: EntityDefinition[]`

### Modified Implementation
- **generateMeasurementSpec.ts**: change `required: prop.required === true` to `isRequired: prop.required === true` in parseMeasurementSpecResponse (line 269)
- No prompt changes needed — LLM outputs `required`, parser maps to `isRequired`

### Modified Tests
- **generateMeasurementSpec.test.ts**: update assertions for `isRequired` on parsed properties
- Add tests: spec with/without `entities`, event with/without `entity_id`

### Files NOT Modified
- schema.ts — `productProfiles.outputs` uses `v.any()`, no constraints
- measurementPlan.ts — CRUD operations, not affected
- aggregateMeasurementInputs.ts — assembles input data, not output types

## Design Details

### Schema Alignment
| EntityProperty field | measurementProperties field |
|---------------------|---------------------------|
| name | name |
| type (strict union) | dataType (string) |
| description | description |
| isRequired | isRequired |

| EntityDefinition field | measurementEntities field |
|-----------------------|--------------------------|
| id (string) | name (lowercased) |
| name | name |
| description | description |
| properties[] | (via measurementProperties table) |

### Backwards Compatibility
- `entities?` on MeasurementSpec is optional — existing specs without it type-check
- `entity_id?` on TrackingEvent is optional — existing events without it type-check
- Coverage sub-object fix aligns the type with what the parser already returns — no runtime change
- `isRequired` fix aligns the type with what the parser already produces — no runtime change

## Alternatives Considered
- **Unify EventProperty and EntityProperty**: Rejected — they serve different purposes (event tracking properties vs entity definition properties) and have different field requirements
- **Use loose `dataType: string` for EntityProperty.type**: Rejected — strict union catches mistakes at compile time, matches existing EventProperty pattern
- **Leave type mismatches for separate tasks**: Rejected — the cost of fixing them now is zero since we're already editing the file, and it prevents S002/S003 from inheriting false types
- **Move EntityDefinition outside MeasurementSpec**: Rejected — AC requires it on MeasurementSpec, S002 generator produces entities inline

## Success Criteria
- All 7 acceptance criteria from the story pass
- `npm test` passes with updated types and tests
- No changes to runtime behavior (only type alignment fixes)
