# Convergence & Tiering Design

## Overview

An LLM-assisted convergence function merges each candidate cluster into a single named value moment with tier assignment. Part of the M003 7-Lens Value Discovery pipeline (Story M003-E002-S004).

## Problem Statement

After clustering validates candidates across 7 analytical lenses, we need to merge each cluster into a coherent named "value moment" that combines insights from all contributing lenses, and assign tiers based on how many lenses converge.

## Expert Perspectives

### Product
- Trust upstream clustering (0.7 similarity threshold) — no split logic for V1
- Log warnings if LLM flags incoherent clusters, but always merge
- Ship and iterate: add split handling only if real data shows it's needed
- "Verb + outcome" naming is the key user-facing quality signal

### Technical
- Per-cluster LLM calls with Promise.allSettled — matches existing orchestrate.ts patterns
- Each cluster is a unit of work: merge it, tier it, store it
- Pure functions for testability (assignTier, parseMergeResponse)
- Fallback to directMerge on LLM failure to avoid data loss

### Simplification Review
- Removed tier-based merge branching: call LLM uniformly for all clusters, optimize later
- Removed `testRunConvergencePipeline` public action: premature API surface for unwired code
- Inlined `buildMergePrompt` and `dedupeStrings`: don't create abstractions for one-time use
- Kept `assignTier` and `parseMergeResponse` as pure functions (genuine testing value)

## Proposed Solution

A single file `convex/analysis/convergence/convergeAndTier.ts` containing:

1. **`convergeAndTier(clusters, client)`** — core async function that iterates clusters, calls LLM per cluster via `Promise.allSettled`, parses response, assigns tier, returns `ValueMoment[]`
2. **`assignTier(lensCount)`** — pure function mapping lens count to tier
3. **`parseMergeResponse(text)`** — pure function extracting JSON from LLM response
4. **`MERGE_SYSTEM_PROMPT`** — system prompt enforcing verb+outcome naming and lens insight combination
5. **`runConvergencePipeline` internalAction** — orchestration entry point chaining validate → cluster → converge

## Design Details

### Data Flow

```
CandidateCluster[] ──► convergeAndTier() ──► LLM per cluster (Promise.allSettled)
                                                    │
                                              parseMergeResponse()
                                                    │
                                              assignTier(lens_count)
                                                    │
                                              ValueMoment[]
```

### Core Function: `convergeAndTier`

```typescript
export async function convergeAndTier(
  clusters: CandidateCluster[],
  client: Anthropic
): Promise<ValueMoment[]> {
  const results = await Promise.allSettled(
    clusters.map(cluster => mergeClusterWithLLM(cluster, client))
  );

  const moments: ValueMoment[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      moments.push(result.value);
    } else {
      // Fallback: construct moment from cluster without LLM
      console.error(`LLM merge failed for cluster ${clusters[i].cluster_id}:`, result.reason);
      moments.push(directMerge(clusters[i]));
    }
  }
  return moments;
}
```

No tier-based branching — every cluster gets the same treatment. Optimize later if cost matters.

### Pure Functions

**`assignTier`** — deterministic tier mapping:
```typescript
export function assignTier(lens_count: number): ValueMomentTier {
  if (lens_count >= 5) return 1;
  if (lens_count >= 3) return 2;
  return 3;
}
```

**`parseMergeResponse`** — extracts JSON from code fences, validates required fields (name, description, roles, product_surfaces, is_coherent). Follows established `parseIdentityResponse` pattern.

**`directMerge`** — fallback-only function that constructs a ValueMoment from cluster data without LLM. Used when LLM fails, not as an optimization path.

### LLM Merge Prompt

System prompt instructs Claude to:
- Name MUST start with a verb: "Gain...", "Reduce...", "Accelerate..."
- Description combines insights from ALL contributing lenses (1-3 sentences)
- Return `is_coherent: boolean` flag (logged as warning if false, merged anyway)
- Return JSON in code fences

User message: inline template listing each candidate with lens type, name, role, and description.

Model: `claude-sonnet-4-20250514` (matches orchestrate.ts pattern, merge quality needs judgment).

### `runConvergencePipeline` internalAction

Orchestrates the full pipeline:
1. Validate candidates (from S002)
2. Cluster candidates (from S003)
3. Converge and tier (this story)
4. Store result on product profile via `updateSectionInternal`

### No `testRunConvergencePipeline`

The test action was cut — it's premature to expose a public API surface for code not yet wired to real upstream data (S002/S003). Integration testing happens when the full pipeline is connected.

## Test Plan

**Unit tests** (`convergeAndTier.test.ts`):

| Test | Covers |
|------|--------|
| `assignTier(5)` → 1, `assignTier(7)` → 1 | AC4 |
| `assignTier(3)` → 2, `assignTier(4)` → 2 | AC5 |
| `assignTier(1)` → 3, `assignTier(2)` → 3 | AC6 |
| `parseMergeResponse` handles valid JSON | AC3 |
| `parseMergeResponse` extracts from code fences | AC3 |
| `parseMergeResponse` throws on missing fields | robustness |
| `convergeAndTier` returns ValueMoment[] from CandidateCluster[] (mocked client) | AC1 |
| `convergeAndTier` calls LLM per cluster (mocked) | AC2 |
| `convergeAndTier` falls back to directMerge on LLM failure | robustness |
| Each moment has contributing_candidates | AC10 |
| Merged descriptions reference contributing lenses | AC9 |

**Integration tests** (AC7, AC8): validated manually when full pipeline (S002+S003+S004) is wired. Expected: 4-6 Tier 1 moments, 15-30 total for Linear.

## Alternatives Considered

1. **Batch all clusters in one LLM call** — rejected: large prompt, single point of failure, harder to parse
2. **Tier-based branching (skip LLM for Tier 3)** — rejected by reviewer as premature optimization; ship uniform approach first
3. **Split logic (LLM suggests splitting clusters)** — deferred: adds complexity for unvalidated need; log warnings instead

## Success Criteria

- All unit tests pass
- `convergeAndTier` correctly transforms `CandidateCluster[]` → `ValueMoment[]`
- Value moment names follow verb+outcome format
- Tier assignment is deterministic: 5+=T1, 3-4=T2, 1-2=T3
- Contributing candidates preserved for traceability
- LLM failures don't crash pipeline (fallback to directMerge)
