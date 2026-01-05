# Overview Interview Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve interview UX with soft opening questions and fix duplicate journey bug

**Architecture:** Update AI system prompt for softer opening, add idempotent `getOrCreateForSetup` mutation

**Tech Stack:** Convex (backend), TypeScript, convex-test (testing)

---

## Task 1: Add getOrCreateForSetup mutation with tests

**Files:**
- Modify: `convex/journeys.ts` (add new mutation)
- Modify: `convex/journeys.test.ts` (add tests)

**Step 1: Write the failing test**

Add to `convex/journeys.test.ts`:

```typescript
describe("getOrCreateForSetup", () => {
  it("creates a new journey when none exists", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "setup-test-user",
        email: "setup@example.com",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "setup-test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|setup-test-user",
    });

    const journeyId = await asUser.mutation(api.journeys.getOrCreateForSetup, {
      type: "overview",
      name: "Overview Journey",
    });

    expect(journeyId).toBeDefined();

    const journey = await asUser.query(api.journeys.get, { id: journeyId });
    expect(journey?.name).toBe("Overview Journey");
    expect(journey?.type).toBe("overview");
  });

  it("returns existing journey instead of creating duplicate", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "idempotent-test-user",
        email: "idempotent@example.com",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "idempotent-test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|idempotent-test-user",
    });

    // First call creates
    const firstId = await asUser.mutation(api.journeys.getOrCreateForSetup, {
      type: "overview",
      name: "Overview Journey",
    });

    // Second call returns same ID
    const secondId = await asUser.mutation(api.journeys.getOrCreateForSetup, {
      type: "overview",
      name: "Overview Journey",
    });

    expect(secondId).toEqual(firstId);

    // Verify only one journey exists
    const journeys = await asUser.query(api.journeys.listByUser, {});
    const overviewJourneys = journeys.filter((j) => j.type === "overview");
    expect(overviewJourneys).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/journeys.test.ts`
Expected: FAIL with "api.journeys.getOrCreateForSetup is not a function" or similar

**Step 3: Write minimal implementation**

Add to `convex/journeys.ts` after the `create` mutation:

```typescript
// Get or create journey for setup flow (idempotent)
export const getOrCreateForSetup = mutation({
  args: {
    type: v.union(
      v.literal("overview"),
      v.literal("first_value"),
      v.literal("retention"),
      v.literal("value_outcomes"),
      v.literal("value_capture"),
      v.literal("churn")
    ),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Check for existing journey of this type
    const existing = await ctx.db
      .query("journeys")
      .withIndex("by_user_and_type", (q) =>
        q.eq("userId", user._id).eq("type", args.type)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new journey
    const now = Date.now();
    return await ctx.db.insert("journeys", {
      userId: user._id,
      type: args.type,
      name: args.name,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/journeys.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/journeys.ts convex/journeys.test.ts
git commit -m "feat: add idempotent getOrCreateForSetup mutation

Prevents duplicate journeys from React 18 strict mode race conditions"
```

---

## Task 2: Update SetupInterviewPage to use getOrCreateForSetup

**Files:**
- Modify: `src/routes/SetupInterviewPage.tsx`

**Step 1: Update the mutation import and usage**

In `src/routes/SetupInterviewPage.tsx`, change:

```typescript
// Before (line 12)
const createJourney = useMutation(api.journeys.create);

// After
const getOrCreateJourney = useMutation(api.journeys.getOrCreateForSetup);
```

And update the effect (lines 22-25):

```typescript
// Before
const journeyId = await createJourney({
  type: "overview",
  name: "Overview Journey",
});

// After
const journeyId = await getOrCreateJourney({
  type: "overview",
  name: "Overview Journey",
});
```

**Step 2: Run tests to verify no regressions**

Run: `npm run test:run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/routes/SetupInterviewPage.tsx
git commit -m "fix: use idempotent getOrCreateForSetup in setup flow

Fixes duplicate journey creation in React 18 strict mode"
```

---

## Task 3: Update Overview Interview system prompt for soft opening

**Files:**
- Modify: `convex/ai.ts` (update `buildOverviewPrompt` function)

**Step 1: Update the buildOverviewPrompt function**

Replace the `buildOverviewPrompt` function (lines 333-371) with:

