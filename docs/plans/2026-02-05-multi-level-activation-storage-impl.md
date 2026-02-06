# Multi-Level Activation Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update `calculateCompletenessAndConfidence` to handle both legacy and new multi-level activation formats via transparent fallback.

**Architecture:** The storage layer already uses `v.any()` and stores data opaquely. The only change is a one-line fallback in `calculateCompletenessAndConfidence` that reads `overallConfidence ?? confidence ?? 0` to handle both new and legacy formats.

**Tech Stack:** Convex, TypeScript, convex-test, Vitest

---

## Task 1: Test legacy activation confidence fallback

**Files:**
- Test: `convex/productProfiles.test.ts`

**Step 1: Write the failing test**

Add a test that verifies legacy activation (with `confidence` field) still works:

```typescript
it("calculates completeness with legacy activation (confidence field)", async () => {
  const t = convexTest(schema);
  const { productId } = await setupInternalProduct(t);

  await t.mutation(internal.productProfiles.updateSectionInternal, {
    productId,
    section: "definitions",
    data: {
      activation: {
        criteria: ["User Created", "User Verified"],
        timeWindow: "7d",
        reasoning: "Legacy format test",
        confidence: 0.8,
        source: "test",
        evidence: [],
      },
    },
  });

  const profile = await t.query(internal.productProfiles.getInternal, { productId });
  // 1 section (activation in definitions) out of 10 = 0.1
  expect(profile?.completeness).toBeCloseTo(0.1, 1);
  expect(profile?.overallConfidence).toBeCloseTo(0.8, 1);
});
```

Note: Need a helper `setupInternalProduct` that creates a user and product without auth. Add this before the test if it doesn't exist:

```typescript
async function setupInternalProduct(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-clerk-id",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });
  const productId = await t.run(async (ctx) => {
    return await ctx.db.insert("products", {
      userId,
      name: "Test Product",
      url: "https://test.io",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  return { userId, productId };
}
```

**Step 2: Run test to verify it passes (baseline)**

Run: `npm test -- convex/productProfiles.test.ts --run -t "calculates completeness with legacy activation"`

Expected: PASS (the current code already handles legacy `confidence` field)

**Step 3: Commit**

