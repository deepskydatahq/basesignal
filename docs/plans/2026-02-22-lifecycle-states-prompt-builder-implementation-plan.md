# Implementation Plan: M010-E002-S001 — System Prompt and Prompt Builder for Lifecycle States

**Task:** basesignal-yts
**Status:** plan → ready

## Summary

Create `packages/mcp-server/src/analysis/outputs/lifecycle-states.ts` with two exports following the activation-map.ts pattern: a static system prompt constant (`LIFECYCLE_STATES_SYSTEM_PROMPT`) and a prompt builder function (`buildLifecycleStatesPrompt`). This file only builds strings — parser, generator, and tests are separate stories.

## Prerequisites

- **basesignal-kmo** (M010-E001-S001: TypeScript types) — conceptual dependency. This file does NOT import lifecycle types (it only builds strings), but the system prompt's JSON example must match the types contract.

## Steps

### Step 1: Create lifecycle-states.ts with imports

**File:** `packages/mcp-server/src/analysis/outputs/lifecycle-states.ts` (new file)

```typescript
// Lifecycle States generation.

import type { IdentityResult, ValueMoment } from "../types.js";
import type { ActivationLevel } from "@basesignal/core";
import type { ActivationMapResult } from "./activation-map.js";
```

- `IdentityResult` — productName, businessModel, industry, description, targetCustomer
- `ValueMoment` — name, tier, description
- `ActivationLevel` — level, name, signalStrength, criteria
- `ActivationMapResult` — stages, transitions, primary_activation_level (local type from activation-map.ts, same import pattern as measurement-spec.ts)
- No lifecycle type imports — this file only builds prompt strings

### Step 2: Add `LIFECYCLE_STATES_SYSTEM_PROMPT` constant

**File:** `packages/mcp-server/src/analysis/outputs/lifecycle-states.ts`

Exported string constant following activation-map.ts structure:

```
// --- System Prompt ---

export const LIFECYCLE_STATES_SYSTEM_PROMPT = `...`;
```

Content structure:

1. **Role statement**: "You are a product analyst generating a user lifecycle state model from product identity, activation levels, an activation map, and value moments."
2. **Context** (1-2 sentences): What lifecycle states represent and why they matter for product growth.
3. **`## Input`**: What data will be provided — product identity, activation levels, activation map summary, value moments.
4. **`## Output Requirements`**: Complete JSON example showing `states`, `transitions`, `confidence`, `sources`. Show 2-3 representative states (new, activated, at_risk) with all fields explicit:
   - Each state: `name`, `definition`, `entry_criteria` (array of `{event_name, condition, threshold?}`), `exit_triggers` (string[]), `time_window?`
   - Each transition: `from_state`, `to_state`, `trigger_conditions` (string[]), `typical_timeframe?`
   - Top-level: `confidence` (number 0-1), `sources` (string[])
5. **`## Rules`**: ~10 numbered rules:
   - Exactly 7 states: new, activated, engaged, at_risk, dormant, churned, resurrected
   - Measurable `entry_criteria` with `event_name` + `condition` (+ optional `threshold`)
   - `exit_triggers` are human-readable narrative strings
   - Activated state `entry_criteria` must correspond to primary activation level criteria
   - Calibrate time windows using industry, businessModel, and activation map transition timeframes
   - Value moments of any tier can indicate progression — use as evidence, don't restrict tiers to states
   - 8+ transitions covering forward progression, regression, and recovery paths
   - `confidence` 0-1 numeric based on data quality
   - `sources` array describing what data informed the model
6. **`## Important`**: Return only valid JSON; exactly 7 states with exact names; `time_window` is optional

### Step 3: Add `buildLifecycleStatesPrompt` function

**File:** `packages/mcp-server/src/analysis/outputs/lifecycle-states.ts`

```typescript
// --- Prompt Builder ---

export function buildLifecycleStatesPrompt(
  identity: IdentityResult,
  valueMoments: ValueMoment[],
  activationLevels: ActivationLevel[],
  activationMap: ActivationMapResult,
): string
```

Uses `parts: string[]` + `parts.push()` + `parts.join("\n")` pattern (same as `buildActivationMapUserPrompt`).

**Section 1: `## Product Identity`**
```
- Product Name: identity.productName
- Business Model: identity.businessModel
- Industry: identity.industry  (only if defined)
- Description: identity.description
- Target Customer: identity.targetCustomer
```

**Section 2: `## Activation Levels`**
Same formatting as `buildActivationMapUserPrompt` (lines 115-126 of activation-map.ts):
```
### Level N: name
Signal Strength: ...
Criteria:
  - action (count: N within timeWindow)
```
Note: Skip `Confidence` and `Reasoning` fields — they are analysis metadata not relevant to lifecycle calibration.

**Section 3: `## Activation Map Summary`**
```
Primary Activation Level: N
Transition Timeframes:
  Level N → Level M: typical_timeframe
```
Only include transitions that have `typical_timeframe` defined.

**Section 4: `## Value Moments`**
```
### name (Tier N)
Description: ...
```

### Step 4: Verify TypeScript compilation

Run `npx tsc --noEmit` in `packages/mcp-server` to confirm the file compiles.

### Step 5: Run tests

Run `npm run test:run` to confirm no regressions.

## Verification Checklist

- [ ] `LIFECYCLE_STATES_SYSTEM_PROMPT` is an exported string constant
- [ ] System prompt instructs LLM to generate 7 states: new, activated, engaged, at_risk, dormant, churned, resurrected
- [ ] System prompt requires product-specific time windows calibrated to product type
- [ ] System prompt requires measurable `entry_criteria` using `event_name` + `condition`
- [ ] System prompt requires activated state to align with activation map primary activation level
- [ ] System prompt shows complete JSON output structure with 2-3 representative state examples
- [ ] `buildLifecycleStatesPrompt` accepts identity, valueMoments, activationLevels, activationMap (4 individual params)
- [ ] Prompt includes product category/business model for calibration
- [ ] Prompt includes value moment names and tiers
- [ ] Prompt includes activation level names and criteria
- [ ] Prompt includes activation map primary level and transition timeframes
- [ ] File follows activation-map.ts conventions (comment separators, export pattern, import style)
- [ ] No lifecycle type imports (file builds strings only)
- [ ] `npx tsc --noEmit` succeeds in mcp-server
- [ ] `npm run test:run` passes

## Scope

- **In scope:** System prompt constant, prompt builder function, imports
- **Out of scope:** Response parser (basesignal-lku), generator function (basesignal-cov), tests (basesignal-r4g), index.ts re-exports (wired with generator)

## Risk

Low. New file with no modifications to existing code. Type imports are all from established modules.
