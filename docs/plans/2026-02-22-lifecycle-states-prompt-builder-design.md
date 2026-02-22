# Lifecycle States Prompt Builder Design

## Overview

Create `packages/mcp-server/src/analysis/outputs/lifecycle-states.ts` with two exports: a static system prompt constant (`LIFECYCLE_STATES_SYSTEM_PROMPT`) and a pure prompt builder function (`buildLifecycleStatesPrompt`). Follows the activation-map.ts pattern exactly.

## Problem Statement

The lifecycle states generator needs a system prompt that instructs the LLM to produce 7 user lifecycle states (new through resurrected) with product-specific time windows and measurable criteria, and a prompt builder that assembles product context (identity, activation levels, activation map, value moments) into the user prompt.

## Expert Perspectives

### Product
- Use principled calibration over archetype heuristics — provide activation map timeframes as data, let LLM derive natural cadence
- Scales to unusual products without maintaining archetype lookup tables
- LLM reasoning is auditable (visible why it picks specific time windows)
- Value moments as loose engagement signals across all states — no prescriptive tier-to-state mapping; let LLM reason per product

### Technical
- Individual parameters `(identity, valueMoments, activationLevels, activationMap)` — no wrapper type needed
- Follows activation-map.ts pattern (individual params + string template)
- System prompt is a static constant, prompt builder returns assembled string
- Use `industry` directly as product category proxy — no derived `productCategory` field
- No lifecycle type imports needed — this file only builds strings (parser imports types)

### Simplification Review
- Removed calibration multiplier formulas (at_risk = 2-3x, dormant = buffer)
- Removed redundant alignment rules (activated ↔ activation map — implied by data)
- Simplified activation map surface to primary_activation_level + transition timeframes only
- System prompt must show complete JSON output structure with 2-3 representative state examples (not just one) — matches activation-map.ts pattern
- Verdict: APPROVED after adding explicit output examples

## Proposed Solution

Two exports in a single new file, following activation-map.ts conventions.

### 1. `LIFECYCLE_STATES_SYSTEM_PROMPT` (exported string constant)

Content structure:
- **Role statement**: "You are a product analyst generating a user lifecycle state model."
- **Task**: Generate exactly 7 states: new, activated, engaged, at_risk, dormant, churned, resurrected
- **Output structure**: Complete JSON example showing the full schema with 2-3 representative states (new, activated, at_risk) — same approach as activation-map.ts which shows a complete example
- **Calibration rule**: "Use the product's industry, businessModel, and activation map transition timeframes to calibrate state time windows — different products have vastly different natural cadences"
- **Alignment rule**: Activated state entry_criteria must correspond to primary activation level
- **Value moments rule**: "Value moments of any tier can indicate progression through states. Use them as evidence — don't restrict which tiers map to which states."
- **Rules**: Valid JSON only; exactly 7 states with exact names; measurable entry_criteria with event_name + condition; 8+ transitions covering forward/regression/recovery; confidence 0-1; sources array

### 2. `buildLifecycleStatesPrompt` (exported function)

```typescript
Signature: (identity: IdentityResult, valueMoments: ValueMoment[], activationLevels: ActivationLevel[], activationMap: ActivationMapResult) => string
```

Assembles 4 markdown sections:

**Section 1: Product Identity**
- productName, businessModel, industry (if defined), description, targetCustomer from identity

**Section 2: Activation Levels**
- Same formatting as buildActivationMapUserPrompt (level number, name, signal strength, criteria with action/count/timeWindow)

**Section 3: Activation Map Summary**
- Primary Activation Level number
- Transition timeframes: only transitions with typical_timeframe defined, formatted as `Level N → Level M: {typical_timeframe}`

**Section 4: Value Moments**
- Name, tier, description for each value moment

### 3. Imports

```typescript
import type { IdentityResult, ValueMoment } from "../types.js";
import type { ActivationLevel } from "@basesignal/core";
import type { ActivationMapResult } from "./activation-map.js";
```

## Key Decisions

1. **Individual parameters, not input object** — 4 clean params; follows activation-map.ts, not measurement-spec.ts wrapper pattern
2. **Evidence-based calibration** — Provide activation map timeframes as data; LLM derives natural cadence per product
3. **`industry` as product category proxy** — No derived `productCategory` field; industry + businessModel serve same calibration purpose
4. **Complete JSON example in system prompt** — Shows 2-3 representative states (new, activated, at_risk) with all fields explicit, matching activation-map.ts convention
5. **Value moments as loose signals** — No tier-to-state mapping; LLM reasons per product

## Scope Boundaries

This story does NOT include:
- Response parser (basesignal-lku)
- Generator function (basesignal-cov)
- Tests (basesignal-r4g)
- Index.ts re-exports (wired in with generator)

## Alternatives Considered

1. **Input object wrapper** — Rejected. No derived computations, 4 clean params don't need bundling.
2. **Archetype heuristic categories** — Rejected. Prescriptive ranges tempt LLM to copy verbatim; doesn't scale to unusual products.
3. **Single example in system prompt** — Rejected by reviewer. Insufficient for 7 states with different properties; 2-3 complete examples make the pattern unmistakable.
4. **Tier-to-state mapping** — Rejected. Reverses information flow and makes measurement specs harder to operationalize.

## Success Criteria

- System prompt instructs LLM to generate exactly 7 states with measurable criteria
- System prompt shows complete JSON output structure with representative examples
- Prompt builder assembles all required product context (identity, value moments, activation levels, activation map)
- File follows activation-map.ts conventions
- Downstream stories (parser, generator, tests) can build on this without changes
