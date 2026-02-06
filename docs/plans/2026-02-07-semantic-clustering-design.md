# Semantic Clustering of Candidates Design

## Overview

A clustering function groups validated candidates that describe the same underlying value moment across different analytical lenses. Uses local TF-IDF vectorization and cosine similarity with a union-find algorithm — no external API calls needed.

## Problem Statement

The 7-lens value discovery pipeline produces 60-100 validated candidates, many of which describe the same value moment from different perspectives. Before tiering and convergence scoring, we need to group these overlapping candidates into clusters so downstream analysis operates on distinct value moments rather than duplicate observations.

## Expert Perspectives

### Technical Architect
- Recommended avoiding new API dependencies (no OpenAI embeddings needed)
- Suggested O(n) semantic summary pass via Claude, but the simpler TF-IDF approach was chosen since short descriptions (10-30 words) don't benefit from deep semantic understanding
- Questioned whether perfect clustering matters — clustering quality should be driven by downstream use cases
- Key insight: the frame matters more than the algorithm. For this scale, simplicity wins.

### Simplification Reviewer
- **Verdict: APPROVED** — design is unified, scoped correctly, avoids over-engineering
- TF-IDF + cosine similarity is the right tool for short text descriptions
- Zero API calls, zero latency, zero cost, deterministic and reproducible
- O(n^3) worst-case in `canMerge` is fine for 60-100 candidates (~1ms)
- Nothing to remove — already minimal

## Proposed Solution

Local TF-IDF vectorization + cosine similarity + union-find with same-lens constraint. Three-step pipeline:

1. **Vectorize**: Extract descriptions from each `ValidatedCandidate`, compute TF-IDF sparse vectors via `computeTfIdfVectors`
2. **Compare and merge**: For each candidate pair, compute cosine similarity. If >0.7 and `canMerge` confirms no same-lens conflict, union the two candidates
3. **Collect clusters**: Group candidates by union-find root, emit each group as a `CandidateCluster` with full candidate objects for traceability

## Design Details

### Key Decisions

1. **TF-IDF over LLM embeddings** — Short candidate descriptions don't benefit from semantic depth of embeddings. TF-IDF captures lexical overlap which is sufficient for detecting same-value-moment descriptions across lenses. Eliminates API calls, latency, cost, and nondeterminism.

2. **Union-find for cluster formation** — Simplest correct algorithm for threshold-based transitive grouping. Naturally produces variable-sized clusters without pre-specifying k.

3. **Same-lens exclusion as hard constraint** — `canMerge` checks at merge time (not post-processing), guaranteeing the invariant always holds.

4. **Pure function extraction** — Core logic in `clusterCandidatesCore` (pure, no Convex deps). Convex `internalAction` is a thin wrapper. Enables direct unit testing.

5. **O(n^2) pairwise is acceptable** — For 60-100 candidates, runs in <1ms. No need for approximate nearest neighbors or LSH at this scale.

### Components

| Component | File | Role |
|-----------|------|------|
| `clusterCandidatesCore` | `convex/analysis/convergence/clusterCandidates.ts` | Pure function: ValidatedCandidate[] → CandidateCluster[] |
| `clusterCandidates` | `convex/analysis/convergence/clusterCandidates.ts` | Convex internalAction wrapper |
| `computeTfIdfVectors` | `convex/lib/similarity.ts` | Tokenizes text, computes TF-IDF sparse vectors |
| `cosineSimilarity` | `convex/lib/similarity.ts` | Cosine similarity between sparse vectors |
| `ValidatedCandidate` | `convex/analysis/convergence/types.ts` | Input type |
| `CandidateCluster` | `convex/analysis/convergence/types.ts` | Output type |
| Union-find helpers | `convex/analysis/convergence/clusterCandidates.ts` | `find`, `union`, `canMerge` |

### Performance Note

`canMerge` is O(n) per check, making clustering O(n^3) worst-case. For 60-100 candidates this is ~1ms. If future use cases require 1000+ candidates, consider maintaining per-group lens sets in the union-find (trade: adds mutable state, increases testing surface).

## Alternatives Considered

1. **OpenAI embeddings** — `text-embedding-3-small` would give better semantic similarity but adds a new API dependency, billing account, and nondeterminism. Overkill for short descriptions.
2. **Claude batch similarity judgments** — O(n^2) API calls even when batched. Expensive, slow, nondeterministic. Far more complex than needed.
3. **Claude semantic summary + local clustering** — One Claude call to normalize descriptions, then cluster locally. Reasonable but unnecessary when TF-IDF already works for the input characteristics.

## Success Criteria

- 60-100 validated candidates produce 15-30 clusters
- No same-lens candidates appear in the same cluster
- Single-lens candidates remain as singleton clusters
- Every cluster traces back to contributing candidate IDs
- Clustering completes in <100ms (actual: ~1ms)
