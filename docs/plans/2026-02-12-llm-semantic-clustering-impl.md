# Implementation Plan: LLM-Based Semantic Clustering

**Task:** basesignal-167 (M006-E001-S001)
**Design:** docs/plans/2026-02-12-llm-semantic-clustering-design.md

## Context

Replace TF-IDF cosine similarity clustering with LLM-based semantic clustering in the convergence pipeline. The current `clusterCandidatesCore` uses surface-level text similarity, missing semantic relationships. LLM clustering understands meaning, producing more coherent value moment groupings.

## Approach

Add four exports to `clusterCandidates.ts`, wire into `convergeAndTier.ts` with LLM-first + TF-IDF fallback. No changes to `types.ts`.

## Implementation Steps

### Step 1: Add `CLUSTERING_SYSTEM_PROMPT` to `clusterCandidates.ts`

Add after the existing `buildCluster` function (before `clusterCandidatesCore`):

```typescript
export const CLUSTERING_SYSTEM_PROMPT = `You are a product analyst grouping value moment candidates into semantic clusters.

RULES:
1. CRITICAL: No cluster may contain two candidates from the same lens type
2. Target 15-30 clusters total
3. Group by underlying user value, not surface wording
4. Every candidate must appear in exactly one cluster
5. Prefer larger cross-lens clusters over many singletons

Return ONLY a JSON array:
[
  { "cluster_id": "cluster-0", "candidate_ids": ["id1", "id2"] },
  { "cluster_id": "cluster-1", "candidate_ids": ["id3"] }
]

No commentary, just the JSON array.`;
```

### Step 2: Add `buildClusteringPrompt` to `clusterCandidates.ts`

```typescript
export function buildClusteringPrompt(candidates: ValidatedCandidate[]): string {
  const lines = candidates.map(
    (c) => `- id: ${c.id} | lens: ${c.lens} | name: ${c.name} | description: ${c.description}`
  );
  return `Group these ${candidates.length} candidates into semantic clusters:\n\n${lines.join("\n")}`;
}
```

### Step 3: Add `parseClusteringResponse` to `clusterCandidates.ts`

Add import at top: `import { extractJson } from "../lenses/shared";`

```typescript
export function parseClusteringResponse(
  text: string,
  candidates: ValidatedCandidate[]
): CandidateCluster[] {
  const parsed = extractJson(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of clusters");
  }

  // Build id→candidate lookup
  const lookup = new Map(candidates.map((c) => [c.id, c]));

  // Track assigned candidates to find orphans
  const assigned = new Set<string>();
  const clusters: CandidateCluster[] = [];
  let clusterIndex = 0;

  for (const raw of parsed) {
    const ids: string[] = Array.isArray(raw.candidate_ids) ? raw.candidate_ids : [];
    const resolved: ValidatedCandidate[] = [];
    const seenLenses = new Set<LensType>();

    for (const id of ids) {
      const candidate = lookup.get(id);
      if (!candidate) continue; // skip unknown ids
      if (assigned.has(id)) continue; // skip already-assigned

      if (seenLenses.has(candidate.lens)) {
        // Same-lens violation: split into singleton
        clusters.push(buildCluster(`cluster-${clusterIndex++}`, [candidate]));
        assigned.add(id);
        continue;
      }

      seenLenses.add(candidate.lens);
      resolved.push(candidate);
      assigned.add(id);
    }

    if (resolved.length > 0) {
      clusters.push(buildCluster(`cluster-${clusterIndex++}`, resolved));
    }
  }

  // Orphan check: unassigned candidates get singleton clusters
  for (const candidate of candidates) {
    if (!assigned.has(candidate.id)) {
      clusters.push(buildCluster(`cluster-${clusterIndex++}`, [candidate]));
    }
  }

  return clusters;
}
```

### Step 4: Add `clusterCandidatesLLM` to `clusterCandidates.ts`

Add import at top: `import Anthropic from "@anthropic-ai/sdk";`

