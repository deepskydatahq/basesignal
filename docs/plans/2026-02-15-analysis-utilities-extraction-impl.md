# Analysis Utilities Extraction - Implementation Plan

**Date:** 2026-02-15
**Story:** M008-E001-S005 - Extract pure analysis utilities
**Design:** `docs/plans/2026-02-15-analysis-utilities-extraction-design.md`
**Depends on:** M008-E001-S001 (monorepo workspace setup), M008-E001-S002 (type system extraction)

---

## Prerequisites

This plan assumes S001 (monorepo workspace setup) and S002 (type system extraction) have landed, meaning:
- `packages/core/` exists with `package.json`, `tsconfig.json`, and vitest config
- `@basesignal/core` is resolvable from the Convex directory via npm workspaces
- Types like `ValidatedCandidate`, `CandidateCluster`, `LensType` are exported from `@basesignal/core`

If S002 has NOT landed yet, Task 2 defines fallback local types. These must be reconciled when S002 merges.

---

## Task Breakdown

### Task 1: Create `packages/core/src/analysis/json.ts`

**What:** Extract the `extractJson` utility from `convex/analysis/lenses/shared.ts`.

**Source:** `convex/analysis/lenses/shared.ts` lines 46-50.

**Action:** Create a new file with only the `extractJson` function. This is a 4-line pure utility with zero imports.

```typescript
// packages/core/src/analysis/json.ts

/**
 * Extract JSON from text that may contain markdown code fences or raw JSON.
 */
export function extractJson(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}
```

**Tests:** No existing standalone tests for `extractJson`. It is implicitly tested via `parseClusteringResponse` tests and `parseLensResponse` tests. Add a minimal test file:

```typescript
// packages/core/src/analysis/json.test.ts
import { describe, it, expect } from "vitest";
import { extractJson } from "./json";

describe("extractJson", () => {
  it("parses raw JSON", () => {
    expect(extractJson('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it("parses JSON inside code fences", () => {
    expect(extractJson('```json\n{"key": "value"}\n```')).toEqual({ key: "value" });
  });

  it("parses JSON inside generic code fences", () => {
    expect(extractJson('```\n[1, 2]\n```')).toEqual([1, 2]);
  });

  it("throws on invalid JSON", () => {
    expect(() => extractJson("not json")).toThrow();
  });
});
```

**Verification:** `cd packages/core && npx vitest run src/analysis/json.test.ts`

---

### Task 2: Create `packages/core/src/analysis/similarity.ts`

**What:** Copy `convex/lib/similarity.ts` verbatim.

**Source:** `convex/lib/similarity.ts` (entire file, 136 lines).

**Action:** Direct copy. Zero changes needed. The file has no imports -- it is 100% pure TypeScript. All exports preserved exactly:
- `TfIdfVector` (type alias for `Map<string, number>`)
- `tokenize(text: string): string[]`
- `termFrequency(tokens: string[]): Map<string, number>`
- `inverseDocumentFrequency(corpus: string[][]): Map<string, number>`
- `computeTfIdfVectors(documents: string[]): TfIdfVector[]`
- `cosineSimilarity(a: TfIdfVector, b: TfIdfVector): number`
- `pairwiseSimilarity(vectors: TfIdfVector[]): Array<{i, j, similarity}>`

The private `STOP_WORDS` constant is NOT exported (stays module-private, same as source).

**Tests:** Copy `convex/lib/similarity.test.ts` to `packages/core/src/analysis/similarity.test.ts`. Only change: update the import path from `./similarity` (already correct -- same relative path).

The test file covers: tokenize (6 tests), termFrequency (3 tests), inverseDocumentFrequency (3 tests), computeTfIdfVectors (3 tests), cosineSimilarity (7 tests), pairwiseSimilarity (6 tests). Total: 28 tests.

**Verification:** `cd packages/core && npx vitest run src/analysis/similarity.test.ts` -- all 28 tests pass.

---

