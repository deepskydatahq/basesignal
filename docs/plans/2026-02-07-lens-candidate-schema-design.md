# Lens Candidate Schema and Types Design

## Overview

Define the common output structure for all 7 analytical lenses in the value discovery pipeline. A single types file (`convex/analysis/lenses/types.ts`) exports `LensType`, `ConfidenceLevel`, `LensCandidate`, and `LensResult`.

## Problem Statement

The 7-lens value discovery system needs a shared type definition so all lens extractors produce consistent output that the convergence pipeline can consume. Without shared types, each lens would define its own ad-hoc structure, making orchestration and validation harder.

## Expert Perspectives

### Technical
- **Flat optional fields over discriminated union.** LLM-generated data can't be trusted at the type level. Validation belongs in the validation pass, not the schema. A discriminated union provides false confidence for data parsed from LLM JSON output.
- **Staging format, not a contract.** `LensCandidate` is a staging structure between lens extraction and downstream validation. The `ValidatedCandidate` in convergence has a deliberately different shape (plural `roles`, `product_surfaces`).
- **Standalone types.** No cross-module imports between `lenses/types.ts` and `convergence/types.ts` — per architectural decision in value-moment-schema design.

### Simplification Review
- **Removed `AllLensesResult`** — not in acceptance criteria, belongs with the orchestrator story. Avoids scope creep.
- **Kept lens-specific optional fields** — AC3 explicitly requires them.
- **Kept `ConfidenceLevel` named type** — AC4 explicitly requires it.

## Proposed Solution

Single file: `convex/analysis/lenses/types.ts`

```typescript
export type LensType =
  | "capability_mapping"
  | "effort_elimination"
  | "info_asymmetry"
  | "decision_enablement"
  | "state_transitions"
  | "time_compression"
  | "artifact_creation";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface LensCandidate {
  id: string;
  lens: LensType;
  name: string;
  description: string;
  role: string;
  confidence: ConfidenceLevel;
  source_urls: string[];

  // Lens-specific fields (each lens populates its own)
  enabling_features?: string[];   // capability_mapping
  effort_eliminated?: string;     // effort_elimination
  information_gained?: string;    // info_asymmetry
  decision_enabled?: string;      // decision_enablement
  state_transition?: string;      // state_transitions
  time_compression?: string;      // time_compression
  artifact_type?: string;         // artifact_creation
}

export interface LensResult {
  lens: LensType;
  candidates: LensCandidate[];
  candidate_count: number;
  execution_time_ms: number;
}
```

## Design Details

### LensCandidate shared fields
- `id` — UUID assigned at parse time
- `lens` — which of the 7 lenses produced this candidate
- `name` — human-readable value moment name
- `description` — what this means for the user
- `role` — singular user role (lens-level); convergence maps to plural `roles`
- `confidence` — categorical: high (explicit evidence), medium (implied), low (inferred)
- `source_urls` — URLs from crawled pages supporting this candidate

### Lens-specific optional fields
Each lens populates one field. All are optional because the flat interface doesn't enforce per-lens requirements (that's the validation layer's job).

### LensResult
Wraps an array of candidates with metadata: which lens, how many candidates, how long it took. Used by the orchestrator to track per-lens execution.

## Alternatives Considered

1. **Discriminated union keyed on `lens`** — Would give per-lens type safety but adds branching logic everywhere. LLM output can't be trusted at the type level anyway. Rejected.
2. **Numeric confidence (0-1)** — Used in some downstream designs, but the batch lens prompts instruct LLMs to return categorical labels. Categorical is cleaner at the extraction layer; downstream can map to numeric if needed.
3. **Including `AllLensesResult`** — Useful for orchestration but not in the story's acceptance criteria. Removed to avoid scope creep; the orchestrator story can define it.

## Success Criteria

1. All 7 shared fields on `LensCandidate`
2. All 7 lens values in `LensType`
3. All 7 lens-specific optional fields
4. `ConfidenceLevel` with high/medium/low
5. `LensResult` wrapping candidates with metadata
6. All exports importable from `convex/analysis/lenses/types.ts`