```typescript
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

### Step 5: Wire into `convergeAndTier.ts`

In `runConvergencePipeline` handler, change the clustering section:

**Before (lines 200-204):**
```typescript
const active = candidates.filter((c) => c.validation_status !== "removed");
const clusters = clusterCandidatesCore(active, args.threshold ?? 0.7);

// 2. Converge and tier via LLM
const apiKey = process.env.ANTHROPIC_API_KEY;
```

**After:**
```typescript
const active = candidates.filter((c) => c.validation_status !== "removed");

// 2. Create Anthropic client (used by both clustering and merge steps)
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY environment variable is not set");
}
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

Remove the duplicate `apiKey` check and `client` creation that was at lines 207-211. The `client` variable is already created above and can be passed directly to `convergeAndTier(clusters, client)`.

**Add import** at top of `convergeAndTier.ts`:
```typescript
import { clusterCandidatesCore, clusterCandidatesLLM } from "./clusterCandidates";
```
(Replace existing `import { clusterCandidatesCore } from "./clusterCandidates";`)

## Test Plan

Add tests to `clusterCandidates.test.ts` in a new describe block. All tests use pure functions with no mocks needed except `clusterCandidatesLLM`.

### `buildClusteringPrompt` tests

1. **All fields present**: Each candidate's id, lens, name, description appear in output
2. **Candidate count in header**: Output contains "Group these N candidates"

### `parseClusteringResponse` tests

3. **Valid JSON in code fences**: Parse `\`\`\`json [...] \`\`\`` correctly
4. **Valid raw JSON**: Parse without code fences
5. **Same-lens repair**: Cluster with two same-lens candidates → second becomes singleton
6. **Orphan handling**: Candidate not in any cluster gets singleton cluster
7. **Unknown IDs ignored**: IDs not in candidates list are skipped
8. **No cluster has duplicate lenses**: Invariant holds across all parsed output
9. **All input candidates present in output**: No data loss
10. **Invalid JSON throws**: Non-JSON text propagates error
11. **Empty clusters skipped**: Cluster with only unknown IDs doesn't produce empty cluster
12. **Non-array response throws**: Object instead of array throws

### `clusterCandidatesLLM` tests

13. **Empty input returns []**: No API call made
14. **Calls Anthropic with correct params**: Model, temperature, system prompt verified
15. **Returns CandidateCluster[]**: Output shape matches type

### Test fixture candidates

Reuse the existing `makeCandidate` helper already in the test file.

## Files Changed

| File | Change |
|------|--------|
| `convex/analysis/convergence/clusterCandidates.ts` | Add imports (`extractJson`, `Anthropic`), add 4 exports: `CLUSTERING_SYSTEM_PROMPT`, `buildClusteringPrompt`, `parseClusteringResponse`, `clusterCandidatesLLM` |
| `convex/analysis/convergence/convergeAndTier.ts` | Move `client` creation above clustering, add try/catch LLM-first with TF-IDF fallback, update import to include `clusterCandidatesLLM` |
| `convex/analysis/convergence/clusterCandidates.test.ts` | Add ~15 tests for prompt building, response parsing (valid/repair/orphans/errors), and LLM function |

## Risks

1. **LLM output format**: Claude may not always return perfect JSON arrays. Mitigated by `extractJson` handling code fences and the TF-IDF fallback.
2. **Same-lens violations**: LLM may ignore the constraint. Mitigated by post-hoc repair in `parseClusteringResponse`.
3. **Latency**: One extra LLM call added to pipeline. At ~70 candidates this is a small payload, ~2-3s added latency is acceptable.
4. **Cost**: One additional Sonnet call per convergence run. Negligible at current usage levels.

## Order of Implementation

1. Add `CLUSTERING_SYSTEM_PROMPT` and `buildClusteringPrompt` (pure, no dependencies)
2. Add `parseClusteringResponse` (depends on `extractJson` import and `buildCluster`)
3. Add `clusterCandidatesLLM` (depends on all above)
4. Write tests for steps 1-3
5. Wire into `convergeAndTier.ts`
6. Run full test suite to verify no regressions
