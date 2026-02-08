# ICP Profile Generator Design

## Overview

Create `convex/analysis/outputs/generateICPProfiles.ts` following the established lens extractor pattern: an `internalAction` that orchestrates fetching + LLM call + parsing, with two exported pure functions (`buildICPPrompt`, `parseICPProfiles`) and a system prompt constant tested in isolation.

## Problem Statement

The ICP (Ideal Customer Profile) generator needs to produce 2-3 distinct persona profiles from aggregated role and value moment data. Each persona should have prioritized value moments, activation triggers, and success metrics that differentiate it from the others.

## Expert Perspectives

### Technical

- **Follow Option A** (inline fetching in internalAction) matching the existing lens extractor pattern. Unit tests cover the pure functions (prompt builder, parser). The internalAction orchestrates the full flow.
- Inline the aggregation logic since S001 (ICP data aggregation) hasn't been implemented yet. When S001 lands, extraction into a shared helper is straightforward.
- The mental model is consistent: "internalActions orchestrate, pure functions are tested in isolation."

### Simplification Review

- Removed standalone `validateDistinctPriorities` helper — folded into `parseICPProfiles`
- Removed separate `ICPInputData` interface — build prompt directly from raw fetched data
- Combined all validation (count + distinctness) into a single pass in the parser
- Added TODO comment requirement about S001 dependency for future extraction

## Proposed Solution

Two exported pure functions + one system prompt constant + one internalAction:

```
ICP_SYSTEM_PROMPT (exported const)
  |
buildICPPrompt(roles, valueMoments, targetCustomer) -> string
  |
parseICPProfiles(responseText) -> ICPProfile[]
  |
generateICPProfiles internalAction (fetch -> prompt -> LLM -> parse)
```

## Design Details

### System Prompt (`ICP_SYSTEM_PROMPT`)

Module-level constant (matching `extractStateTransitions.ts` convention) instructing Claude to:
- Generate exactly 2-3 distinct ICP profiles
- Use specific, role-based persona names (not "Power User" or "Admin")
- Ensure each persona has different `value_moment_priorities`
- Return only JSON array

### Prompt Builder (`buildICPPrompt`)

Pure function that takes roles array, value moments, and target customer string. Builds a user prompt containing:
- Target customer context
- Role names with occurrence counts and tier-1 moment counts
- Value moments grouped by role with IDs, tiers, and descriptions

### Response Parser (`parseICPProfiles`)

Pure function that:
1. Extracts JSON from response text (handles code-fenced JSON via `extractJson`)
2. Validates array with 2-3 elements (throws if outside range)
3. Validates required fields on each profile (name, description, value_moment_priorities, etc.)
4. Validates distinctness: no two profiles share identical `moment_id` sets
5. Normalizes confidence to 0-1 range
6. Assigns unique IDs to each profile

All validation in a single pass — no separate helper functions.

### InternalAction (`generateICPProfiles`)

```
1. Fetch convergence results + identity data via ctx.runQuery
   // TODO: Replace inline fetching with aggregateICPInputs when S001 lands
2. Build prompt via buildICPPrompt(...)
3. Call Claude via callClaude({ system, user, temperature: 0.3 })
4. Parse and validate via parseICPProfiles(responseText)
5. Return ICPProfile[]
```

### Test File (`generateICPProfiles.test.ts`)

Unit tests covering:
- **System prompt**: contains "2-3", good/bad name examples, distinctness instruction
- **Prompt builder**: includes target customer, role names, value moment IDs
- **Parser valid cases**: 2-profile response, 3-profile response, code-fenced JSON
- **Parser error cases**: 1 profile, 4 profiles, non-array, missing fields, empty priorities, identical priorities across profiles
- **Parser normalization**: confidence clamped to 0-1, unique IDs assigned

## Alternatives Considered

**Option B (Accept pre-aggregated data with separate pure functions):** Rejected. Creates a false separation that doesn't add real testability since the parser/prompt functions already cover the meaningful logic. Follows the technical architect's advice to match the existing lens pattern.

**Separate `validateDistinctPriorities` function:** Rejected by simplification review. The validation is simple enough to inline in the parser, avoiding an unnecessary abstraction.

## Success Criteria

1. `generateICPProfiles` internalAction accepts productId and returns `ICPProfile[]`
2. Prompt includes aggregated role data and value moments
3. LLM output is parsed into `ICPProfile[]` structure
4. Produces exactly 2-3 personas (enforced by prompt AND parser)
5. Each persona has distinct `value_moment_priorities`
6. Persona names are specific and role-based (enforced by prompt examples)
7. Linear test produces PM, Engineer, and Team Lead personas
