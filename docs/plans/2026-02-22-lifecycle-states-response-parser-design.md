# Lifecycle States Response Parser Design

## Overview

A 3-line parser function (`parseLifecycleStatesResponse`) that composes `extractJson` with Zod schema validation. Establishes the Zod-first pattern for new output parsers, replacing the legacy hand-written validation approach.

## Problem Statement

The lifecycle states generator needs to parse LLM text responses into typed `LifecycleStatesResult` objects. Existing parsers (activation-map, measurement-spec) use 50-100 lines of hand-written field-by-field validation. The Zod schemas in `@basesignal/core` already encode these rules but aren't used by the parsers.

## Expert Perspectives

### Technical
- Zod-only validation is the right call. Existing hand-written parsers are the anomaly, not the standard — they predate the Zod schemas.
- Let ZodError propagate unmodified. It already includes field paths, type mismatches, and expected values — descriptive enough for the pipeline context where errors surface as PipelineError objects.
- This is the moment to establish the pattern going forward. Starting with Zod now is cheaper than refactoring all parsers later.

### Simplification Review
- Design is irreducible: one extraction call, one validation call, one return.
- No wrapping, no custom error messages, no boilerplate — all eliminated by design.
- Integrates cleanly with upstream type definitions and downstream generator orchestration.

## Proposed Solution

```typescript
import { extractJson } from "@basesignal/core";
import { LifecycleStatesResultSchema } from "@basesignal/core";
import type { LifecycleStatesResult } from "@basesignal/core";

export function parseLifecycleStatesResponse(text: string): LifecycleStatesResult {
  const raw = extractJson(text);
  return LifecycleStatesResultSchema.parse(raw);
}
```

## Design Details

- **Location:** `packages/mcp-server/src/analysis/outputs/lifecycle-states.ts` (added to file created by S001)
- **Imports:** `extractJson`, `LifecycleStatesResultSchema`, `LifecycleStatesResult` from `@basesignal/core`
- **Error behavior:** Propagates `SyntaxError` (bad JSON) or `ZodError` (invalid structure) unmodified
- **Downstream:** Called by `generateLifecycleStates()` (S003), which wraps in try/catch for pipeline error handling

## Alternatives Considered

**Hand-written validation (existing pattern):** Manual `typeof` checks and `Array.isArray` guards like activation-map.ts. Rejected because it duplicates Zod schema logic, produces 50-100 lines vs 3, and the story explicitly requires Zod-based validation.

**Wrapped ZodError:** Custom error messages wrapping ZodError for friendlier output. Rejected because ZodError already includes field paths and type expectations, and errors surface as PipelineError objects in logs, not directly to end users.

## Success Criteria

- `extractJson` from `@basesignal/core` is used
- Validates against `LifecycleStatesResultSchema`
- Valid 7-state response parses to typed result
- Missing required fields throws ZodError with field paths
- Invalid state structure throws ZodError with nested paths (e.g., `states[2].entry_criteria`)