### Task 3: Create `packages/core/src/analysis/clustering.ts`

**What:** Extract pure functions from `convex/analysis/convergence/clusterCandidates.ts`, excluding the Convex `internalAction` wrapper and `clusterCandidatesLLM`.

**Source:** `convex/analysis/convergence/clusterCandidates.ts`

**Functions to extract (in file order):**

| Export | Lines | Notes |
|--------|-------|-------|
| `DEFAULT_SIMILARITY_THRESHOLD` | 16 | Constant `0.7` |
| `UnionFind` class | 20-54 | Pure data structure, no imports |
| `candidateText` | 61-63 | Pure helper |
| `sameLens` | 68-70 | Pure helper |
| `canMerge` | 77-101 | Pure helper (uses `UnionFind`) |
| `buildCluster` | 106-117 | Pure helper |
| `clusterCandidatesCore` | 128-172 | Core algorithm (imports `computeTfIdfVectors`, `cosineSimilarity`) |
| `CLUSTERING_SYSTEM_PROMPT` | 195-220 | Pure string constant |
| `buildClusteringPrompt` | 225-231 | Pure string builder |
| `parseClusteringResponse` | 239-308 | Pure parser (imports `extractJson`) |

**Functions NOT extracted:**

| Function | Reason |
|----------|--------|
| `clusterCandidates` (internalAction) | Convex-coupled runtime wrapper |
| `clusterCandidatesLLM` | Anthropic SDK dependency (`@anthropic-ai/sdk`) |

**Imports to rewrite:**

```diff
- import { computeTfIdfVectors, cosineSimilarity } from "../../lib/similarity";
+ import { computeTfIdfVectors, cosineSimilarity } from "./similarity";

- import { extractJson } from "../lenses/shared";
+ import { extractJson } from "./json";

- import type { ValidatedCandidate, CandidateCluster, LensType } from "./types";
+ import type { ValidatedCandidate, CandidateCluster, LensType } from "../types";
```

The last import path depends on where S002 places the types. If types are at `packages/core/src/types.ts` or `packages/core/src/types/convergence.ts`, adjust accordingly. The import path will be relative within `packages/core/src/`.

**Fallback if S002 has not landed:** Define minimal local interfaces at the top of the file or in a local `packages/core/src/analysis/_types.ts`:

```typescript
// Minimal types needed by clustering.ts (merge with S002 types when available)
export type LensType = string;

export interface ValidatedCandidate {
  id: string;
  lens: LensType;
  name: string;
  description: string;
  confidence: number;
  validation_status: "valid" | "rewritten" | "removed";
  validation_issue?: string;
  rewritten_from?: { name: string; description: string };
  source_urls?: string[];
}

export interface CandidateCluster {
  cluster_id: string;
  candidates: ValidatedCandidate[];
  lens_count: number;
  lenses: LensType[];
}
```

**Removed imports (not needed in extracted code):**
- `import { internalAction } from "../../_generated/server";`
- `import { v } from "convex/values";`
- `import { internal } from "../../_generated/api";`
- `import type Anthropic from "@anthropic-ai/sdk";`

**Tests:** Copy `convex/analysis/convergence/clusterCandidates.test.ts` to `packages/core/src/analysis/clustering.test.ts`.

Changes needed in test file:
1. Update import path: `from "./clusterCandidates"` becomes `from "./clustering"`
2. Update type import: `from "./types"` becomes the same path as the source (relative within `packages/core`)
3. ALL tests move (none are LLM-dependent). The test file covers: UnionFind (4 tests), candidateText (1 test), sameLens (2 tests), canMerge (3 tests), buildCluster (2 tests), clusterCandidatesCore (7 tests), integration tests (5 tests), CLUSTERING_SYSTEM_PROMPT (2 tests), buildClusteringPrompt (2 tests), parseClusteringResponse (9 tests). Total: 37 tests.

**Verification:** `cd packages/core && npx vitest run src/analysis/clustering.test.ts` -- all 37 tests pass.

