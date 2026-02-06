# Activation Validation Test Suite Design

## Overview

Create a validation script (`scripts/test-validation.mjs`) that scans 3-5 diverse PLG products and verifies that their profiles can store multi-level activation data. The script uses mocked activation levels until the real `extractActivationLevels` action is implemented in M002-E003.

## Problem Statement

We need to validate that the activation extraction pipeline works correctly across diverse product archetypes. This validation serves as both test infrastructure and a living specification for what M002-E003 must produce.

## Expert Perspectives

### Product
- For collaborative products (Miro, Linear, Figma), primaryActivation should be level 3 (strong) - the moment the user realizes their work happens *with* other people
- Activation progression: weak (solo action) → medium (solo exploration) → strong (collaboration begins) → very_strong (team habit)
- The "aha moment" for all three products is when another person joins the user's workflow

### Technical
- Build the test first, use mocks to make it runnable, let real implementation catch up
- The validation script becomes a contract that M002-E003 must fulfill
- Dependency mismatch (story says "Dependencies: None" but epic depends on M002-E001) should be documented, not blocking

### Simplification Review
- Design is minimal - no automation until patterns are learned
- Single script, single output file, straightforward flow
- Explicitly rejected: complex automation, database storage for test results

## Proposed Solution

A validation script that:
1. Creates/reuses test products (Miro, Linear, Figma)
2. Triggers scan + analysis pipeline for each
3. Injects mock activation levels (simulating future M002-E003 output)
4. Verifies profiles have activation.levels populated
5. Outputs results to console and JSON file

## Design Details

### Test Products Configuration

```javascript
const TEST_PRODUCTS = [
  {
    name: "Miro",
    url: "https://miro.com",
    archetype: "collaboration/whiteboard",
    expectedActivation: {
      levels: [
        { level: 1, name: "explorer", signalStrength: "weak", criteria: [{ action: "create_board", count: 1 }] },
        { level: 2, name: "creator", signalStrength: "medium", criteria: [{ action: "create_board", count: 2 }, { action: "add_content", count: 5 }] },
        { level: 3, name: "collaborator", signalStrength: "strong", criteria: [{ action: "share_board", count: 1 }, { action: "collaborator_joins", count: 1 }] },
        { level: 4, name: "team", signalStrength: "very_strong", criteria: [{ action: "co_editing_session", count: 1 }] }
      ],
      primaryActivation: 3,
      overallConfidence: 0.78
    }
  },
  {
    name: "Linear",
    url: "https://linear.app",
    archetype: "project-management",
    expectedActivation: {
      levels: [
        { level: 1, name: "reporter", signalStrength: "weak", criteria: [{ action: "create_issue", count: 1 }] },
        { level: 2, name: "contributor", signalStrength: "medium", criteria: [{ action: "create_issue", count: 3 }, { action: "move_issue_state", count: 1 }] },
        { level: 3, name: "collaborator", signalStrength: "strong", criteria: [{ action: "assign_teammate", count: 1 }, { action: "teammate_action", count: 1 }] },
        { level: 4, name: "team_rhythm", signalStrength: "very_strong", criteria: [{ action: "sprint_complete", count: 1 }] }
      ],
      primaryActivation: 3,
      overallConfidence: 0.77
    }
  },
  {
    name: "Figma",
    url: "https://figma.com",
    archetype: "design-collaboration",
    expectedActivation: {
      levels: [
        { level: 1, name: "designer", signalStrength: "weak", criteria: [{ action: "create_file", count: 1 }] },
        { level: 2, name: "builder", signalStrength: "medium", criteria: [{ action: "create_frame", count: 5 }, { action: "use_component", count: 1 }] },
        { level: 3, name: "collaborator", signalStrength: "strong", criteria: [{ action: "share_file", count: 1 }, { action: "receive_comment", count: 1 }] },
        { level: 4, name: "team_design", signalStrength: "very_strong", criteria: [{ action: "multiplayer_session", count: 1 }] }
      ],
      primaryActivation: 3,
      overallConfidence: 0.78
    }
  }
];
```

### Script Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  Test Validation Flow                                            │
│                                                                  │
│  1. Get/create test user                                         │
│  2. For each product (Miro, Linear, Figma):                      │
│     a. Create product if not exists                              │
│     b. Check if scan already complete, else trigger scan         │
│     c. Poll until scan completes                                 │
│     d. Wait for analysis pipeline ("analyzed" status)            │
│     e. Inject mock activation.levels via test endpoint           │
│     f. Verify profile has activation.levels populated            │
│  3. Output test results (JSON + console summary)                 │
└──────────────────────────────────────────────────────────────────┘
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/test-validation.mjs` | Create | Main validation script |
| `convex/testing.ts` | Create | Test-only mutation for mock injection |
| `convex/productProfiles.ts` | Modify | Add `getMcp` query |
| `.gitignore` | Modify | Add `scripts/test-validation-results.json` |

### Backend Additions

**Test injection endpoint** (`convex/testing.ts`):
```typescript
export const injectActivation = mutation({
  args: {
    productId: v.id("products"),
    activation: v.any(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      definitions: { ...profile.definitions, activation: args.activation },
      updatedAt: Date.now(),
    });
  },
});
```

**MCP-facing profile query** (`convex/productProfiles.ts`):
```typescript
export const getMcp = query({
  args: { userId: v.id("users"), productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== args.userId) return null;
    return await ctx.db.query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
  },
});
```

## Alternatives Considered

1. **Wait for M002-E003**: Rejected - creates unnecessary blocking when we can test infrastructure now
2. **Implement minimal extractor**: Rejected - creates technical debt and mixes concerns
3. **Automate validation scoring**: Rejected - premature; learn patterns manually first

## Success Criteria

1. Script runs successfully against Miro, Linear, Figma
2. All 3 products have profiles with `activation.levels` populated
3. Test results documented in JSON output
4. Mock activation data serves as specification for M002-E003

## Dependency Notes

This story uses mocked activation data because M002-E003 (extraction) is not yet implemented. When M002-E003 is complete:
1. Remove `injectMockActivation` calls
2. Analysis pipeline will automatically populate `definitions.activation.levels`
3. Verification step will validate real extracted data

The mock data structure in `expectedActivation` is the contract M002-E003 must fulfill.

---
*Design created via /brainstorm-auto · 2026-02-05*
