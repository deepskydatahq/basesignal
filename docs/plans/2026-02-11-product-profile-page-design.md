# ProductProfilePage with Tabs Design

## Overview
A flat page component at `src/routes/ProductProfilePage.tsx` that displays a product header with stats and four tabs for analysis sections. Follows the EntityDetailPage pattern exactly — no wrapper components or premature abstractions.

## Problem Statement
Users need a dedicated page to view their product's profile data (value moments, ICP profiles, activation map, measurement spec) organized in a tabbed layout with summary stats in a header.

## Expert Perspectives

### Technical
- **Option A (flat component) wins.** Follows EntityDetailPage and ProfilePage precedent. Keep header, loading/empty states, and tabs all in one file. Extract section components later when they're built in subsequent stories.
- Key insight: "You're not asking 'should headers be components?' — you're asking 'should I make a wrapper?' The answer is no."

### Simplification Review
- Nothing to remove, nothing to simplify. Design is inevitable because it combines proven patterns with existing data model.
- "Each piece serves the product strategy. Ship it."

## Proposed Solution

Single flat component `ProductProfilePage.tsx`:

**Data fetching:** `useParams` for productId, two `useQuery` calls (products.get, productProfiles.get) with "skip" pattern.

**Three states:**
1. Loading (product === undefined): animate-pulse skeleton
2. Not Found (product === null): error message + back link
3. Loaded: header with stats + four tabs

**Header:** Back link to "/", product name as h1, URL as secondary text, two stat badges (completeness %, confidence %).

**Tabs:** Value Moments, ICP Profiles, Activation Map, Measurement Spec. Each renders a placeholder Card — replaced by section components in later stories.

**Empty state:** When profile is null but product exists, shows "No profile data yet" banner. Stats default to 0%.

## Design Details

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/routes/ProductProfilePage.tsx` | Create - page component |
| `src/routes/ProductProfilePage.test.tsx` | Create - 6 unit tests |
| `src/App.tsx` | Modify - add `products/:productId` route |

### Test Plan
6 tests mapping 1:1 to acceptance criteria:
1. Reads productId and fetches data
2. Header shows name, URL, completeness %, confidence %
3. Back link navigates to /
4. Four tabs render with correct names
5. Loading state when data undefined
6. Empty state when profile null

## Alternatives Considered
- **Option B (header + tabs as separate child components):** Rejected — adds abstraction layer before we know the final shape. Zero clarity gain for cognitive overhead.

## Success Criteria
- All 6 acceptance criteria pass as unit tests
- Page follows EntityDetailPage pattern recognizably
- Tab placeholders ready to swap for section components in later stories