---

### Task 4: Create `packages/core/src/analysis/validation.ts`

**What:** Extract deterministic validation functions from `convex/analysis/convergence/validateCandidates.ts`, excluding the Convex `internalAction`, LLM review functions, and LLM-specific constants.

**Source:** `convex/analysis/convergence/validateCandidates.ts`

**Functions to extract:**

| Export | Lines | Notes |
|--------|-------|-------|
| `FEATURE_AS_VALUE_PATTERNS` | 15-26 | Pure constant (RegExp[]) |
| `MARKETING_LANGUAGE_PATTERNS` | 29-39 | Pure constant (RegExp[]) |
| `ABSTRACT_OUTCOME_PATTERNS` | 42-49 | Pure constant (string[]) |
| `VAGUE_PHRASES` | 52-67 | Pure constant (string[]) |
| `isFeatureAsValue` | 76-89 | Pure function |
| `isVagueCandidate` | 96-104 | Pure function |
| `isMarketingLanguage` | 112-143 | Pure function |
| `findWithinLensDuplicates` | 149-178 | Pure function (imports `computeTfIdfVectors`, `cosineSimilarity`) |
| `hasUnverifiedFeatureRef` | 185-199 | Pure function |
| `buildKnownFeaturesSet` | 207-231 | Pure function |
| `runValidationPipeline` | 347-442 | Pure orchestrator |

**Functions NOT extracted:**

| Function | Reason |
|----------|--------|
| `validateCandidatesAction` (internalAction) | Convex-coupled (calls `ctx.runQuery`) |
| `applyLlmReview` | Anthropic SDK dependency |
| `parseLlmResponse` | LLM-specific (only consumed by `applyLlmReview`) |
| `VALIDATION_SYSTEM_PROMPT` | LLM-specific constant |
| `buildLlmPrompt` (private) | LLM-specific |

**Imports to rewrite:**

```diff
- import { computeTfIdfVectors, cosineSimilarity } from "../../lib/similarity";
+ import { computeTfIdfVectors, cosineSimilarity } from "./similarity";

- import type { LensResult, LensCandidate, ValidatedCandidate } from "./types";
+ import type { ValidatedCandidate } from "../types";  // from S002
```

**Critical type issue:** The source file imports `LensResult` from `./types` (convergence types), but `LensResult` is NOT defined there. It is defined in `convex/analysis/lenses/types.ts` with a different shape (includes `candidate_count`, `execution_time_ms`, and `lens: LensType` where `LensType` is the lenses variant, not the convergence variant).

However, `runValidationPipeline` only uses `{ lens: string; candidates: Array<{ id: string; name: string; description: string; source_urls?: string[] }> }` from the `LensResult` type. The test fixtures confirm this -- they pass objects with just `lens` (a plain string like "Functional Value", not an enum member) and `candidates` with `{ id, name, description }`.

**Resolution:** Define a minimal `ValidationInput` interface for `runValidationPipeline`:

```typescript
/** Input shape for the validation pipeline. */
export interface ValidationLensResult {
  lens: string;
  candidates: Array<{
    id: string;
    name: string;
    description: string;
    source_urls?: string[];
  }>;
}
```

This captures the actual structural contract without depending on either the lenses `LensType` or convergence `LensType`. The `runValidationPipeline` function signature becomes:

```typescript
export function runValidationPipeline(
  lensResults: ValidationLensResult[],
  knownFeatures: Set<string>
): ValidatedCandidate[]
```

If S002 defines a canonical `LensResult` type, this can be replaced with that. The interface is structurally compatible with both the lenses `LensResult` and the test fixtures.

**Removed imports (not needed in extracted code):**
- `import { internalAction } from "../../_generated/server";`
- `import { internal } from "../../_generated/api";`
- `import { v } from "convex/values";`
- `import Anthropic from "@anthropic-ai/sdk";`

**Tests:** Copy `convex/analysis/convergence/validateCandidates.test.ts` to `packages/core/src/analysis/validation.test.ts`.

