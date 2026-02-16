# Implementation Plan: Post-Convergence Quality Validation

**Task:** basesignal-90j (M006-E001-S003)
**Design:** docs/plans/2026-02-12-convergence-quality-validation-design.md
**Depends on:** basesignal-btg (tier assignment refinement) — must land first

---

## Step 1: Add quality types to `convex/analysis/convergence/types.ts`

Add after the `ConvergenceResult` interface (line 57):

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

Add optional `quality` field to `ConvergenceResult`:

```typescript
export interface ConvergenceResult {
  value_moments: ValueMoment[];
  clusters: CandidateCluster[];
  stats: { ... };
  quality?: QualityReport;  // <-- add this
}
```

---

## Step 2: Implement `validateConvergenceQuality` in `convex/analysis/convergence/convergeAndTier.ts`

Add a new exported pure function after the existing pure functions section (~line 87, before `// --- LLM merge ---`).

Import `QualityStatus`, `QualityCheck`, `QualityReport` from `./types`.

**Function signature:**
```typescript
export function validateConvergenceQuality(result: ConvergenceResult): QualityReport
```

**3 checks, all inline:**

1. **`tier_distribution`** — Count T1/T2/T3 from `result.value_moments`. Apply:
   - T1: 0 → fail; 1-5 → pass; 6+ → warn
   - T2: <2 → warn; 2-10 → pass; >10 → warn
   - T3: <=20 → pass; >20 → warn
   - Status = worst of three sub-checks
   - Message: `"T1: {n}, T2: {n}, T3: {n}"`

2. **`total_count`** — `result.value_moments.length`:
   - 10-35 → pass; outside → fail
   - Message: `"Total moments: {n} (expected 10-35)"`

3. **`empty_fields`** — Check `result.value_moments` for any with empty `.name` or `.description`:
   - 0 empty → pass; any → warn
   - Message: `"{n} moments with empty name or description"` or `"All moments have names and descriptions"`

**Overall** = worst status across checks (fail > warn > pass). Inline comparison, no helper.

---

## Step 3: Wire into `runConvergencePipeline`

In `convergeAndTier.ts`, after building `result` (after line 226, before storing):

```typescript
try {
  result.quality = validateConvergenceQuality(result);
} catch (e) {
  console.warn("Quality validation failed, skipping:", e);
}
```

Update the log line (line 237) to include quality status:

```typescript
console.log(
  `Convergence pipeline complete: ${result.stats.total_moments} moments ` +
    `(T1: ${result.stats.tier_1_count}, T2: ${result.stats.tier_2_count}, T3: ${result.stats.tier_3_count}) ` +
    `quality: ${result.quality?.overall ?? "unknown"} ` +
    `in ${executionTimeMs}ms`
);
```

---

## Step 4: Add tests to `convex/analysis/convergence/convergeAndTier.test.ts`

Add `validateConvergenceQuality` to the import.

Add a `makeConvergenceResult` helper:

```typescript
function makeConvergenceResult(
  moments: Array<Partial<ValueMoment> & { tier: ValueMomentTier }>
): ConvergenceResult {
  const valueMoments = moments.map((m, i) => ({
    id: m.id ?? `moment-${i}`,
    name: m.name ?? `Gain value ${i}`,
    description: m.description ?? `Description ${i}`,
    tier: m.tier,
    lenses: m.lenses ?? ["jtbd" as LensType],
    lens_count: m.lens_count ?? 1,
    roles: m.roles ?? [],
    product_surfaces: m.product_surfaces ?? [],
    contributing_candidates: m.contributing_candidates ?? [],
  }));
  return {
    value_moments: valueMoments,
    clusters: [],
    stats: {
      total_candidates: valueMoments.length,
      total_clusters: valueMoments.length,
      total_moments: valueMoments.length,
      tier_1_count: valueMoments.filter((m) => m.tier === 1).length,
      tier_2_count: valueMoments.filter((m) => m.tier === 2).length,
      tier_3_count: valueMoments.filter((m) => m.tier === 3).length,
    },
  };
}
```

**~9 test cases in a `describe("validateConvergenceQuality", ...)` block:**

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | All pass — healthy distribution | T1=3, T2=5, T3=7 (total 15) | overall: pass, all checks pass |
| 2 | T1=0 → tier_distribution fail | T2=5, T3=10 (total 15, no T1) | tier_distribution: fail, overall: fail |
| 3 | T1=6 → tier_distribution warn | T1=6, T2=5, T3=7 (total 18) | tier_distribution: warn |
| 4 | T2<2 → tier_distribution warn | T1=3, T2=1, T3=7 (total 11) | tier_distribution: warn |
| 5 | T3>20 → tier_distribution warn | T1=3, T2=5, T3=21 (total 29) | tier_distribution: warn |
| 6 | Total <10 → total_count fail | T1=2, T2=3, T3=3 (total 8) | total_count: fail, overall: fail |
| 7 | Total >35 → total_count fail | T1=5, T2=10, T3=21 (total 36) | total_count: fail |
| 8 | Empty name → empty_fields warn | One moment with name="" | empty_fields: warn |
| 9 | Overall = worst status | Mix of pass + warn checks | overall: warn |

---

## Files Modified

| File | Change |
|------|--------|
| `convex/analysis/convergence/types.ts` | Add `QualityStatus`, `QualityCheck`, `QualityReport` types; add `quality?` to `ConvergenceResult` |
| `convex/analysis/convergence/convergeAndTier.ts` | Add `validateConvergenceQuality` function; wire into pipeline; update log line |
| `convex/analysis/convergence/convergeAndTier.test.ts` | Add `makeConvergenceResult` helper; add ~9 test cases |

No new files. No schema changes. No UI changes.

---

## Verification

```bash
npm run test:run -- convex/analysis/convergence/convergeAndTier.test.ts
```

All existing tests must continue to pass (backward compatible — `quality` is optional on `ConvergenceResult`).
