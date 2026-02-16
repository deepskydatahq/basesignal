# Post-Convergence Quality Validation Design

## Overview
Add a pure `validateConvergenceQuality` function to `convergeAndTier.ts` that checks tier distribution, total count, and empty fields after convergence. Returns a `QualityReport` attached to the `ConvergenceResult` before storage. Non-blocking — never prevents convergence from completing.

## Problem Statement
The convergence pipeline produces tiered value moments but has no way to flag when the output quality is poor (wrong tier distribution, too few/many moments, missing data). A post-hoc quality check gives visibility into output health without blocking the pipeline.

## Expert Perspectives

### Technical
- Keep the validator in `convergeAndTier.ts` alongside other pure functions (matches existing pattern where `assignTier`, `parseMergeResponse`, `directMerge` all live together).
- Pure function: takes `ConvergenceResult`, returns `QualityReport`. No mutations, no side effects.
- Validate before capping (S002 dependency), not after. The quality validator checks whether the tier assignment logic is working correctly. Capping is a separate constraint enforcement layer — validating post-cap would produce noise by flagging outputs the pipeline intentionally adjusted.
- Use AC thresholds as-is (not tighter than cap thresholds). T1: 1-5, T2: 2-10, T3: <=20.
- Optional `quality` field on `ConvergenceResult` preserves backward compatibility and makes non-blocking nature explicit at the type level.

### Product
- Non-blocking validation gives visibility into output health without risking pipeline failures.
- Quality report stored alongside convergence data enables future UI surfacing of quality signals.

### Simplification Review
- Merged 3 separate tier checks (T1, T2, T3) into a single `tier_distribution` check — reduces granularity without losing information.
- Reduced from 5 checks to 3: `tier_distribution`, `total_count`, `empty_fields`.
- Inline all check logic directly in `validateConvergenceQuality` — no separate helper functions. The checks are simple conditional blocks, not reusable abstractions.
- Inline `worstStatus` logic (fail > warn > pass) — too trivial for its own function.
- Thresholds inline with comment block citing the source (M006-E001 AC).

## Proposed Solution

### Types (in `types.ts`)

```typescript
export type QualityStatus = "pass" | "warn" | "fail";

export interface QualityCheck {
  name: string;
  status: QualityStatus;
  message: string;
}

export interface QualityReport {
  overall: QualityStatus;
  checks: QualityCheck[];
}
```

Add to `ConvergenceResult`:
```typescript
quality?: QualityReport;
```

### Validation Function (in `convergeAndTier.ts`)

`validateConvergenceQuality(result: ConvergenceResult): QualityReport`

Single exported pure function with all logic inline (~40 lines of straightforward conditionals).

**3 checks:**

1. **`tier_distribution`** — Single check covering all tiers. Thresholds from AC:
   - T1: 1-5 pass, 0 fail, 6+ warn
   - T2: 2-10 pass, <2 warn, >10 warn
   - T3: <=20 pass, >20 warn
   - Status = worst of three sub-checks. Message includes all counts.

2. **`total_count`** — 10-35 pass, outside fail.

3. **`empty_fields`** — Any empty name or description = warn. None = pass.

**Overall** = worst status across all checks (fail > warn > pass).

### Pipeline Integration (in `runConvergencePipeline`)

3 lines after building the result, before storing:
```typescript
try {
  result.quality = validateConvergenceQuality(result);
} catch (e) {
  console.warn("Quality validation failed, skipping:", e);
}
```

Update log line to include quality status.

### Tests (in `convergeAndTier.test.ts`)

~8 test cases with a `makeConvergenceResult` helper:
1. All pass — healthy distribution (t1=3, t2=5, t3=7)
2. T1=0 → tier_distribution fail
3. T1=6 → tier_distribution warn
4. T2 out of range → tier_distribution warn
5. T3>20 → tier_distribution warn
6. Total <10 → total_count fail
7. Total >35 → total_count fail
8. Empty name/description → empty_fields warn
9. Overall = worst status across checks

## Alternatives Considered
- **Separate file (`qualityValidation.ts`)** — Rejected. The function is tightly coupled to convergence types and the pipeline. Separate file adds cognitive overhead without meaningful isolation.
- **Separate storage/section** — Rejected. Single write with quality attached to the result is simpler and preserves transactional clarity.
- **Per-tier individual checks (5 checks)** — Rejected by simplification review. Merged into 3 checks. Same info, less noise.
- **Separate helper functions per check** — Rejected by simplification review. Inline the checks directly — they're simple conditional blocks, not reusable abstractions.
- **Validate after capping** — Rejected by technical architect. Quality validator should check whether tier assignment logic is working, not whether capping normalized the output.

## Success Criteria
- `validateConvergenceQuality` returns correct status for all threshold boundaries
- Quality report attached to stored convergence result
- Pipeline never fails due to quality validation
- All ~8 test cases pass
