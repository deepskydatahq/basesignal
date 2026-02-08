# Measurement Input Aggregation Design

## Overview

`aggregateMeasurementInputs` is a declarative reader of four product profile sections that reshapes persisted analysis data into `MeasurementInputData` for the measurement spec LLM prompt. No LLM calls, no generation logic — pure aggregation.

## Problem Statement

The measurement spec generator (M004-E004-S002) needs comprehensive input from multiple upstream generators: value moments from convergence, activation levels, ICP profiles, and activation map stages. A single aggregation function gathers all these into one structure the LLM prompt can consume.

## Expert Perspectives

### Product
- The aggregation layer is a translator, not a decision-maker
- Event name suggestions were proposed but rejected — the LLM should have full autonomy to name events based on context
- Keep the layer humble so the LLM stays free to understand which events actually measure progress toward value delivery

### Technical
- **Approach A (read from profile)** over Approach B (call generators) — persistence is the composition model, consistent with how convergence → activation already works
- Pure core + thin Convex wrapper pattern for testability
- Explicit dependency validation: throw clear errors listing which profile sections are missing

### Simplification Review
- **Removed `suggestEventName` helper** — adding mechanical event name transformation duplicates what the LLM will do better; raw data is sufficient input
- **Simplified data structure** — pass raw value moments and activation levels directly without pre-computed event templates
- The core design (pure aggregator reading profile sections) is solid and minimal

## Proposed Solution

A single file `convex/analysis/outputs/aggregateMeasurementInputs.ts` containing:
1. `MeasurementInputData` type definition
2. `aggregateMeasurementInputsCore(profile)` — pure function, unit-testable
3. `aggregateMeasurementInputs` — thin Convex internalAction wrapper

### Data Flow

```
Product Profile (persisted by upstream generators)
  ├── convergence.value_moments  → value_moments[]
  ├── definitions.activation     → activation_levels[]
  ├── icpProfiles                → icp_profiles[]
  └── activationMap              → activation_map
                                      ↓
                            MeasurementInputData
                                      ↓
                        Measurement Spec Generator (LLM)
```

## Design Details

### MeasurementInputData Type

```typescript
interface MeasurementInputData {
  value_moments: ValueMoment[]       // with product_surfaces
  activation_levels: ActivationLevel[] // with criteria for event grouping
  icp_profiles: ICPProfile[]          // for persona-based event variants
  activation_map: ActivationMap       // stages for event grouping
}
```

### Core Function

`aggregateMeasurementInputsCore(profile)`:
1. Validates all four required profile sections exist (throws with clear error listing missing sections)
2. Extracts value moments from `profile.convergence`
3. Extracts activation levels from `profile.definitions.activation`
4. Reads ICP profiles from `profile.icpProfiles`
5. Reads activation map from `profile.activationMap`
6. Returns assembled `MeasurementInputData`

### Convex Wrapper

`aggregateMeasurementInputs` internalAction:
1. Reads product profile via `getInternal`
2. Calls `aggregateMeasurementInputsCore(profile)`
3. Returns `MeasurementInputData`

### Pipeline Ordering

```
Output Orchestration (M004-E004-S004)
  → ICP Generator (stores icpProfiles)
  → Activation Map Generator (stores activationMap)
  → aggregateMeasurementInputs (reads all four sections)
  → Measurement Spec Generator (uses MeasurementInputData as prompt input)
```

The orchestrator ensures upstream generators have completed before calling this aggregator.

## Alternatives Considered

1. **Call generators directly (Approach B)** — rejected because it conflates aggregation with orchestration; the existing codebase pattern is persist-then-read
2. **Mechanical event name suggestion (`suggestEventName`)** — rejected after simplification review; the LLM should have full naming autonomy
3. **Pre-computed event templates** — rejected; adds unnecessary transformation layer between raw data and LLM

## Success Criteria

1. `aggregateMeasurementInputs` accepts productId and returns `MeasurementInputData`
2. Includes all value moments with `product_surfaces`
3. Includes activation level criteria for event templates
4. Includes ICP profiles for persona-based event variants
5. Includes activation map stages for event grouping
6. Linear integration test returns comprehensive input data
7. Pure core function is testable without Convex
