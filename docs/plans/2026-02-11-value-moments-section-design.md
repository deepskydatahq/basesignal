# ValueMomentsSection Component Design

## Overview
A presentational React component that displays value moments from convergence results, grouped by tier (Core, Important, Supporting) with a stats bar and lens badges.

## Problem Statement
The Product Profile View (M005) needs to display value moments in a read-only, scannable format. Users need to quickly see how many value moments exist, their distribution across tiers, and the details of each moment.

## Expert Perspectives

### Technical
- Re-export backend types directly from `convex/analysis/convergence/types.ts` — established pattern, single source of truth
- Standalone presentational component (no ProfileSection wrapper) — this is a NEW read-only analysis display in a tabbed interface, not the existing profile editing workflow
- Scope types.ts to only types needed by this component; other sections add their own when built

### Simplification Review
- Verdict: SIMPLIFY
- Reviewer suggested ProfileSection integration — **rejected** because this is a new product-profile view (M005), not the existing profile editing page. The technical architect correctly identified the different context.
- Valid simplification: Consider inlining subcomponents if they don't aid testability. Decision: keep named subcomponents in the same file for test clarity but don't export them.
- Valid simplification: types.ts could be skipped (import directly). Decision: keep it per task hints — it's a one-liner and provides a clean import path for sibling components.

## Proposed Solution

Two files in `src/components/product-profile/`:

### 1. `types.ts`
One-liner re-exporting `LensType`, `ValueMomentTier`, `ValueMoment` from convex backend types.

### 2. `ValueMomentsSection.tsx`

**Props:** `{ valueMoments: ValueMoment[] }`

**Structure:**
- `TIER_CONFIG` constant: maps tier (1/2/3) to label (Core/Important/Supporting) and Tailwind colors (indigo/amber/gray)
- `LENS_LABELS` constant: maps LensType to display strings
- `StatsBar` (internal): shows total count + per-tier counts
- `TierSection` (internal): renders heading + cards for one tier, skips if empty
- `MomentCard` (internal): Card with name, description, lens Badge list, roles, product surfaces
- `EmptyState` (internal): message when no value moments exist
- Main component: empty check → EmptyState or StatsBar + 3 TierSections

**Key decisions:**
- Pure presentational — receives data as props, no data fetching
- Internal subcomponents not exported — implementation details
- Uses real backend LensType values (jtbd, outcomes, pains, gains, alternatives, workflows, emotions)
- No expand/collapse, sorting, or filtering — YAGNI

## Alternatives Considered
1. **ProfileSection wrapper** — Rejected. ProfileSection is for the editing workflow with status badges/actions. This is read-only analysis display in a tabbed view.
2. **Duplicate frontend types** — Rejected. Creates maintenance burden when backend already exports clean types.
3. **Skip types.ts, import directly** — Viable but task hints request it, and it provides clean import path for sibling components.

## Success Criteria
- Stats bar shows total moments and tier 1/2/3 counts
- Moments grouped into Tier 1 (Core), Tier 2 (Important), Tier 3 (Supporting) sections
- Each moment card shows name, description, lens badges, roles, and product surfaces
- Tier color coding: Tier 1 = indigo, Tier 2 = amber, Tier 3 = gray
- Empty state renders when no value moments exist
- All 5 acceptance criteria covered by unit tests
