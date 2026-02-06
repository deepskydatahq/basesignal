# Validate H6: 7-Lens Comparison Design

## Overview

A single monolithic script (`scripts/validate-h6.mjs`) validates whether 7 analytical lenses + convergence produces accurate value moments for Linear. Compared against a human-authored reference (`docs/reference/linear-value-moments.md`). No Convex infrastructure changes -- throwaway validation script.

## Problem Statement

H6 hypothesizes that multi-lens analysis produces more complete value discovery than single-lens approaches. Before building the full pipeline (E001/E002), we validate cheaply: run 7 lenses via Claude API directly, converge in-memory, compare Tier 1 moments against a reference, and check if 70%+ are accurate.

## Expert Perspectives

### Product
- Validate hypothesis cheaply before investing in Convex infrastructure
- Building E001/E002 first is solving the wrong problem at the wrong time
- If H6 fails, we save enormous infrastructure investment; if it succeeds, we build with conviction

### Technical
- Single monolithic script + separate reference doc (composes S001 requirement)
- Simple string similarity for convergence, not LLM clustering -- keep it transparent and debuggable
- Start monolithic, extract later if H6 validates and we build E001/E002

### Simplification Review
- No new Convex queries -- use existing `listByProductInternal` pattern via a test action, or add minimal `listByProductForTest` query
- Run lenses in parallel (Promise.allSettled) instead of sequential -- faster for throwaway validation
- Script outputs validation report as human-reviewable tool, not automated judgment -- all criteria are [manual]

## Proposed Solution

### Files Created

| File | Purpose |
|------|---------|
| `docs/reference/linear-value-moments.md` | Human-authored reference baseline (satisfies S001) |
| `scripts/validate-h6.mjs` | Monolithic validation script |
| `docs/plans/M003-validation-results.md` | Generated output: validation report |

### Codebase Change

Add `listByProductForTest` query to `convex/crawledPages.ts` (follows existing `productProfiles.getForTest` pattern at line 201). One query, no schema changes.

### Script Pipeline (7 steps in one file)

```
1. Load data     → Fetch crawled pages + profile from Convex
2. Run 7 lenses  → Parallel Claude calls (Promise.allSettled), 7 lens prompts inline
3. Validate      → Filter feature-as-value, vague, duplicates (simple heuristics)
4. Cluster       → Jaccard word similarity (threshold ~0.35), same-lens constraint
5. Tier          → 5+ lenses = T1, 3-4 = T2, 1-2 = T3
6. Compare       → Match T1 moments against reference doc, rate each
7. Report        → Write docs/plans/M003-validation-results.md
```

### The 7 Lenses

**Batch 1 (independent, parallel):**
1. Capability Mapping -- what can users DO?
2. Effort Elimination -- what manual work is eliminated?
6. Time Compression -- what becomes faster?
7. Artifact Creation -- what outputs do users produce?

**Batch 2 (uses Batch 1 context, parallel among themselves):**
3. Information Asymmetry -- what do users learn they couldn't know before?
4. Decision Enablement -- what decisions become possible?
5. State Transitions -- what user states change?

### Convergence

Jaccard similarity on tokenized (name + description). Greedy single-linkage clustering. Same-lens constraint prevents merging candidates from the same lens. Transparent and debuggable -- all similarity scores printed for human override.

### Comparison Rating

For each Tier 1 moment, find best-matching reference moment. Print similarity score. Human reviewer makes final rating call (accurate / mostly accurate / inaccurate). Script provides a suggested first-pass rating as a starting point.

### HYPOTHESES.md Update

Script does NOT auto-update. Report includes instructions for human to update H6 status based on their judgment.

## Alternatives Considered

1. **Build full E001/E002 pipeline first** -- Rejected. Validates too slowly, wastes effort if H6 fails.
2. **Modular script directory** -- Rejected. Over-engineering for throwaway validation.
3. **LLM-based clustering** -- Rejected. Adds cost, latency, and opaqueness. Jaccard is transparent.
4. **Embedding-based similarity** -- Considered but adds API dependency. Jaccard is sufficient for this validation.

## Success Criteria

- Script runs in ~2-3 minutes
- Produces 60-140 total candidates across 7 lenses
- Produces 4-8 Tier 1 moments
- 70%+ of Tier 1 moments rated accurate or mostly accurate = H6 validated
- Report documents per-lens performance for refinement learnings
