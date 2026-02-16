# listWithProfiles Query Design

## Overview
Add a `listWithProfiles` query to `convex/products.ts` that returns all products for the authenticated user, each joined with a profile summary object (or `null` if no profile exists). This eliminates N+1 queries on the product list page.

## Problem Statement
The product list page needs to show each product alongside its profile status (completeness, confidence, convergence, outputs). Without a joined query, the frontend would need to make N+1 queries (1 for the product list + 1 per product for its profile).

## Expert Perspectives

### Technical
- Read stored fields rather than recomputing: `completeness` and `overallConfidence` are maintained at write time by `updateSectionInternal`, making them canonical. This is a synchrony pattern, not a caching pattern.
- O(1) per product for profile summary reads.
- If drift is a concern, validate with tests rather than recomputing in the query.

### Simplification Review
- Design is minimal and inevitable. No bloat, no unnecessary abstractions.
- Single ~25-30 line query function is the irreducible essence of the requirement.

## Proposed Solution

Add a `listWithProfiles` query in `convex/products.ts`:

1. Auth check identical to `products.list`: get Clerk identity, look up user by `clerkId`, return `[]` if not found
2. Fetch all products via `by_user` index
3. For each product, query `productProfiles` table using `by_product` index
4. If profile exists, return `{ completeness, overallConfidence, hasConvergence: !!convergence, hasOutputs: !!outputs }`; otherwise `null`
5. Return array of `{ ...product, profile }` objects

## Key Decisions
- **Read stored fields, don't recompute** - completeness/confidence are write-time computed aggregates
- **Boolean flags for convergence/outputs** - just enough for list-page badges
- **Return `[]` for unauthenticated** - same graceful degradation as `products.list`

## Components
- **`convex/products.ts`**: Add `listWithProfiles` query (~25-30 lines)
- **Tests**: Unit tests for all four acceptance criteria using `convex-test`

## Success Criteria
- listWithProfiles returns products for authenticated user
- Each product includes profile summary: completeness, overallConfidence, hasConvergence, hasOutputs
- Products without a profile return profile: null
- Query reuses existing auth pattern from products.list
