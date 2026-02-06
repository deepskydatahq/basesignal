# Activation Levels Schema Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat activation schema with a multi-level structure supporting multiple activation levels with signal strength, structured criteria, and evidence.

**Architecture:** Direct schema replacement in `convex/schema.ts`. The storage layer uses `v.any()` for definitions, so old and new data formats coexist without migration. The `calculateCompletenessAndConfidence` function already uses transparent fallbacks (`confidence ?? 0`).

**Tech Stack:** Convex schema validators, TypeScript, convex-test for testing

---

## Task 1: Write failing test for multi-level activation schema

**Files:**
- Test: `convex/productProfiles.test.ts`

**Step 1: Write the failing test**

Add this test at the end of the describe block (before the closing `});`):

```typescript
  it("can update activation with multi-level structure", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    const activationData = {
      levels: [
        {
          level: 1,
          name: "Onboarded",
          signalStrength: "weak" as const,
          criteria: [
            { action: "complete_signup", count: 1 },
          ],
          reasoning: "User has completed basic signup",
          confidence: 0.7,
          evidence: [{ url: "https://docs.example.com/onboarding", excerpt: "Complete signup to get started" }],
        },
        {
          level: 2,
          name: "First Value",
          signalStrength: "strong" as const,
          criteria: [
            { action: "create_project", count: 1 },
            { action: "invite_team_member", count: 1, timeWindow: "7d" },
          ],
          reasoning: "User has created a project and invited a team member",
          confidence: 0.8,
          evidence: [{ url: "https://docs.example.com/activation", excerpt: "Create your first project" }],
        },
      ],
      primaryActivation: 2,
      overallConfidence: 0.75,
    };

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "definitions",
      data: { activation: activationData },
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile?.definitions?.activation).toBeDefined();
    expect(profile?.definitions?.activation?.levels).toHaveLength(2);
    expect(profile?.definitions?.activation?.levels?.[0]?.signalStrength).toBe("weak");
    expect(profile?.definitions?.activation?.levels?.[1]?.signalStrength).toBe("strong");
    expect(profile?.definitions?.activation?.primaryActivation).toBe(2);
    expect(profile?.definitions?.activation?.overallConfidence).toBe(0.75);
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/productProfiles.test.ts`
Expected: PASS (because storage uses `v.any()` - the test passes even without schema changes, but the schema serves as documentation and TypeScript types)

**Step 3: Commit**

```bash
git add convex/productProfiles.test.ts
git commit -m "test: add multi-level activation schema test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Update activation schema in convex/schema.ts

**Files:**
- Modify: `convex/schema.ts:503-510`

**Step 1: Replace the activation schema**

Locate the activation schema at line 503 inside the `definitions` object:

```typescript
      activation: v.optional(v.object({
        criteria: v.array(v.string()),
        timeWindow: v.optional(v.string()),
        reasoning: v.string(),
        confidence: v.number(),
        source: v.string(),
        evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
      })),
```

Replace it with the new multi-level structure:

```typescript
      activation: v.optional(v.object({
        levels: v.array(v.object({
          level: v.number(),
          name: v.string(),
          signalStrength: v.union(
            v.literal("weak"),
            v.literal("medium"),
            v.literal("strong"),
            v.literal("very_strong")
          ),
          criteria: v.array(v.object({
            action: v.string(),
            count: v.number(),
            timeWindow: v.optional(v.string()),
          })),
          reasoning: v.string(),
          confidence: v.number(),
          evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
        })),
        primaryActivation: v.optional(v.number()),
        overallConfidence: v.number(),
        source: v.optional(v.string()),
      })),
```

**Step 2: Run Convex dev to verify schema compiles**

Run: `npx convex dev --once`
Expected: Schema compiles successfully, no errors

**Step 3: Run tests to verify nothing broke**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: update activation schema to support multi-level structure

Replace flat activation schema with new structure:
- levels: array of activation level objects
- Each level has: level, name, signalStrength (weak|medium|strong|very_strong)
- Structured criteria: [{action, count, timeWindow}]
- primaryActivation: number indicating aha-moment level
- overallConfidence: aggregated confidence across levels

Story: M002-E001-S001

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Verify TypeScript types are generated correctly

**Files:**
- Check: `convex/_generated/dataModel.d.ts`

**Step 1: Verify generated types include new activation structure**

Run: `npx convex dev --once` (if not already running)

The generated types should now include the new activation structure. You can verify by checking that `convex/_generated/dataModel.d.ts` contains references to `signalStrength` and `levels`.

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 3: Final commit (if any type adjustments needed)**

If no changes needed, skip this step.

---

## Verification Checklist

Before marking complete:

- [ ] Schema compiles without errors (`npx convex dev --once`)
- [ ] All tests pass (`npm test`)
- [ ] TypeScript types generated correctly in `convex/_generated/`
- [ ] New test covers multi-level activation structure

## Acceptance Criteria Mapping

| Criterion | Implementation |
|-----------|---------------|
| [unit] Schema defines activation.levels as array | `levels: v.array(v.object({...}))` |
| [unit] Each level has: level, name, signalStrength | Inside level object |
| [unit] signalStrength is enum: weak\|medium\|strong\|very_strong | `v.union(v.literal("weak"), ...)` |
| [unit] Each level has criteria array with action, count, timeWindow | `criteria: v.array(v.object({action, count, timeWindow}))` |
| [unit] Each level has: reasoning, confidence, evidence | Inside level object |
| [unit] activation.primaryActivation as number | `primaryActivation: v.optional(v.number())` |
| [unit] activation.overallConfidence as number | `overallConfidence: v.number()` |
| [integration] Schema compiles | Verified by `npx convex dev` |
