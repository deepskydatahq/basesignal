# Analysis Utilities Extraction Design

**Date:** 2026-02-15
**Story:** M008-E001-S005 - Extract pure analysis utilities
**Status:** Draft
**Depends on:** M008-E001-S002 (ProductProfile type system in packages/core)

## Overview

Extract the pure, framework-agnostic analysis utilities -- TF-IDF similarity computation, Union-Find clustering, and deterministic validation checks -- from the Convex backend into `packages/core`. These functions already have zero external dependencies and comprehensive tests, making this a straightforward copy-and-reorganize operation with minimal refactoring.

## Problem Statement

The analysis utilities in `convex/lib/similarity.ts`, `convex/analysis/convergence/clusterCandidates.ts`, and `convex/analysis/convergence/validateCandidates.ts` are pure TypeScript functions with no Convex runtime dependencies, yet they live inside the Convex directory. This couples reusable algorithms to a specific backend framework, preventing their use in the planned MCP server, CLI, or any other consumer. Extracting them into `@basesignal/core` enables any tool in the ecosystem to perform similarity analysis, candidate clustering, and validation without importing from the Convex tree.

## Expert Perspectives

### Technical Architect

These functions are already the right shape -- pure inputs, pure outputs, no side effects. The extraction should preserve their current signatures rather than "improving" them, because the existing Convex code must continue to work with minimal import-path changes. The one genuine design decision is whether `extractJson` (from `convex/analysis/lenses/shared.ts`) should come along, since `parseClusteringResponse` depends on it. It should -- it is a two-line pure utility with no framework coupling. Keep the module boundaries tight: similarity is math, clustering is algorithms over similarity, validation is pattern matching over text. Three files, not one.

### Simplification Reviewer

**Verdict: APPROVED with one cut.**

