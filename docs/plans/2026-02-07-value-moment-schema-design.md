# Value Moment Schema and Types Design

## Overview

Define the TypeScript types for the convergence pipeline output: validated candidates, value moments, and convergence results. These types live in `convex/analysis/convergence/types.ts`.

## Problem Statement

The convergence pipeline needs a well-defined output schema. Story M003-E002-S001 specifies types for `ValueMoment`, `ValidatedCandidate`, `ConvergenceResult`, and supporting types. The file already exists with all required types.

## Expert Perspectives

### Technical

The initial question was whether `ValidatedCandidate` should extend `LensCandidate` (from a not-yet-created `lenses/types.ts`). The technical architect recommended creating a minimal `lenses/types.ts` as a shared type contract between the lens pipeline (E001) and convergence pipeline (E002).

### Simplification Review

The reviewer **rejected** the cross-module import approach. Key reasoning:

- `ValidatedCandidate` is a convergence-level concept, not a lens artifact
- The `role` (singular, lens-level) vs `roles` (plural, convergence-level) difference proves these aren't the same shape
- Importing from `lenses/types.ts` creates false architectural coupling — convergence depends on validation *data*, not lens *types*
- The current standalone definition is already correct and minimal

**Verdict: Keep types standalone. No cross-module imports.**

## Proposed Solution

The existing `convex/analysis/convergence/types.ts` already satisfies all acceptance criteria:

| AC | Status | Notes |
|----|--------|-------|
| 1. `ValueMomentTier` includes 1, 2, 3 | Met | `type ValueMomentTier = 1 \| 2 \| 3` |
| 2. `ValueMoment` defines all fields | Met | All 9 fields present |
| 3. `ConvergenceResult` wraps with metadata | Met | Includes tier counts, timing, validation stats |
| 4. `ValidatedCandidate` with `validation_status` | Met | Standalone interface with all needed fields |
| 5. `ValidationStatus` includes valid, rewritten, removed | Met | `type ValidationStatus = "valid" \| "rewritten" \| "removed"` |
| 6. Exports importable from convergence/types.ts | Met | All types exported |

**AC4 divergence note:** The spec says "extends LensCandidate" but the review determined this creates harmful coupling. The fields are structurally present. When `lenses/types.ts` is created by its own story (M003-E001-S001), the two types can coexist without an import relationship. The convergence pipeline receives validated data, not raw lens output.

## Design Details

No code changes needed. The file has:

- `ValueMomentTier` — tier levels 1, 2, 3
- `ValidationStatus` — valid, rewritten, removed
- `ValidatedCandidate` — standalone with lens origin, validation metadata, and convergence fields
- `CandidateCluster` — intermediate clustering output (bonus, used by S003)
- `ValueMoment` — final converged value moment with tier, lenses, roles, surfaces
- `ConvergenceResult` — pipeline output wrapper with counts and timing

## Alternatives Considered

**Extend LensCandidate via shared types file** — Rejected by simplification review. Creates false coupling between convergence and lens modules. The singular `role` vs plural `roles` difference confirms these are different domain concepts.

## Success Criteria

- All 6 types are exported from `convex/analysis/convergence/types.ts`
- Existing consumers (`clusterCandidates.ts`, tests) continue to work unchanged
- No cross-module type dependencies introduced
