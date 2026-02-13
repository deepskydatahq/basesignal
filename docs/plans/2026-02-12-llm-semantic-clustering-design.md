# LLM-Based Semantic Clustering Design

## Overview

Replace TF-IDF cosine similarity clustering with LLM-based semantic clustering in the convergence pipeline. Add `clusterCandidatesLLM` to `clusterCandidates.ts` that sends validated candidates to Claude for semantic grouping, with TF-IDF as automatic fallback.

## Problem Statement

The current TF-IDF clustering uses surface-level text similarity (cosine similarity on term vectors) to group value moment candidates. This misses semantic relationships — candidates describing the same user value in different words end up in separate clusters. LLM-based clustering can understand meaning, producing more coherent value moment groupings.

## Expert Perspectives

### Technical
- Single-call approach is simplest: ~70 candidates fits comfortably in one Claude call (~2,050 input tokens, ~1,250 output tokens)
- Per-lens clustering + merge was considered (constraint-as-structure) but rejected: 7 LLM calls + merge logic adds code, latency, and failure modes for no benefit at this scale
- Post-hoc same-lens validation with repair (split violations into singletons) is pragmatic: 3 lines of code, rare path, prevents data loss
- Reuse Anthropic client already created in `runConvergencePipeline` for the merge step — just move creation earlier

### Simplification Review
- Design approved as minimal and inevitable
- Repair strategy justified: rare edge case, trivial code, more resilient than retry loops
- No hidden bloat — single-call architecture sidesteps per-lens coordination complexity

## Proposed Solution

Add four exports to `clusterCandidates.ts`:

1. **`CLUSTERING_SYSTEM_PROMPT`** — System prompt with explicit same-lens constraint, 15-30 cluster target, JSON-only output format
2. **`buildClusteringPrompt(candidates)`** — User prompt with compact one-line-per-candidate format
3. **`parseClusteringResponse(text, candidates)`** — Parse JSON, validate, repair same-lens violations, handle orphans
4. **`clusterCandidatesLLM(candidates, client)`** — Main function, returns `CandidateCluster[]`

Wire into `convergeAndTier.ts` with simple try/catch: LLM first, TF-IDF fallback on any error.

## Design Details

### Function: `clusterCandidatesLLM`

```typescript
export async function clusterCandidatesLLM(
  candidates: ValidatedCandidate[],
  client: Anthropic
): Promise<CandidateCluster[]>
```

- Uses Anthropic client directly (passed in from pipeline, same instance used for merge step)
- Uses `extractJson` from `../lenses/shared` for code fence / raw JSON parsing
- Model: `claude-sonnet-4-20250514`, temperature 0.2, maxTokens 4096
- Empty input returns `[]`

### Prompt Design

**System prompt:**
- Rule #1 (CRITICAL): No cluster may contain two candidates from the same lens type
- Target 15-30 clusters total
- Group by underlying user value, not surface wording
- Every candidate must appear in exactly one cluster
- Prefer larger cross-lens clusters over many singletons
- Return JSON array of `{ cluster_id, candidate_ids[] }`

**User prompt:** One candidate per line:
```
- id: {id} | lens: {lens} | name: {name} | description: {description}
```

### Response Parsing (`parseClusteringResponse`)

1. `extractJson` from shared.ts (handles code fences + raw JSON)
2. Validate array of `{ cluster_id: string, candidate_ids: string[] }`
3. Build id→candidate lookup map for O(1) resolution
4. Resolve candidate_ids to full ValidatedCandidate objects
5. **Same-lens repair**: If a cluster has two candidates from the same lens, split the second into a singleton cluster (repair, don't reject)
6. **Orphan check**: Unassigned candidates get their own singleton clusters (no data loss)
7. Use existing `buildCluster()` to construct final `CandidateCluster[]`

### Wiring in `runConvergencePipeline`

```typescript
// Move Anthropic client creation above clustering (already exists for merge step)
const client = new Anthropic({ apiKey });

// LLM clustering with TF-IDF fallback
let clusters: CandidateCluster[];
try {
  clusters = await clusterCandidatesLLM(active, client);
} catch (error) {
  console.warn("LLM clustering failed, falling back to TF-IDF:", error);
  clusters = clusterCandidatesCore(active, args.threshold ?? 0.7);
}
```

### Files Changed

| File | Change |
|------|--------|
| `convex/analysis/convergence/clusterCandidates.ts` | Add `CLUSTERING_SYSTEM_PROMPT`, `buildClusteringPrompt`, `parseClusteringResponse`, `clusterCandidatesLLM` |
| `convex/analysis/convergence/convergeAndTier.ts` | Move client creation earlier, LLM-first with TF-IDF fallback in `runConvergencePipeline`, add import |
| `convex/analysis/convergence/clusterCandidates.test.ts` | Tests for prompt building, response parsing, and LLM function |

### Test Plan

- `buildClusteringPrompt`: all candidate fields present in output
- `parseClusteringResponse`: valid JSON (fenced/raw), same-lens repair, orphan handling, invalid JSON error, empty clusters
- `clusterCandidatesLLM`: mock Anthropic client, output shape, empty input, error propagation

## Alternatives Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Single-call LLM clustering | Simple, one call, minimal code | Prompt engineering for constraint | **Chosen** |
| Per-lens clustering + merge | Constraint impossible to violate | 7 calls, merge logic, more failure modes | Rejected |
| Two-phase (themes → assign) | Separates concerns | Two calls, intermediate state, more complex | Rejected |
| Reject entire response on violation | Simpler validation | Retry loops or silent fallback to TF-IDF for fixable issues | Rejected — repair is simpler |

## Success Criteria

- LLM clustering produces coherent semantic groupings with no same-lens violations
- TF-IDF fallback activates cleanly on any LLM failure
- All candidates appear in output (no data loss via orphan handling)
- All existing convergence tests continue passing
- New tests cover parsing, validation, repair, and fallback paths