```bash
git add convex/productProfiles.test.ts
git commit -m "$(cat <<'EOF'
test(productProfiles): verify legacy activation confidence works

Adds baseline test for legacy activation format with `confidence` field.
This documents the existing behavior before adding multi-level support.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Test multi-level activation with overallConfidence

**Files:**
- Test: `convex/productProfiles.test.ts`

**Step 1: Write the failing test**

Add a test that verifies new multi-level activation (with `overallConfidence` field):

```typescript
it("calculates completeness with multi-level activation (overallConfidence field)", async () => {
  const t = convexTest(schema);
  const { productId } = await setupInternalProduct(t);

  await t.mutation(internal.productProfiles.updateSectionInternal, {
    productId,
    section: "definitions",
    data: {
      activation: {
        levels: [
          {
            level: 1,
            name: "Awareness",
            signalStrength: "weak",
            criteria: [{ action: "User Created", count: 1 }],
            reasoning: "Initial signup",
            confidence: 0.9,
            evidence: [],
          },
          {
            level: 2,
            name: "Engagement",
            signalStrength: "medium",
            criteria: [{ action: "Project Created", count: 1 }],
            reasoning: "First project creation",
            confidence: 0.85,
            evidence: [],
          },
        ],
        primaryActivation: 2,
        overallConfidence: 0.87,
      },
    },
  });

  const profile = await t.query(internal.productProfiles.getInternal, { productId });
  expect(profile?.completeness).toBeCloseTo(0.1, 1);
  // Should use overallConfidence (0.87), not individual level confidence
  expect(profile?.overallConfidence).toBeCloseTo(0.87, 1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/productProfiles.test.ts --run -t "calculates completeness with multi-level activation"`

Expected: FAIL with `overallConfidence` being 0 (because current code only looks for `confidence`, not `overallConfidence`)

**Step 3: Implement the fix**

Modify `calculateCompletenessAndConfidence` in `convex/productProfiles.ts` (around line 110-117):

```typescript
// Check definition sub-sections: activation, firstValue, active, churn (4 from design doc)
const defKeys = ["activation", "firstValue", "active", "churn"] as const;
if (profile.definitions) {
  for (const key of defKeys) {
    if (profile.definitions[key]) {
      filledSections++;
      // Handles both new (overallConfidence) and legacy (confidence) formats
      totalConfidence += profile.definitions[key].overallConfidence ??
                        profile.definitions[key].confidence ?? 0;
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/productProfiles.test.ts --run -t "calculates completeness with multi-level activation"`

Expected: PASS

**Step 5: Commit**

```bash
git add convex/productProfiles.ts convex/productProfiles.test.ts
git commit -m "$(cat <<'EOF'
feat(productProfiles): support multi-level activation confidence

Update calculateCompletenessAndConfidence to use overallConfidence when
present, falling back to confidence for legacy activation format.

Uses transparent fallback pattern:
  overallConfidence ?? confidence ?? 0

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Integration test - store and retrieve 4-level activation

**Files:**
- Test: `convex/productProfiles.test.ts`

**Step 1: Write the integration test**

```typescript
it("stores and retrieves multi-level activation with 4 levels", async () => {
  const t = convexTest(schema);
  const { productId } = await setupInternalProduct(t);

  const activationData = {
    levels: [
      {
        level: 1,
        name: "Signed Up",
        signalStrength: "weak" as const,
        criteria: [{ action: "Account Created", count: 1 }],
        reasoning: "Account creation is the first step",
        confidence: 0.95,
        evidence: [{ url: "https://test.io/signup", excerpt: "Create your account" }],
      },
      {
        level: 2,
        name: "Onboarded",
        signalStrength: "medium" as const,
        criteria: [{ action: "Profile Completed", count: 1, timeWindow: "7d" }],
        reasoning: "Profile completion indicates intent",
        confidence: 0.85,
        evidence: [],
      },
      {
        level: 3,
        name: "First Value",
        signalStrength: "strong" as const,
        criteria: [{ action: "Project Created", count: 1, timeWindow: "14d" }],
        reasoning: "First project is the aha moment",
        confidence: 0.80,
        evidence: [{ url: "https://test.io/docs/quickstart", excerpt: "Create your first project" }],
      },
      {
        level: 4,
        name: "Power User",
        signalStrength: "very_strong" as const,
        criteria: [
          { action: "Project Created", count: 3, timeWindow: "30d" },
          { action: "Team Invited", count: 1, timeWindow: "30d" },
        ],
        reasoning: "Multiple projects and team collaboration",
        confidence: 0.75,
        evidence: [],
      },
    ],
    primaryActivation: 3,
    overallConfidence: 0.84,
  };

  await t.mutation(internal.productProfiles.updateSectionInternal, {
    productId,
    section: "definitions",
    data: { activation: activationData },
  });

  const profile = await t.query(internal.productProfiles.getInternal, { productId });

  // Verify all 4 levels persisted
  expect(profile?.definitions?.activation?.levels).toHaveLength(4);

  // Verify level structure
  const level1 = profile?.definitions?.activation?.levels[0];
  expect(level1?.name).toBe("Signed Up");
  expect(level1?.signalStrength).toBe("weak");
  expect(level1?.criteria).toHaveLength(1);
  expect(level1?.evidence).toHaveLength(1);

  const level3 = profile?.definitions?.activation?.levels[2];
  expect(level3?.name).toBe("First Value");
  expect(level3?.signalStrength).toBe("strong");

  const level4 = profile?.definitions?.activation?.levels[3];
  expect(level4?.criteria).toHaveLength(2);

  // Verify primaryActivation
  expect(profile?.definitions?.activation?.primaryActivation).toBe(3);

  // Verify overallConfidence used in calculation
  expect(profile?.overallConfidence).toBeCloseTo(0.84, 1);
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- convex/productProfiles.test.ts --run -t "stores and retrieves multi-level activation with 4 levels"`

Expected: PASS (storage layer already handles complex objects via `v.any()`)

**Step 3: Commit**

```bash
git add convex/productProfiles.test.ts
git commit -m "$(cat <<'EOF'
test(productProfiles): integration test for 4-level activation storage

Verifies that updateSectionInternal correctly persists and retrieves
multi-level activation data including:
- 4 levels with varying signal strengths
- Structured criteria with counts and time windows
- Evidence arrays per level
- primaryActivation marker
- overallConfidence for completeness calculation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integration test - profile completeness with multi-level activation

**Files:**
- Test: `convex/productProfiles.test.ts`

**Step 1: Write the integration test**

```typescript
it("shows correct completeness percentage with multi-level activation and other sections", async () => {
  const t = convexTest(schema);
  const { productId } = await setupInternalProduct(t);

  // Add identity section (1 of 10)
  await t.mutation(internal.productProfiles.updateSectionInternal, {
    productId,
    section: "identity",
    data: {
      productName: "Test App",
      description: "A test application",
      targetCustomer: "Developers",
      businessModel: "B2B SaaS",
      confidence: 0.9,
      evidence: [],
    },
  });

  // Add multi-level activation (1 of 10)
  await t.mutation(internal.productProfiles.updateSectionInternal, {
    productId,
    section: "definitions",
    data: {
      activation: {
        levels: [
          { level: 1, name: "Signup", signalStrength: "weak", criteria: [], reasoning: "", confidence: 0.8, evidence: [] },
          { level: 2, name: "First Value", signalStrength: "strong", criteria: [], reasoning: "", confidence: 0.9, evidence: [] },
        ],
        primaryActivation: 2,
        overallConfidence: 0.85,
      },
    },
  });

  const profile = await t.query(internal.productProfiles.getInternal, { productId });

  // 2 sections out of 10 = 20%
  expect(profile?.completeness).toBeCloseTo(0.2, 1);

  // Average confidence: (0.9 + 0.85) / 2 = 0.875
  expect(profile?.overallConfidence).toBeCloseTo(0.875, 2);
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- convex/productProfiles.test.ts --run -t "shows correct completeness percentage"`

Expected: PASS

**Step 3: Commit**

```bash
git add convex/productProfiles.test.ts
git commit -m "$(cat <<'EOF'
test(productProfiles): verify completeness with mixed section types

Integration test confirming that profiles with both top-level sections
(identity) and multi-level activation calculate correct completeness
percentage and average confidence.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Run full test suite and verify

**Files:**
- All test files

**Step 1: Run all productProfiles tests**

Run: `npm test -- convex/productProfiles.test.ts --run`

Expected: All tests PASS (both new tests and existing tests)

**Step 2: Run full test suite**

Run: `npm test -- --run`

Expected: All tests PASS

**Step 3: Final commit (if any cleanup needed)**

If any cleanup is needed, commit with appropriate message.

---

## Verification Checklist

After completing all tasks, verify:

- [ ] `npm test -- --run` passes
- [ ] Legacy activation with `confidence` field works
- [ ] Multi-level activation with `overallConfidence` field works
- [ ] 4-level activation data persists correctly
- [ ] Profile completeness calculates correctly with multi-level activation
- [ ] All 6 acceptance criteria from the task are met:
  1. [unit] updateSectionInternal accepts activation data with levels array and stores it correctly
  2. [unit] updateSectionInternal accepts activation data with primaryActivation marker
  3. [unit] calculateCompletenessAndConfidence uses activation.overallConfidence when levels exist
  4. [unit] calculateCompletenessAndConfidence falls back to legacy activation.confidence if no levels
  5. [integration] Storing activation with 4 levels via updateSectionInternal persists all level data
  6. [integration] Profile with multi-level activation shows correct completeness percentage