```typescript
// Build prompt for Overview Interview
function buildOverviewPrompt(activitiesBySlot: Record<string, unknown[]>): string {
  const slotStatus = Object.entries(activitiesBySlot)
    .map(([slot, activities]) => {
      const count = (activities as unknown[]).length;
      const required = ["account_creation", "activation", "core_usage"].includes(slot);
      return `- ${slot}: ${count} activities${required ? " (required)" : " (optional)"}`;
    })
    .join("\n");

  const totalActivities = Object.values(activitiesBySlot)
    .reduce((sum, activities) => sum + (activities as unknown[]).length, 0);

  // Determine conversation phase based on activities captured
  const phaseInstructions = totalActivities === 0
    ? `CONVERSATION PHASE: Opening

You're just starting. Warm up the user with simple, concrete questions before diving deep.

OPENING SEQUENCE (follow this order):
1. First, ask: "What does your product help users do? One sentence is fine."
   - This gets them talking with low pressure
   - Listen for clues about their domain

2. After they answer, ask: "How does someone create an account? Email signup, SSO, invite-only?"
   - Concrete and easy to answer
   - When they answer, add an account_creation activity (e.g., "Account Created")

3. Then ask: "What's the first thing a new user does after signing up?"
   - This starts their journey thinking
   - Add this as an activation activity

4. After these 3 questions, transition: "Great. Now let's map out what happens between that first action and when they become a successful customer. Walk me through it."
   - Now you can explore the full journey
   - Continue adding activities as they describe them`
    : `CONVERSATION PHASE: Deep Exploration

The user has warmed up. Continue mapping their journey by asking about gaps in the lifecycle stages.`;

  return `You are conducting an Overview Interview to map the user's product journey.

YOUR GOAL: Capture the key activities across 5 lifecycle stages:
1. account_creation (required) - How users get into the product
2. activation (required) - The first core action that signals value
3. core_usage (required) - Key repeated actions
4. revenue (optional) - When/how users convert or expand
5. churn (optional) - How users leave

CURRENT STATE:
${slotStatus}

${phaseInstructions}
${ACTIVITY_FORMAT_SECTION}
TONE:
- Neutral and professional
- Efficient — no filler
- Brief acknowledgments: "Got it." "Noted."
- Probe deeper: "What happens after that?" "How do they do that?"

RULES:
- Use add_activity tool as soon as you identify an activity
- Don't ask about the same slot twice unless unclear
- When required slots are filled, ask if they want to add optional slots or finish`;
}
```

**Step 2: Run tests to verify no regressions**

Run: `npm run test:run`
Expected: All tests PASS

**Step 3: Manual verification**

Start the dev server and test the interview flow:
1. Navigate to `/setup/interview`
2. Verify the AI asks simple opening questions first
3. Verify it transitions smoothly to deeper exploration

**Step 4: Commit**

```bash
git add convex/ai.ts
git commit -m "feat: add soft opening questions to overview interview

AI now warms up with 3 simple questions before deep exploration:
1. What does your product do?
2. How do users create an account?
3. What's the first thing they do?

Then transitions to full journey mapping."
```

---

## Task 4: Update initial AI message for overview interview

**Files:**
- Modify: `convex/interviews.ts` (update initial message)

**Step 1: Update the initial message**

In `convex/interviews.ts`, update the overview message in `initialMessages` (line 160) in `createSession`:

```typescript
// Before
overview: "I'd like to understand your product's user journey. Walk me through what a user DOES from signup to becoming a successful customer. Focus on specific actions they take.",

// After
overview: "Let's map out your product's user journey. First, a quick question: What does your product help users do? One sentence is fine.",
```

Also update the same in `resetSession` (line 232):

```typescript
// Before
overview: "I'd like to understand your product's user journey. Walk me through what a user DOES from signup to becoming a successful customer. Focus on specific actions they take.",

// After
overview: "Let's map out your product's user journey. First, a quick question: What does your product help users do? One sentence is fine.",
```

**Step 2: Run tests to verify no regressions**

Run: `npm run test:run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add convex/interviews.ts
git commit -m "feat: update overview interview initial message

Start with simple 'what does your product do?' instead of asking for full journey"
```

---

## Task 5: Final verification

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests PASS

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Manual end-to-end test**

1. Start fresh: Clear any existing overview journeys in your test account
2. Navigate to `/setup/interview`
3. Verify:
   - First message asks "What does your product help users do?"
   - Second question asks about account creation
   - Third question asks about first action
   - Then transitions to deeper exploration
4. Complete the interview
5. Check database: Only ONE journey record should exist

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address any issues found in verification"
```