What to remove: Do NOT extract the LLM-dependent functions (`clusterCandidatesLLM`, `clusterCandidatesLLM`'s prompt builders, `applyLlmReview`, `parseLlmResponse`, the Convex `internalAction` wrappers). The story explicitly scopes to deterministic/pure utilities. The LLM orchestration code has external dependencies (Anthropic SDK) and Convex coupling -- extracting it here would violate the "zero external dependencies" acceptance criterion.

What feels right: Three modules mapping to three concerns. No new abstractions. No wrappers. Copy the functions, copy the tests, update the imports. This is a move, not a rewrite.

## Proposed Solution

### Module Structure

```
packages/core/src/
  analysis/
    similarity.ts          -- TF-IDF: tokenize, termFrequency, inverseDocumentFrequency, computeTfIdfVectors, cosineSimilarity, pairwiseSimilarity
    clustering.ts          -- UnionFind class, clusterCandidatesCore, candidateText, sameLens, canMerge, buildCluster
    validation.ts          -- isFeatureAsValue, isVagueCandidate, isMarketingLanguage, findWithinLensDuplicates, hasUnverifiedFeatureRef, buildKnownFeaturesSet, runValidationPipeline
    json.ts                -- extractJson (shared utility, pulled from lenses/shared.ts)
    index.ts               -- barrel export for all analysis modules
  index.ts                 -- top-level barrel (re-exports analysis/index.ts + types)
```

### File-by-File Extraction Plan

#### 1. `packages/core/src/analysis/similarity.ts`

**Source:** `convex/lib/similarity.ts` (entire file)

**Action:** Direct copy. Zero changes needed. This file is already 100% pure TypeScript with no imports.

**Exports:**
- `TfIdfVector` (type)
- `tokenize(text: string): string[]`
- `termFrequency(tokens: string[]): Map<string, number>`
- `inverseDocumentFrequency(corpus: string[][]): Map<string, number>`
- `computeTfIdfVectors(documents: string[]): TfIdfVector[]`
- `cosineSimilarity(a: TfIdfVector, b: TfIdfVector): number`
- `pairwiseSimilarity(vectors: TfIdfVector[]): Array<{i, j, similarity}>`

**Dependencies:** None.

---

#### 2. `packages/core/src/analysis/json.ts`

**Source:** `convex/analysis/lenses/shared.ts` -- only the `extractJson` function.

**Action:** Extract the single `extractJson` function. Do NOT bring `callClaude`, `parseLensResponse`, `buildPageContext`, or `truncateContent` (those have Anthropic SDK or lens-specific dependencies).

**Exports:**
- `extractJson(text: string): unknown`

**Dependencies:** None.

---

#### 3. `packages/core/src/analysis/clustering.ts`

**Source:** `convex/analysis/convergence/clusterCandidates.ts` -- pure functions only.

**Action:** Copy the following, stripping the Convex `internalAction` wrapper and LLM-related code:

| Function/Class | Include | Notes |
|---|---|---|
| `UnionFind` | Yes | Pure data structure |
| `candidateText` | Yes | Pure helper |
| `sameLens` | Yes | Pure helper |
| `canMerge` | Yes | Pure helper |
| `buildCluster` | Yes | Pure helper |
| `clusterCandidatesCore` | Yes | Core algorithm |
| `DEFAULT_SIMILARITY_THRESHOLD` | Yes | Constant |
| `CLUSTERING_SYSTEM_PROMPT` | Yes | Pure string constant, useful for MCP server |
| `buildClusteringPrompt` | Yes | Pure string builder |
| `parseClusteringResponse` | Yes | Pure parser (depends on `extractJson`) |
| `clusterCandidates` (internalAction) | NO | Convex-coupled |
| `clusterCandidatesLLM` | NO | Anthropic SDK dependency |

**Imports needed:**
- `computeTfIdfVectors`, `cosineSimilarity` from `./similarity`
- `extractJson` from `./json`
- Types: `ValidatedCandidate`, `CandidateCluster`, `LensType` from the core types (already extracted by S002)

**Refactoring required:**
- Change `import { extractJson } from "../lenses/shared"` to `import { extractJson } from "./json"`
- Change `import { computeTfIdfVectors, cosineSimilarity } from "../../lib/similarity"` to `import { computeTfIdfVectors, cosineSimilarity } from "./similarity"`
- Import types from `@basesignal/core` types (or relative path within packages/core)

---

#### 4. `packages/core/src/analysis/validation.ts`

**Source:** `convex/analysis/convergence/validateCandidates.ts` -- deterministic checks only.

**Action:** Copy deterministic functions, excluding LLM review code and the Convex `internalAction`.

| Function/Constant | Include | Notes |
|---|---|---|
| `FEATURE_AS_VALUE_PATTERNS` | Yes | Pure constant |
| `MARKETING_LANGUAGE_PATTERNS` | Yes | Pure constant |
| `ABSTRACT_OUTCOME_PATTERNS` | Yes | Pure constant |
| `VAGUE_PHRASES` | Yes | Pure constant |
| `isFeatureAsValue` | Yes | Pure function |
| `isVagueCandidate` | Yes | Pure function |
| `isMarketingLanguage` | Yes | Pure function |
| `findWithinLensDuplicates` | Yes | Pure (uses similarity.ts) |
| `hasUnverifiedFeatureRef` | Yes | Pure function |
| `buildKnownFeaturesSet` | Yes | Pure function |
| `runValidationPipeline` | Yes | Pure orchestrator |
| `validateCandidatesAction` (internalAction) | NO | Convex-coupled |
| `applyLlmReview` | NO | Anthropic SDK dependency |
| `parseLlmResponse` | NO | LLM-specific |
| `VALIDATION_SYSTEM_PROMPT` | NO | LLM-specific |
| `buildLlmPrompt` (private) | NO | LLM-specific |

**Imports needed:**
- `computeTfIdfVectors`, `cosineSimilarity` from `./similarity`
- Types: `ValidatedCandidate`, `LensType` from core types, plus `LensResult` / `LensCandidate` types

**Refactoring required:**
- Change similarity imports to `./similarity`
- Import types from the core type system

**Note on types:** The `validateCandidates.ts` imports `LensResult` and `LensCandidate` from `./types` (convergence types), but `LensResult` is actually defined in `convex/analysis/lenses/types.ts`. The convergence `types.ts` does not define `LensResult`. This appears to be a type that works at runtime due to structural typing but the import path is technically wrong. The `runValidationPipeline` function uses a simpler shape: `{ lens: string; candidates: Array<{ id: string; name: string; description: string; source_urls?: string[] }> }`. In `@basesignal/core`, we should define a clean `LensResult` interface or re-use the one from S002's type extraction.

---

#### 5. `packages/core/src/analysis/index.ts`

Barrel export:

```typescript
export * from "./similarity";
export * from "./clustering";
export * from "./validation";
export { extractJson } from "./json";
```

---

### Test Migration

Each source file has comprehensive tests. The test files should be copied alongside:

| Source Test | Destination Test |
|---|---|
| `convex/lib/similarity.test.ts` | `packages/core/src/analysis/similarity.test.ts` |
| `convex/analysis/convergence/clusterCandidates.test.ts` | `packages/core/src/analysis/clustering.test.ts` |
| `convex/analysis/convergence/validateCandidates.test.ts` | `packages/core/src/analysis/validation.test.ts` |

**Test changes needed:**
- Update import paths to relative (`./similarity`, `./clustering`, `./validation`)
- Remove tests for LLM-related functions that stay in Convex (e.g., `clusterCandidatesLLM` tests)
- The `CLUSTERING_SYSTEM_PROMPT` and `buildClusteringPrompt`/`parseClusteringResponse` tests DO move (they test pure functions)
- Import types from the core type system instead of convergence types

### Convex Bridge (thin re-export)

After extraction, the Convex code should import from `@basesignal/core`:

```typescript
// convex/lib/similarity.ts (becomes thin re-export)
export {
  tokenize,
  termFrequency,
  inverseDocumentFrequency,
  computeTfIdfVectors,
  cosineSimilarity,
  pairwiseSimilarity,
  type TfIdfVector,
} from "@basesignal/core";
```

```typescript
// convex/analysis/convergence/clusterCandidates.ts
// Keep only: internalAction wrapper + clusterCandidatesLLM
// Import pure functions from @basesignal/core
import {
  clusterCandidatesCore,
  UnionFind,
  buildCluster,
  parseClusteringResponse,
  CLUSTERING_SYSTEM_PROMPT,
  buildClusteringPrompt,
  DEFAULT_SIMILARITY_THRESHOLD,
} from "@basesignal/core";
```

```typescript
// convex/analysis/convergence/validateCandidates.ts
// Keep only: internalAction wrapper + LLM review functions
// Import pure functions from @basesignal/core
import {
  isFeatureAsValue,
  isVagueCandidate,
  isMarketingLanguage,
  findWithinLensDuplicates,
  hasUnverifiedFeatureRef,
  buildKnownFeaturesSet,
  runValidationPipeline,
} from "@basesignal/core";
```

**Important:** The Convex files do NOT get deleted. They become thin wrappers that re-export from `@basesignal/core` plus contain only the Convex-specific code (internalActions, LLM calls). This is additive, not destructive.

## Key Decisions

1. **Three modules, not one.** Similarity is math, clustering is algorithms, validation is pattern matching. Each has a distinct concern and different consumers may want only one.

2. **Include `extractJson` as a fourth micro-module.** It is a 3-line pure utility used by `parseClusteringResponse`. Rather than inlining it or adding a dependency on `lenses/shared`, extract it as `analysis/json.ts`.

3. **Include prompt constants and pure parsers.** `CLUSTERING_SYSTEM_PROMPT`, `buildClusteringPrompt`, and `parseClusteringResponse` are pure string operations. They are useful for any consumer that wants to do LLM clustering (like the MCP server) without importing Convex code. The Anthropic SDK call itself stays in Convex.

4. **Do NOT change function signatures.** The existing API works. The Convex code needs drop-in replacements. Signature improvements (if any) belong in a separate story.

5. **Keep Convex files as thin wrappers.** Do not delete the original files. Replace their implementations with re-exports from `@basesignal/core`. This ensures existing tests continue to work during the transition and Convex code paths remain intact.

6. **Type alignment with S002.** Types like `ValidatedCandidate`, `CandidateCluster`, `LensType`, and `LensResult` should come from the `@basesignal/core` type system extracted in S002. If S002 has not yet landed, define minimal interfaces locally and merge them when S002 lands. Do NOT duplicate the full type hierarchy.

## What This Does NOT Do

- **No LLM code extraction.** `clusterCandidatesLLM`, `applyLlmReview`, `parseLlmResponse`, and all Anthropic SDK-dependent code stays in Convex. Those belong in a future `@basesignal/ai` or similar package.
- **No Convex internalAction extraction.** The `clusterCandidates` and `validateCandidatesAction` wrappers stay in Convex.
- **No convergeAndTier extraction.** That function (from `convergeAndTier.ts`) has both pure functions (`assignTier`, `parseMergeResponse`, `directMerge`, `capTierDistribution`, `validateConvergenceQuality`) and LLM-dependent code. That is story S006's scope.
- **No new abstractions.** No Strategy pattern, no plugin system, no configuration objects. Just functions.
- **No signature changes.** If `isFeatureAsValue` takes `(name, description)` today, it takes `(name, description)` in the package.
- **No runtime validation library.** This story extracts functions, not schemas. Zod/ArkType validation is a separate concern (S003).

## Verification Steps

1. **Build check:** `cd packages/core && npx tsc --noEmit` passes with zero errors.
2. **Test parity:** `cd packages/core && npm test` runs all migrated tests. Every test that passed in the Convex location passes in the new location with identical assertions.
3. **Zero dependencies:** `packages/core/package.json` has zero `dependencies` (only `devDependencies` for build/test tooling).
4. **Import check:** `grep -r "from.*convex" packages/core/src/` returns zero results.
5. **Convex still works:** After updating Convex files to re-export from `@basesignal/core`, running `npm test` from the repo root shows all existing Convex tests still pass.
6. **Export verification:** The following imports resolve from `@basesignal/core`:
   ```typescript
   import { tokenize, cosineSimilarity, computeTfIdfVectors } from "@basesignal/core";
   import { UnionFind, clusterCandidatesCore } from "@basesignal/core";
   import { isFeatureAsValue, isVagueCandidate, runValidationPipeline } from "@basesignal/core";
   ```

## Success Criteria

- [ ] TF-IDF similarity functions (tokenize, termFrequency, idf, cosineSimilarity) are exported from packages/core
- [ ] Union-Find clustering algorithm is exported with same-lens constraint enforcement
- [ ] Deterministic validation checks (feature-as-value, vague language, marketing speak) are exported
- [ ] All existing tests from convex/lib/similarity.ts and convergence tests pass in new location
- [ ] Functions have zero external dependencies (pure TypeScript only)
- [ ] Convex files updated to import from @basesignal/core (no duplicated logic)
