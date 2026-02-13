# Implementation Plan: ValueMomentsSection Component

**Task:** basesignal-7z9 — M005-E002-S002: Build ValueMomentsSection component
**Design doc:** `docs/plans/2026-02-11-value-moments-section-design.md`

## Overview

Build a pure presentational component that displays value moments grouped by tier (Core/Important/Supporting) with a stats bar and lens badges. Two files: a types re-export and the component itself.

## Prerequisites

- **Dependency:** basesignal-ohe (ProductProfilePage) — but ValueMomentsSection is standalone and can be built independently since it only receives `valueMoments: ValueMoment[]` as props.
- **Existing UI components:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` from `src/components/ui/card.tsx`, `Badge` from `src/components/ui/badge.tsx`
- **Backend types:** `ValueMoment`, `ValueMomentTier`, `LensType` from `convex/analysis/convergence/types.ts`

## Tasks

### Task 1: Create types re-export file

**File:** `src/components/product-profile/types.ts`

Create a one-liner that re-exports the three types needed by ValueMomentsSection from the backend convergence types:

```typescript
export type { LensType, ValueMomentTier, ValueMoment } from "../../../convex/analysis/convergence/types";
```

**Why:** Provides a clean import path for sibling components (ICP, Activation Map, Measurement Spec sections will add their own type re-exports later). Requested by task hints.

### Task 2: Write tests for ValueMomentsSection

**File:** `src/components/product-profile/ValueMomentsSection.test.tsx`

Write tests first (TDD), covering all 5 acceptance criteria:

**Test factory:**
```typescript
function makeValueMoment(overrides: Partial<ValueMoment> = {}): ValueMoment {
  return {
    id: "vm-1",
    name: "Test Moment",
    description: "A test value moment",
    tier: 1,
    lenses: ["jtbd", "outcomes"],
    lens_count: 2,
    roles: ["Admin", "User"],
    product_surfaces: ["Dashboard", "Settings"],
    contributing_candidates: ["c-1"],
    ...overrides,
  };
}
```

**Setup function:**
```typescript
function setup(valueMoments: ValueMoment[] = []) {
  render(<ValueMomentsSection valueMoments={valueMoments} />);
}
```

**5 tests:**

1. **Stats bar shows total moments and tier counts** — Pass 3 moments (one per tier). Assert "3 moments", "1 core", "1 important", "1 supporting" text visible.

2. **Moments grouped into tier sections** — Pass moments across tiers. Assert section headings "Core", "Important", "Supporting" present. Assert moment names appear.

3. **Moment card shows name, description, lens badges, roles, and product surfaces** — Pass a single moment with known data. Assert name, description, lens badges ("JTBD", "Outcomes"), roles ("Admin", "User"), product surfaces ("Dashboard", "Settings") all visible.

4. **Tier color coding** — Pass moments per tier. Assert tier section containers have the correct Tailwind classes (indigo for tier 1, amber for tier 2, gray for tier 3).

5. **Empty state renders when no value moments exist** — Pass empty array. Assert "No value moments yet" message. Assert no tier section headings rendered.

**Pattern:** Follows existing test conventions — `setup()` function, `getByRole`/`getByText` queries, no `beforeEach`, no Convex mocking needed (pure presentational component).

### Task 3: Build ValueMomentsSection component

**File:** `src/components/product-profile/ValueMomentsSection.tsx`

**Constants:**

- `TIER_CONFIG`: Maps `ValueMomentTier` (1/2/3) to `{ label, color, bg, border }` with indigo/amber/gray Tailwind classes
- `LENS_LABELS`: Maps `LensType` to display strings (jtbd → "JTBD", outcomes → "Outcomes", etc.)

**Internal subcomponents (not exported):**

1. `StatsBar({ total, tier1, tier2, tier3 })` — Horizontal bar with 4 stat pills showing total + per-tier counts
2. `TierSection({ tier, moments })` — Section heading with tier label + count, colored border/bg per TIER_CONFIG. Maps moments to MomentCard. Returns null if moments is empty.
3. `MomentCard({ moment })` — Uses Card/CardHeader/CardTitle/CardDescription/CardContent. Shows name, description, lens badges (Badge with outline variant), roles, product surfaces.
4. `EmptyState()` — Centered message: "No value moments yet."

**Main exported component:**

```typescript
export function ValueMomentsSection({ valueMoments }: { valueMoments: ValueMoment[] }) {
  if (valueMoments.length === 0) return <EmptyState />;

  const tier1 = valueMoments.filter(m => m.tier === 1);
  const tier2 = valueMoments.filter(m => m.tier === 2);
  const tier3 = valueMoments.filter(m => m.tier === 3);

  return (
    <div className="space-y-6">
      <StatsBar total={valueMoments.length} tier1={tier1.length} tier2={tier2.length} tier3={tier3.length} />
      <TierSection tier={1} moments={tier1} />
      <TierSection tier={2} moments={tier2} />
      <TierSection tier={3} moments={tier3} />
    </div>
  );
}
```

**Key decisions:**
- Pure presentational — no data fetching, no Convex hooks
- Internal subcomponents as named functions in same file (not exported)
- No expand/collapse, sorting, or filtering (YAGNI)
- Uses existing Card and Badge UI components

### Task 4: Run tests and verify

```bash
npm test -- --run ValueMomentsSection
npm run lint
```

Verify all 5 tests pass and no lint errors.

## Files Summary

### Files to Create
1. `src/components/product-profile/types.ts` (~1 line)
2. `src/components/product-profile/ValueMomentsSection.tsx` (~120 lines)
3. `src/components/product-profile/ValueMomentsSection.test.tsx` (~80 lines)

### Files to Modify
None.

## Testing Strategy

- **Type:** React component unit tests with RTL
- **Approach:** Pure presentational component — no Convex mocking needed. Just render with props and assert output.
- **Coverage:** All 5 acceptance criteria mapped to 5 tests
- **Command:** `npm test -- --run ValueMomentsSection`
