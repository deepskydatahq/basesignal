# Implementation Plan: Experiential Convergence Prompts

**Task:** basesignal-9fn — M007-E002-S001: Rewrite merge and clustering prompts for experiential framing
**Design:** docs/plans/2026-02-12-experiential-convergence-prompts-design.md

## Summary

Replace two prompt constants (`MERGE_SYSTEM_PROMPT` and `CLUSTERING_SYSTEM_PROMPT`) with experiential framing. Prompt-only changes — no schema, type, or structural changes.

## Steps

### Step 1: Replace MERGE_SYSTEM_PROMPT

**File:** `convex/analysis/convergence/convergeAndTier.ts` (lines 219-245)

Replace the entire `MERGE_SYSTEM_PROMPT` constant with new text that:

1. Changes verb examples from business verbs (Gain, Reduce, Accelerate, Eliminate, Enable) to user-action verbs (Create, Share, Export, Build, View, Comment, Configure, Drag)
2. Adds core instruction: "Describe what happens on the user's screen, not what the business achieves"
3. Changes name format guidance to: "Verb + what the user does" (flexible, not rigid template)
4. Adds 2 good/bad example pairs:
   - BAD: "Gain visibility into project progress" → GOOD: "View project status on the overview dashboard"
   - BAD: "Accelerate team alignment" → GOOD: "Comment on shared goals in the team workspace"
5. Preserves all structural rules: capitalized first letter, JSON output with `name`, `description`, `roles`, `product_surfaces`, `is_coherent`
6. Preserves "Return ONLY the JSON, no commentary"

### Step 2: Replace CLUSTERING_SYSTEM_PROMPT

**File:** `convex/analysis/convergence/clusterCandidates.ts` (lines 195-221)

Replace the entire `CLUSTERING_SYSTEM_PROMPT` constant with new text that:

1. Changes grouping criterion from "SAME underlying value moment" to "SAME in-product experience"
2. Updates Rule 4 from "Group by semantic meaning" to "Group by shared user experience"
3. Changes example labels to user-action style: "Drag cards across columns", "View team activity feed", "Export filtered data"
4. **Must preserve verbatim** (tests assert these exact strings):
   - `"NEVER place two candidates from the SAME lens"` — asserted in `clusterCandidates.test.ts:464`
   - `"15-30 clusters"` — asserted in `clusterCandidates.test.ts:468`
5. Preserves JSON output format with `label` + `candidate_ids`
6. Preserves "Return ONLY the JSON array, no commentary"

### Step 3: Run tests

Run `npm test` and verify all existing convergence tests pass:
- `convergeAndTier.test.ts` — all tests use mock LLM responses with hardcoded names, so prompt text changes don't affect them
- `clusterCandidates.test.ts` — two prompt content assertions (same-lens rule, cluster target) preserved verbatim

## Test Compatibility Analysis

| Test | Why It Still Passes |
|------|-------------------|
| `parseMergeResponse` tests | Validates capital first letter — user-action verbs are capitalized |
| `convergeAndTier` tests | All use mock clients with hardcoded responses — prompt text irrelevant |
| `directMerge` tests | Pure function, no prompt dependency |
| `CLUSTERING_SYSTEM_PROMPT` content assertions | "NEVER place two candidates from the SAME lens" and "15-30 clusters" preserved verbatim |
| `parseClusteringResponse` tests | Pure function, no prompt dependency |
| `clusterCandidatesCore` TF-IDF tests | No LLM involvement |

## Files Modified

| File | Change |
|------|--------|
| `convex/analysis/convergence/convergeAndTier.ts` | Replace `MERGE_SYSTEM_PROMPT` constant (~lines 219-245) |
| `convex/analysis/convergence/clusterCandidates.ts` | Replace `CLUSTERING_SYSTEM_PROMPT` constant (~lines 195-221) |

## Files NOT Modified

- No test files
- No types
- No schema
- No parsing logic