Changes needed in test file:
1. Update import path: `from "./validateCandidates"` becomes `from "./validation"`
2. Update type import: `from "./types"` becomes the local `ValidationLensResult` from `./validation` (or use the inline type -- the test uses `LensResult[]` which is structurally compatible)
3. **Remove** `parseLlmResponse` tests (describe block at lines 471-497) -- that function stays in Convex
4. Remove `parseLlmResponse` from the import statement

Tests to KEEP: isFeatureAsValue (9 tests), isVagueCandidate (7 tests), MARKETING_LANGUAGE_PATTERNS (2 tests), ABSTRACT_OUTCOME_PATTERNS (2 tests), isMarketingLanguage (10 tests), findWithinLensDuplicates (5 tests), hasUnverifiedFeatureRef (4 tests), buildKnownFeaturesSet (4 tests), runValidationPipeline (8 tests), runValidationPipeline marketing language (5 tests). Total: 56 tests.

Tests to REMOVE: parseLlmResponse (4 tests).

Net: 56 tests.

**Verification:** `cd packages/core && npx vitest run src/analysis/validation.test.ts` -- all 56 tests pass.

---

### Task 5: Create `packages/core/src/analysis/index.ts` barrel export

**What:** Create the barrel export for the analysis module.

```typescript
// packages/core/src/analysis/index.ts
export { extractJson } from "./json";

export {
  type TfIdfVector,
  tokenize,
  termFrequency,
  inverseDocumentFrequency,
  computeTfIdfVectors,
  cosineSimilarity,
  pairwiseSimilarity,
} from "./similarity";

export {
  DEFAULT_SIMILARITY_THRESHOLD,
  UnionFind,
  candidateText,
  sameLens,
  canMerge,
  buildCluster,
  clusterCandidatesCore,
  CLUSTERING_SYSTEM_PROMPT,
  buildClusteringPrompt,
  parseClusteringResponse,
} from "./clustering";

export {
  FEATURE_AS_VALUE_PATTERNS,
  MARKETING_LANGUAGE_PATTERNS,
  ABSTRACT_OUTCOME_PATTERNS,
  VAGUE_PHRASES,
  isFeatureAsValue,
  isVagueCandidate,
  isMarketingLanguage,
  findWithinLensDuplicates,
  hasUnverifiedFeatureRef,
  buildKnownFeaturesSet,
  runValidationPipeline,
  type ValidationLensResult,
} from "./validation";
```

**Also update:** `packages/core/src/index.ts` to re-export the analysis barrel:

```typescript
// Add to existing packages/core/src/index.ts
export * from "./analysis";
```

**Verification:** `cd packages/core && npx tsc --noEmit` -- zero errors.

---

### Task 6: Update Convex files to import from `@basesignal/core`

**What:** Replace the duplicated implementations in Convex files with thin re-exports and imports from `@basesignal/core`.

#### 6a. `convex/lib/similarity.ts`

Replace entire file with re-exports:

```typescript
// Thin re-export: all pure functions live in @basesignal/core
export {
  type TfIdfVector,
  tokenize,
  termFrequency,
  inverseDocumentFrequency,
  computeTfIdfVectors,
  cosineSimilarity,
  pairwiseSimilarity,
} from "@basesignal/core";
```

#### 6b. `convex/analysis/convergence/clusterCandidates.ts`

Keep only: the Convex `internalAction` wrapper (`clusterCandidates`) and `clusterCandidatesLLM`. Replace pure function implementations with imports from `@basesignal/core`:

