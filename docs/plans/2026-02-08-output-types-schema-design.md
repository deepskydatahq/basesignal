# Output Types Schema Design

## Overview
Define TypeScript types for three output artifacts (ICPProfile, ActivationMap, MeasurementSpec) in a single file at `convex/analysis/outputs/types.ts`. These types structure the output of LLM-powered generators that transform analyzed product data into actionable deliverables.

## Problem Statement
The M004 mission needs well-defined type contracts for three output generators (ICP profiles, activation maps, measurement specs) before implementation can begin. Without shared types, generators would define ad-hoc structures that don't compose well.

## Expert Perspectives

### Product
- The types define the "shape of value" — what users ultimately receive from the analysis pipeline
- Each output artifact represents a different lens: who uses the product (ICP), how they progress (activation map), and what to measure (measurement spec)

### Technical
- Follow the handoff hint over acceptance criteria summaries — the handoff provides downstream-consumption shapes
- Value unlocks embedded in stages (not separate top-level array) avoids duplication and matches existing ActivationLevel patterns
- MeasurementSpec uses flat peer fields — no metadata wrapper object
- Include `primary_activation_level` on ActivationMap as lightweight denormalization
- `maps_to` should use properly discriminated union with required fields per case

### Simplification Review
- Removed `EventProperty.required` field — let TypeScript handle optionality
- Flattened `coverage` wrapper — `activation_levels_covered` and `value_moments_covered` are peer fields
- Tightened `maps_to` discriminated union — required fields per variant, no optional ambiguity
- Kept `drop_off_reasons` as optional (pragmatic for LLM output parsing)
- Kept `type: "array"` for EventProperty (analytics schemas have variable array contents)

## Proposed Solution

One file, pure TypeScript interfaces, no runtime code. Imports existing types via `import type`.

### File: `convex/analysis/outputs/types.ts`

**Imports:**
```typescript
import type { ValueMoment, ValueMomentTier } from "../convergence/types";
import type { ActivationLevel, SignalStrength } from "../extractActivationLevels";
```

**ICP Profile Types:**
- `ValueMomentPriority` — { moment_id, priority: 1|2|3, relevance_reason }
- `ICPProfile` — { id, name, description, value_moment_priorities[], activation_triggers[], pain_points[], success_metrics[], confidence, sources }

**Activation Map Types:**
- `ActivationStage` — { level, name, signal_strength, trigger_events[], value_moments_unlocked[], drop_off_risk: "low"|"medium"|"high", drop_off_reasons? }
- `StageTransition` — { from_level, to_level, trigger_events[], typical_timeframe? }
- `ActivationMap` — { stages[], transitions[], primary_activation_level, confidence, sources }

**Measurement Spec Types:**
- `EventProperty` — { name, type: "string"|"number"|"boolean"|"array", description }
- `TrackingEvent` — { name, description, properties[], trigger_condition, maps_to (discriminated union), category }
- `MeasurementSpec` — { events[], total_events, activation_levels_covered[], value_moments_covered[], confidence, sources }

**`maps_to` discriminated union:**
```typescript
| { type: "value_moment"; moment_id: string }
| { type: "activation_level"; activation_level: number }
| { type: "both"; moment_id: string; activation_level: number }
```

**Generation Result:**
- `OutputGenerationResult` — { productId, icp_profiles[], activation_map, measurement_spec, generated_at, execution_time_ms }

**Re-exports:** ValueMoment, ValueMomentTier, ActivationLevel, SignalStrength

## Alternatives Considered
1. **Metadata wrapper on MeasurementSpec** — Rejected: flat peer fields are simpler and match the handoff intent
2. **Separate value_unlocks[] on ActivationMap** — Rejected: duplicates data already in stages
3. **Optional fields in maps_to** — Rejected: properly discriminated union prevents impossible states

## Success Criteria
- All 8 acceptance criteria from the story are met
- Types compile without errors
- Types are importable from `convex/analysis/outputs/types.ts`
- Downstream stories (ICP generator, activation map generator, measurement spec generator) can use these types