```typescript
import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import type Anthropic from "@anthropic-ai/sdk";
import type { ValidatedCandidate, CandidateCluster } from "./types";

// Re-export pure functions from @basesignal/core for backward compatibility
export {
  DEFAULT_SIMILARITY_THRESHOLD,
  UnionFind,
  candidateText,
  sameLens,
  canMerge,
  buildCluster,
  clusterCandidatesCore,
  CLUSTERING_SYSTEM_PROMPT,
  buildClusteringPrompt,
  parseClusteringResponse,
} from "@basesignal/core";

import {
  clusterCandidatesCore,
  DEFAULT_SIMILARITY_THRESHOLD,
  CLUSTERING_SYSTEM_PROMPT,
  buildClusteringPrompt,
  parseClusteringResponse,
} from "@basesignal/core";

// --- Convex internalAction (stays here) ---

export const clusterCandidates = internalAction({
  args: {
    productId: v.id("products"),
    validatedCandidates: v.any(),
    threshold: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const candidates = args.validatedCandidates as ValidatedCandidate[];
    const active = candidates.filter((c) => c.validation_status !== "removed");
    const threshold = args.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    return clusterCandidatesCore(active, threshold);
  },
});

// --- LLM-based clustering (stays here, has Anthropic SDK dependency) ---

export async function clusterCandidatesLLM(
  candidates: ValidatedCandidate[],
  client: Anthropic
): Promise<CandidateCluster[]> {
  if (candidates.length === 0) return [];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: 0.2,
    system: CLUSTERING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildClusteringPrompt(candidates) }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseClusteringResponse(text, candidates);
}
```

#### 6c. `convex/analysis/convergence/validateCandidates.ts`

Keep only: the Convex `internalAction` wrapper (`validateCandidatesAction`), LLM review functions (`applyLlmReview`, `parseLlmResponse`, `VALIDATION_SYSTEM_PROMPT`, `buildLlmPrompt`). Replace pure function implementations with imports from `@basesignal/core`:

```typescript
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import type { ValidatedCandidate } from "./types";

// Re-export pure functions from @basesignal/core for backward compatibility
export {
  FEATURE_AS_VALUE_PATTERNS,
  MARKETING_LANGUAGE_PATTERNS,
  ABSTRACT_OUTCOME_PATTERNS,
  VAGUE_PHRASES,
  isFeatureAsValue,
  isVagueCandidate,
  isMarketingLanguage,
  findWithinLensDuplicates,
  hasUnverifiedFeatureRef,
  buildKnownFeaturesSet,
  runValidationPipeline,
} from "@basesignal/core";

import {
  buildKnownFeaturesSet,
  runValidationPipeline,
} from "@basesignal/core";

// ... keep parseLlmResponse, VALIDATION_SYSTEM_PROMPT, buildLlmPrompt, applyLlmReview, validateCandidatesAction unchanged ...
```

#### 6d. `convex/analysis/lenses/shared.ts`

Add re-export of `extractJson` from `@basesignal/core` while keeping all other functions (they have Anthropic SDK dependencies):

```diff
+ // Re-export extractJson from @basesignal/core (canonical location)
+ export { extractJson } from "@basesignal/core";
- /**
-  * Extract JSON from text that may contain markdown code fences or raw JSON.
-  */
- export function extractJson(text: string): unknown {
-   const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
-   const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();
-   return JSON.parse(jsonStr);
- }
```

**Verification:** `npm test` from repo root -- all existing Convex tests still pass with zero changes to test files.

---

### Task 7: Run full verification suite

Run all verification checks from the design doc:

1. **Build check:** `cd packages/core && npx tsc --noEmit` -- zero errors
2. **Test parity:** `cd packages/core && npx vitest run` -- all migrated tests pass (28 + 37 + 56 + 4 = 125 tests)
3. **Zero dependencies:** Verify `packages/core/package.json` has zero `dependencies` (only `devDependencies`)
4. **Import check:** `grep -r "from.*convex" packages/core/src/` -- zero results
5. **Convex still works:** `npm test` from repo root -- all existing tests pass
6. **Export verification:** Confirm these imports resolve:
   ```typescript
   import { tokenize, cosineSimilarity, computeTfIdfVectors } from "@basesignal/core";
   import { UnionFind, clusterCandidatesCore } from "@basesignal/core";
   import { isFeatureAsValue, isVagueCandidate, runValidationPipeline } from "@basesignal/core";
   import { extractJson } from "@basesignal/core";
   ```

---

## File Summary

### New files (packages/core)

| File | Lines (est.) | Description |
|------|-------------|-------------|
| `packages/core/src/analysis/json.ts` | ~10 | `extractJson` utility |
| `packages/core/src/analysis/json.test.ts` | ~25 | Tests for `extractJson` |
| `packages/core/src/analysis/similarity.ts` | ~136 | TF-IDF similarity (verbatim copy) |
| `packages/core/src/analysis/similarity.test.ts` | ~245 | Similarity tests (copy, path update) |
| `packages/core/src/analysis/clustering.ts` | ~220 | UnionFind + clustering + prompt/parser |
| `packages/core/src/analysis/clustering.test.ts` | ~615 | Clustering tests (copy, path update) |
| `packages/core/src/analysis/validation.ts` | ~290 | Deterministic validation checks |
| `packages/core/src/analysis/validation.test.ts` | ~700 | Validation tests (copy, remove LLM tests) |
| `packages/core/src/analysis/index.ts` | ~40 | Barrel export |

### Modified files (Convex bridge)

| File | Change |
|------|--------|
| `convex/lib/similarity.ts` | Replace implementation with re-exports from `@basesignal/core` |
| `convex/analysis/convergence/clusterCandidates.ts` | Replace pure functions with imports; keep `internalAction` + `clusterCandidatesLLM` |
| `convex/analysis/convergence/validateCandidates.ts` | Replace pure functions with imports; keep `internalAction` + LLM review code |
| `convex/analysis/lenses/shared.ts` | Replace `extractJson` implementation with re-export |
| `packages/core/src/index.ts` | Add `export * from "./analysis"` |

### Unchanged files

- `convex/lib/similarity.test.ts` -- continues to pass (imports from same path, now re-exported)
- `convex/analysis/convergence/clusterCandidates.test.ts` -- continues to pass
- `convex/analysis/convergence/validateCandidates.test.ts` -- continues to pass
- All other files

---

## Risk Mitigation

1. **S002 not yet landed:** Define minimal local types in `packages/core/src/analysis/_types.ts`. Mark with `// TODO: merge with @basesignal/core types from S002` comments. This avoids blocking on S002 while maintaining a clean migration path.

2. **LensResult type mismatch:** The convergence types file does NOT define `LensResult`, yet `validateCandidates.ts` imports it from there. The extracted code defines a `ValidationLensResult` interface matching the actual structural usage. This is safer than importing a mismatched type.

3. **Convex re-export compatibility:** Convex uses its own bundler. Verify that `@basesignal/core` resolves correctly in the Convex environment by checking that `convex/tsconfig.json` includes the workspace path mapping. If Convex cannot resolve `@basesignal/core`, use a relative path (`../../packages/core/src/analysis/...`) as a fallback.

4. **Test runner isolation:** The root `vitest.config.ts` uses `jsdom` environment and React plugin. `packages/core` tests need a plain Node environment (no DOM, no React). Ensure `packages/core/vitest.config.ts` does NOT inherit the root config -- use `environment: "node"` explicitly.

---

## Order of Operations

Tasks 1-4 can proceed in parallel (they have no inter-dependencies during creation). Task 3 depends on Task 1 and 2 at import time. Task 4 depends on Task 2 at import time. Task 5 depends on Tasks 1-4. Task 6 depends on Task 5. Task 7 depends on Task 6.

Recommended serial execution order:
1. Task 1 (json.ts) + Task 2 (similarity.ts) -- parallel
2. Task 3 (clustering.ts) + Task 4 (validation.ts) -- parallel (after 1+2)
3. Task 5 (barrel export)
4. Task 6 (Convex bridge updates) -- do 6a, 6d first, then 6b, 6c
5. Task 7 (full verification)

Total estimated effort: ~2 hours (mostly mechanical copy + import path changes).
