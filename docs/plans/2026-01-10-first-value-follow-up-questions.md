# First Value: Follow-up Questions & Definition Save Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After First Value confirmation, collect timeframe and success criteria via AI follow-up questions, then save the complete definition to the database.

**Architecture:** Extend the AI interview flow to detect confirmation and trigger follow-up questions. Update session schema to track confirmed First Value state. Add `completeFirstValueInterview` mutation to save definition and mark activity as First Value. Create `convex/firstValue.ts` with schema and mutations.

**Tech Stack:** Convex (backend), TypeScript, Claude API (AI), React

---

## Prerequisites

This issue depends on Issue #32 (Core Detection & Confirmation) which adds:
- `pendingCandidate` and `confirmedFirstValue` fields to `interviewSessions` schema
- `confirmFirstValueCandidate` and `dismissFirstValueCandidate` mutations in `convex/interviews.ts`
- `propose_first_value_candidate` AI tool in `convex/ai.ts`

If #32 is not complete, implement those first before this plan.

---

## Task 1: Add firstValueDefinitions Schema Table

**Files:**
- Modify: `convex/schema.ts`
- Test: `convex/firstValue.test.ts`

**Step 1: Write the failing test**

Create `convex/firstValue.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";

describe("firstValueDefinitions schema", () => {
  it("allows inserting a first value definition", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const definitionId = await t.run(async (ctx) => {
      return await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Project Published",
        reasoning: "Users see their work live for the first time",
        expectedTimeframe: "Within first session",
        confirmedAt: Date.now(),
        source: "interview",
      });
    });

    expect(definitionId).toBeDefined();

    const definition = await t.run(async (ctx) => {
      return await ctx.db.get(definitionId);
    });

    expect(definition?.activityName).toBe("Project Published");
    expect(definition?.reasoning).toBe("Users see their work live for the first time");
    expect(definition?.source).toBe("interview");
  });

  it("supports optional successCriteria field", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-2",
        email: "test2@example.com",
        createdAt: Date.now(),
      });
    });

    const definitionId = await t.run(async (ctx) => {
      return await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Report Generated",
        reasoning: "Users see actionable insights",
        expectedTimeframe: "Within 24 hours",
        successCriteria: "User exports or shares the report",
        confirmedAt: Date.now(),
        source: "interview",
      });
    });

    const definition = await t.run(async (ctx) => {
      return await ctx.db.get(definitionId);
    });

    expect(definition?.successCriteria).toBe("User exports or shares the report");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: FAIL - "firstValueDefinitions" table not found

**Step 3: Write minimal implementation**

Add to `convex/schema.ts` (after the `interviewMessages` table):

```typescript
  firstValueDefinitions: defineTable({
    userId: v.id("users"),
    activityId: v.optional(v.id("measurementActivities")),
    activityName: v.string(),
    reasoning: v.string(),
    expectedTimeframe: v.string(),
    successCriteria: v.optional(v.string()),
    additionalContext: v.optional(v.string()),
    confirmedAt: v.number(),
    source: v.string(), // "interview" | "manual_edit"
  })
    .index("by_user", ["userId"]),
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/schema.ts convex/firstValue.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): add firstValueDefinitions table

Stores First Value definition with activity, reasoning, timeframe,
and success criteria. Supports both interview-derived and manual entries.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update interviewSessions Schema for First Value State

**Files:**
- Modify: `convex/schema.ts`
- Test: `convex/firstValue.test.ts`

**Step 1: Write the failing test**

Add to `convex/firstValue.test.ts`:

```typescript
describe("interviewSessions First Value fields", () => {
  it("supports pendingCandidate field", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-session",
        email: "session@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "Test Journey",
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const sessionId = await t.run(async (ctx) => {
      return await ctx.db.insert("interviewSessions", {
        journeyId,
        interviewType: "first_value",
        status: "active",
        startedAt: Date.now(),
        pendingCandidate: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
        },
      });
    });

    const session = await t.run(async (ctx) => {
      return await ctx.db.get(sessionId);
    });

    expect(session?.pendingCandidate?.activityName).toBe("Project Published");
    expect(session?.pendingCandidate?.reasoning).toBe("Users see their work live");
  });

  it("supports confirmedFirstValue field", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-session-2",
        email: "session2@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "Test Journey 2",
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const sessionId = await t.run(async (ctx) => {
      return await ctx.db.insert("interviewSessions", {
        journeyId,
        interviewType: "first_value",
        status: "active",
        startedAt: Date.now(),
        confirmedFirstValue: {
          activityName: "Report Generated",
          reasoning: "Users see actionable insights",
          confirmedAt: Date.now(),
        },
      });
    });

    const session = await t.run(async (ctx) => {
      return await ctx.db.get(sessionId);
    });

    expect(session?.confirmedFirstValue?.activityName).toBe("Report Generated");
    expect(session?.confirmedFirstValue?.confirmedAt).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: FAIL - pendingCandidate/confirmedFirstValue fields not in schema

**Step 3: Write minimal implementation**

Update the `interviewSessions` table in `convex/schema.ts`:

```typescript
  interviewSessions: defineTable({
    journeyId: v.id("journeys"),
    interviewType: v.optional(v.string()), // "first_value" | "retention" | etc.
    status: v.string(), // "active" | "completed" | "archived"
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    // First Value candidate state (Issue #32/#33)
    pendingCandidate: v.optional(v.object({
      activityName: v.string(),
      reasoning: v.string(),
    })),
    confirmedFirstValue: v.optional(v.object({
      activityName: v.string(),
      reasoning: v.string(),
      confirmedAt: v.number(),
    })),
  })
    .index("by_journey", ["journeyId"])
    .index("by_journey_and_type", ["journeyId", "interviewType"]),
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/schema.ts convex/firstValue.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): add First Value candidate fields to interviewSessions

Adds pendingCandidate and confirmedFirstValue optional objects to track
First Value detection state during the interview flow.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add First Value Confirmation Mutations to Interviews

**Files:**
- Modify: `convex/interviews.ts`
- Test: `convex/firstValue.test.ts`

**Step 1: Write the failing test**

Add to `convex/firstValue.test.ts`:

```typescript
import { api } from "./_generated/api";

// Helper to set up authenticated user with journey
async function setupFirstValueSession(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-fv",
      email: "fv-test@example.com",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user-fv",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user-fv",
  });

  const journeyId = await asUser.mutation(api.journeys.create, {
    type: "first_value",
    name: "First Value Journey",
  });

  const sessionId = await asUser.mutation(api.interviews.createSession, {
    journeyId,
    interviewType: "first_value",
  });

  return { userId, asUser, journeyId, sessionId };
}

describe("interviews.confirmFirstValueCandidate", () => {
  it("moves pendingCandidate to confirmedFirstValue", async () => {
    const t = convexTest(schema);
    const { asUser, sessionId } = await setupFirstValueSession(t);

    // Set pending candidate directly
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        pendingCandidate: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
        },
      });
    });

    // Confirm the candidate
    await asUser.mutation(api.interviews.confirmFirstValueCandidate, {
      sessionId,
    });

    const session = await asUser.query(api.interviews.getSession, { sessionId });

    expect(session?.pendingCandidate).toBeUndefined();
    expect(session?.confirmedFirstValue).toBeDefined();
    expect(session?.confirmedFirstValue?.activityName).toBe("Project Published");
    expect(session?.confirmedFirstValue?.confirmedAt).toBeDefined();
  });

  it("throws error when no pending candidate exists", async () => {
    const t = convexTest(schema);
    const { asUser, sessionId } = await setupFirstValueSession(t);

    await expect(
      asUser.mutation(api.interviews.confirmFirstValueCandidate, { sessionId })
    ).rejects.toThrow(/no pending candidate/i);
  });
});

describe("interviews.dismissFirstValueCandidate", () => {
  it("clears pendingCandidate", async () => {
    const t = convexTest(schema);
    const { asUser, sessionId } = await setupFirstValueSession(t);

    // Set pending candidate directly
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        pendingCandidate: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
        },
      });
    });

    // Dismiss the candidate
    await asUser.mutation(api.interviews.dismissFirstValueCandidate, {
      sessionId,
    });

    const session = await asUser.query(api.interviews.getSession, { sessionId });

    expect(session?.pendingCandidate).toBeUndefined();
    expect(session?.confirmedFirstValue).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: FAIL - api.interviews.confirmFirstValueCandidate not found

**Step 3: Write minimal implementation**

Add to `convex/interviews.ts`:

```typescript
// Confirm the pending First Value candidate
export const confirmFirstValueCandidate = mutation({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.pendingCandidate) throw new Error("No pending candidate to confirm");

    // Move pending to confirmed
    await ctx.db.patch(args.sessionId, {
      confirmedFirstValue: {
        activityName: session.pendingCandidate.activityName,
        reasoning: session.pendingCandidate.reasoning,
        confirmedAt: Date.now(),
      },
      pendingCandidate: undefined,
    });

    return { confirmed: true };
  },
});

// Dismiss the pending First Value candidate
export const dismissFirstValueCandidate = mutation({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      pendingCandidate: undefined,
    });

    return { dismissed: true };
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/interviews.ts convex/firstValue.test.ts
git commit -m "$(cat <<'EOF'
feat(interviews): add First Value confirmation mutations

Adds confirmFirstValueCandidate to move pending to confirmed state,
and dismissFirstValueCandidate to clear pending candidate.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add completeFirstValueInterview Mutation

**Files:**
- Create: `convex/firstValue.ts`
- Test: `convex/firstValue.test.ts`

**Step 1: Write the failing test**

Add to `convex/firstValue.test.ts`:

```typescript
describe("firstValue.completeFirstValueInterview", () => {
  it("saves definition and completes session", async () => {
    const t = convexTest(schema);
    const { userId, asUser, sessionId } = await setupFirstValueSession(t);

    // Set confirmed First Value
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        confirmedFirstValue: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
          confirmedAt: Date.now(),
        },
      });
    });

    await asUser.mutation(api.firstValue.completeFirstValueInterview, {
      sessionId,
      expectedTimeframe: "Within first session",
      successCriteria: "User shares the published link",
    });

    // Verify definition was created
    const definition = await t.run(async (ctx) => {
      return await ctx.db
        .query("firstValueDefinitions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
    });

    expect(definition).not.toBeNull();
    expect(definition?.activityName).toBe("Project Published");
    expect(definition?.reasoning).toBe("Users see their work live");
    expect(definition?.expectedTimeframe).toBe("Within first session");
    expect(definition?.successCriteria).toBe("User shares the published link");
    expect(definition?.source).toBe("interview");

    // Verify session was completed
    const session = await asUser.query(api.interviews.getSession, { sessionId });
    expect(session?.status).toBe("completed");
  });

  it("throws error when no confirmed First Value", async () => {
    const t = convexTest(schema);
    const { asUser, sessionId } = await setupFirstValueSession(t);

    await expect(
      asUser.mutation(api.firstValue.completeFirstValueInterview, {
        sessionId,
        expectedTimeframe: "Within first session",
      })
    ).rejects.toThrow(/no confirmed first value/i);
  });

  it("replaces existing definition for the user", async () => {
    const t = convexTest(schema);
    const { userId, asUser, sessionId } = await setupFirstValueSession(t);

    // Create existing definition
    await t.run(async (ctx) => {
      await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Old Activity",
        reasoning: "Old reasoning",
        expectedTimeframe: "Within 24 hours",
        confirmedAt: Date.now() - 10000,
        source: "interview",
      });
    });

    // Set confirmed First Value
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        confirmedFirstValue: {
          activityName: "New Activity",
          reasoning: "New reasoning",
          confirmedAt: Date.now(),
        },
      });
    });

    await asUser.mutation(api.firstValue.completeFirstValueInterview, {
      sessionId,
      expectedTimeframe: "Within first session",
    });

    // Verify only one definition exists (old one replaced)
    const definitions = await t.run(async (ctx) => {
      return await ctx.db
        .query("firstValueDefinitions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    expect(definitions).toHaveLength(1);
    expect(definitions[0].activityName).toBe("New Activity");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: FAIL - api.firstValue.completeFirstValueInterview not found

**Step 3: Write minimal implementation**

Create `convex/firstValue.ts`:

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// Helper to get current authenticated user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

// Complete the First Value interview and save definition
export const completeFirstValueInterview = mutation({
  args: {
    sessionId: v.id("interviewSessions"),
    expectedTimeframe: v.string(),
    successCriteria: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.confirmedFirstValue) {
      throw new Error("No confirmed First Value to save");
    }

    // Get the journey to find the user
    const journey = await ctx.db.get(session.journeyId);
    if (!journey) throw new Error("Journey not found");

    const userId = journey.userId;

    // Delete any existing definition for this user
    const existingDefinitions = await ctx.db
      .query("firstValueDefinitions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const def of existingDefinitions) {
      await ctx.db.delete(def._id);
    }

    // Create new definition
    const definitionId = await ctx.db.insert("firstValueDefinitions", {
      userId,
      activityName: session.confirmedFirstValue.activityName,
      reasoning: session.confirmedFirstValue.reasoning,
      expectedTimeframe: args.expectedTimeframe,
      successCriteria: args.successCriteria,
      confirmedAt: session.confirmedFirstValue.confirmedAt,
      source: "interview",
    });

    // Complete the session
    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt: Date.now(),
    });

    return { definitionId };
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/firstValue.ts convex/firstValue.test.ts
git commit -m "$(cat <<'EOF'
feat(firstValue): add completeFirstValueInterview mutation

Saves First Value definition from confirmed session state, replaces
any existing definition for the user, and completes the session.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update AI to Trigger Follow-up Questions After Confirmation

**Files:**
- Modify: `convex/ai.ts`
- Test: Manual testing (AI behavior)

**Step 1: Write the failing test**

This is an AI behavior change that's difficult to unit test directly. We'll verify by:
1. Adding the follow-up logic to the system prompt
2. Testing manually that AI asks follow-up questions after confirmation

**Step 2: Update AI prompt for first_value interview**

In `convex/ai.ts`, update the `first_value` case in `buildInterviewPrompt`:

```typescript
    first_value: `You are helping identify the activation moment - the first time a user experiences value.

FOCUS ON:
- What does "success" look like for a new user?
- What's the first meaningful action they take?
- How quickly should this happen after signup?

GOALS:
1. Build the journey path from signup to first value
2. Each stage must be a specific user action, not a phase

FIRST VALUE DETECTION:
When you identify a strong First Value candidate during the conversation:
- The activity should represent the FIRST moment users get real value
- Not just completing setup, but actually experiencing the benefit
- Look for moments where users SEE RESULTS, not just take actions
- Call propose_first_value_candidate with clear reasoning
- Only propose when confident - it's okay to gather more context first

AFTER CONFIRMATION:
When the user confirms a First Value candidate:
- Ask about expected timeframe: "How quickly should new users reach this moment? Within their first session, within 24 hours, within their first week, or a custom timeframe?"
- Ask about success criteria: "What does success look like when they reach this moment? How would you know they truly got value?"
- After both answers, summarize and offer to complete the interview

Ask concrete questions. When you identify an action, add it using entity + action format.`,
```

**Step 3: Add propose_first_value_candidate tool to first_value interviews**

In `convex/ai.ts`, update `buildJourneyTools` to include the First Value tool for `first_value` interview type:

```typescript
function buildJourneyTools(
  stages: Array<{ name: string; entity?: string; action?: string }>,
  interviewType: InterviewType,
  session?: { confirmedFirstValue?: { activityName: string; reasoning: string; confirmedAt: number } }
): Anthropic.Tool[] {
  const typeConfig = INTERVIEW_TYPES[interviewType];
  const existingActivities = stages
    .filter(s => s.entity && s.action)
    .map(s => `${s.entity} ${s.action}`);
  const existingNote = existingActivities.length > 0
    ? `EXISTING ACTIVITIES: [${existingActivities.join(", ")}]. Don't create duplicates.`
    : "No activities added yet.";

  const tools: Anthropic.Tool[] = [];

  // Stage tools only for types that build stages
  if (typeConfig.outputs.stages) {
    // ... existing stage tools
  }

  // First Value tool for first_value interview (only if not already confirmed)
  if (interviewType === "first_value" && !session?.confirmedFirstValue) {
    tools.push({
      name: "propose_first_value_candidate",
      description: `Propose an activity as the First Value moment when you have high confidence this is where users first experience value. Only call when confident. ${existingNote}`,
      input_schema: {
        type: "object" as const,
        properties: {
          activity_name: {
            type: "string",
            description: "The Entity Action name (e.g., 'Project Published')"
          },
          reasoning: {
            type: "string",
            description: "Why this is the First Value moment - what value does the user experience?"
          }
        },
        required: ["activity_name", "reasoning"]
      }
    });
  }

  return tools;
}
```

**Step 4: Handle the propose_first_value_candidate tool execution**

In `convex/ai.ts`, add a new case in the tool execution logic:

```typescript
case "propose_first_value_candidate": {
  const activityName = args.activity_name as string;
  const reasoning = args.reasoning as string;

  // Store pending candidate on session
  await ctx.runMutation(api.interviews.setPendingCandidate, {
    sessionId,
    candidate: { activityName, reasoning }
  });

  return `Proposed "${activityName}" as First Value candidate. Awaiting user confirmation on the journey map.`;
}
```

**Step 5: Add setPendingCandidate mutation**

Add to `convex/interviews.ts`:

```typescript
// Set pending First Value candidate (called by AI)
export const setPendingCandidate = mutation({
  args: {
    sessionId: v.id("interviewSessions"),
    candidate: v.object({
      activityName: v.string(),
      reasoning: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      pendingCandidate: args.candidate,
    });
    return { success: true };
  },
});
```

**Step 6: Commit**

```bash
git add convex/ai.ts convex/interviews.ts
git commit -m "$(cat <<'EOF'
feat(ai): add First Value detection and follow-up flow

- Add propose_first_value_candidate tool for first_value interviews
- Update system prompt with detection guidance and follow-up questions
- Add setPendingCandidate mutation for AI to store candidates

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add TimeframeQuickSelect Component

**Files:**
- Create: `src/components/interview/TimeframeQuickSelect.tsx`
- Test: `src/components/interview/TimeframeQuickSelect.test.tsx`

**Step 1: Write the failing test**

Create `src/components/interview/TimeframeQuickSelect.test.tsx`:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeframeQuickSelect } from "./TimeframeQuickSelect";

function setup(props: Partial<Parameters<typeof TimeframeQuickSelect>[0]> = {}) {
  const user = userEvent.setup();
  const onSelect = props.onSelect ?? vi.fn();
  const defaultProps = {
    onSelect,
    ...props,
  };
  render(<TimeframeQuickSelect {...defaultProps} />);
  return { user, onSelect };
}

test("renders all timeframe options", () => {
  setup();

  expect(screen.getByRole("button", { name: /first session/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /24 hours/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /first week/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /other/i })).toBeInTheDocument();
});

test("calls onSelect when option is clicked", async () => {
  const { user, onSelect } = setup();

  await user.click(screen.getByRole("button", { name: /24 hours/i }));

  expect(onSelect).toHaveBeenCalledWith("Within 24 hours");
});

test("shows selected state for active option", () => {
  setup({ selected: "Within first session" });

  const selectedButton = screen.getByRole("button", { name: /first session/i });
  expect(selectedButton).toHaveAttribute("aria-pressed", "true");
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/interview/TimeframeQuickSelect.test.tsx`
Expected: FAIL - Cannot find module

**Step 3: Write minimal implementation**

Create `src/components/interview/TimeframeQuickSelect.tsx`:

```typescript
import { Button } from "@/components/ui/button";

const TIMEFRAME_OPTIONS = [
  { value: "Within first session", label: "First session" },
  { value: "Within 24 hours", label: "24 hours" },
  { value: "Within first week", label: "First week" },
  { value: "custom", label: "Other" },
];

interface TimeframeQuickSelectProps {
  selected?: string;
  onSelect: (value: string) => void;
}

export function TimeframeQuickSelect({
  selected,
  onSelect,
}: TimeframeQuickSelectProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TIMEFRAME_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={selected === option.value ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(option.value)}
          aria-pressed={selected === option.value}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/interview/TimeframeQuickSelect.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/interview/TimeframeQuickSelect.tsx src/components/interview/TimeframeQuickSelect.test.tsx
git commit -m "$(cat <<'EOF'
feat(TimeframeQuickSelect): add quick-select for timeframe options

Provides buttons for common timeframe choices: first session, 24 hours,
first week, or custom. Used during First Value follow-up flow.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add FirstValueCandidateCard Component

**Files:**
- Create: `src/components/interview/FirstValueCandidateCard.tsx`
- Test: `src/components/interview/FirstValueCandidateCard.test.tsx`

**Step 1: Write the failing test**

Create `src/components/interview/FirstValueCandidateCard.test.tsx`:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstValueCandidateCard } from "./FirstValueCandidateCard";

function setup(props: Partial<Parameters<typeof FirstValueCandidateCard>[0]> = {}) {
  const user = userEvent.setup();
  const onConfirm = props.onConfirm ?? vi.fn();
  const onKeepExploring = props.onKeepExploring ?? vi.fn();
  const defaultProps = {
    activityName: "Project Published",
    reasoning: "Users see their work live for the first time",
    onConfirm,
    onKeepExploring,
    ...props,
  };
  render(<FirstValueCandidateCard {...defaultProps} />);
  return { user, onConfirm, onKeepExploring };
}

test("renders activity name and reasoning", () => {
  setup();

  expect(screen.getByText("Project Published")).toBeInTheDocument();
  expect(screen.getByText("Users see their work live for the first time")).toBeInTheDocument();
});

test("renders Confirm and Keep Exploring buttons", () => {
  setup();

  expect(screen.getByRole("button", { name: /confirm first value/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /keep exploring/i })).toBeInTheDocument();
});

test("calls onConfirm when Confirm is clicked", async () => {
  const { user, onConfirm } = setup();

  await user.click(screen.getByRole("button", { name: /confirm first value/i }));

  expect(onConfirm).toHaveBeenCalled();
});

test("calls onKeepExploring when Keep Exploring is clicked", async () => {
  const { user, onKeepExploring } = setup();

  await user.click(screen.getByRole("button", { name: /keep exploring/i }));

  expect(onKeepExploring).toHaveBeenCalled();
});

test("renders star icon", () => {
  setup();

  expect(screen.getByTestId("star-icon")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/interview/FirstValueCandidateCard.test.tsx`
Expected: FAIL - Cannot find module

**Step 3: Write minimal implementation**

Create `src/components/interview/FirstValueCandidateCard.tsx`:

```typescript
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FirstValueCandidateCardProps {
  activityName: string;
  reasoning: string;
  onConfirm: () => void;
  onKeepExploring: () => void;
}

export function FirstValueCandidateCard({
  activityName,
  reasoning,
  onConfirm,
  onKeepExploring,
}: FirstValueCandidateCardProps) {
  return (
    <div className="border-2 border-yellow-400 bg-yellow-50 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <Star
          className="w-5 h-5 text-yellow-500 fill-yellow-500"
          data-testid="star-icon"
        />
        <span className="font-semibold text-gray-900">{activityName}</span>
      </div>

      <p className="text-sm text-gray-600 mb-4">{reasoning}</p>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onKeepExploring}>
          Keep Exploring
        </Button>
        <Button onClick={onConfirm}>
          Confirm First Value
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/interview/FirstValueCandidateCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/interview/FirstValueCandidateCard.tsx src/components/interview/FirstValueCandidateCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(FirstValueCandidateCard): add candidate confirmation UI

Displays proposed First Value with activity name, reasoning, star icon,
and Confirm/Keep Exploring buttons. Yellow highlight for visibility.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add InterviewCompletionCard Component

**Files:**
- Create: `src/components/interview/InterviewCompletionCard.tsx`
- Test: `src/components/interview/InterviewCompletionCard.test.tsx`

**Step 1: Write the failing test**

Create `src/components/interview/InterviewCompletionCard.test.tsx`:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InterviewCompletionCard } from "./InterviewCompletionCard";

function setup(props: Partial<Parameters<typeof InterviewCompletionCard>[0]> = {}) {
  const user = userEvent.setup();
  const onComplete = props.onComplete ?? vi.fn();
  const defaultProps = {
    activityName: "Project Published",
    reasoning: "Users see their work live",
    expectedTimeframe: "Within first session",
    successCriteria: "User shares the link",
    onComplete,
    isLoading: false,
    ...props,
  };
  render(<InterviewCompletionCard {...defaultProps} />);
  return { user, onComplete };
}

test("renders summary of First Value definition", () => {
  setup();

  expect(screen.getByText("Project Published")).toBeInTheDocument();
  expect(screen.getByText("Users see their work live")).toBeInTheDocument();
  expect(screen.getByText(/first session/i)).toBeInTheDocument();
  expect(screen.getByText(/user shares the link/i)).toBeInTheDocument();
});

test("renders Complete Interview button", () => {
  setup();

  expect(screen.getByRole("button", { name: /complete interview/i })).toBeInTheDocument();
});

test("calls onComplete when button is clicked", async () => {
  const { user, onComplete } = setup();

  await user.click(screen.getByRole("button", { name: /complete interview/i }));

  expect(onComplete).toHaveBeenCalled();
});

test("disables button when loading", () => {
  setup({ isLoading: true });

  expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
});

test("shows success criteria only if provided", () => {
  setup({ successCriteria: undefined });

  expect(screen.queryByText(/success/i)).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/interview/InterviewCompletionCard.test.tsx`
Expected: FAIL - Cannot find module

**Step 3: Write minimal implementation**

Create `src/components/interview/InterviewCompletionCard.tsx`:

```typescript
import { Star, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface InterviewCompletionCardProps {
  activityName: string;
  reasoning: string;
  expectedTimeframe: string;
  successCriteria?: string;
  onComplete: () => void;
  isLoading: boolean;
}

export function InterviewCompletionCard({
  activityName,
  reasoning,
  expectedTimeframe,
  successCriteria,
  onComplete,
  isLoading,
}: InterviewCompletionCardProps) {
  return (
    <Card className="border-green-400 bg-green-50">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          <h3 className="font-semibold text-lg">First Value Defined</h3>
        </div>

        <div className="space-y-3">
          <div>
            <p className="font-semibold text-gray-900">{activityName}</p>
            <p className="text-sm text-gray-600">{reasoning}</p>
          </div>

          <div className="text-sm">
            <p>
              <span className="text-gray-500">Timeframe:</span>{" "}
              <span className="text-gray-700">{expectedTimeframe}</span>
            </p>
            {successCriteria && (
              <p>
                <span className="text-gray-500">Success:</span>{" "}
                <span className="text-gray-700">{successCriteria}</span>
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={onComplete}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            "Saving..."
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Complete Interview
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/interview/InterviewCompletionCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/interview/InterviewCompletionCard.tsx src/components/interview/InterviewCompletionCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(InterviewCompletionCard): add interview completion summary

Shows First Value definition summary with Complete Interview button.
Displays activity, reasoning, timeframe, and optional success criteria.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Integrate First Value Components into OverviewJourneyMap

**Files:**
- Modify: `src/components/overview/OverviewJourneyMap.tsx`
- Test: `src/components/overview/OverviewJourneyMap.test.tsx`

**Step 1: Write the failing test**

Create `src/components/overview/OverviewJourneyMap.test.tsx`:

```typescript
import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverviewJourneyMap from "./OverviewJourneyMap";

// Mock Convex
const mockConfirm = vi.fn();
const mockDismiss = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn((query) => {
    if (query.toString().includes("getActivitiesBySlot")) {
      return {
        account_creation: [{ _id: "a1", entity: "Account", action: "Created" }],
        activation: [{ _id: "a2", entity: "Project", action: "Published" }],
        core_usage: [],
        revenue: [],
        churn: [],
      };
    }
    if (query.toString().includes("checkCompletionStatus")) {
      return { canComplete: false, filledSlots: ["account_creation", "activation"], missingRequired: ["core_usage"] };
    }
    if (query.toString().includes("getSession")) {
      return {
        _id: "session-1",
        status: "active",
        pendingCandidate: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
        },
      };
    }
    return null;
  }),
  useMutation: vi.fn((mutation) => {
    if (mutation.toString().includes("confirmFirstValueCandidate")) {
      return mockConfirm;
    }
    if (mutation.toString().includes("dismissFirstValueCandidate")) {
      return mockDismiss;
    }
    return vi.fn();
  }),
}));

beforeEach(() => {
  mockConfirm.mockClear();
  mockDismiss.mockClear();
});

test("renders FirstValueCandidateCard when pendingCandidate exists", () => {
  render(<OverviewJourneyMap journeyId={"j-1" as any} sessionId={"session-1" as any} />);

  expect(screen.getByText("Project Published")).toBeInTheDocument();
  expect(screen.getByText("Users see their work live")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /confirm first value/i })).toBeInTheDocument();
});

test("calls confirmFirstValueCandidate when Confirm is clicked", async () => {
  const user = userEvent.setup();
  render(<OverviewJourneyMap journeyId={"j-1" as any} sessionId={"session-1" as any} />);

  await user.click(screen.getByRole("button", { name: /confirm first value/i }));

  expect(mockConfirm).toHaveBeenCalledWith({ sessionId: "session-1" });
});

test("calls dismissFirstValueCandidate when Keep Exploring is clicked", async () => {
  const user = userEvent.setup();
  render(<OverviewJourneyMap journeyId={"j-1" as any} sessionId={"session-1" as any} />);

  await user.click(screen.getByRole("button", { name: /keep exploring/i }));

  expect(mockDismiss).toHaveBeenCalledWith({ sessionId: "session-1" });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/overview/OverviewJourneyMap.test.tsx`
Expected: FAIL - No FirstValueCandidateCard rendered

**Step 3: Write minimal implementation**

Update `src/components/overview/OverviewJourneyMap.tsx`:

```typescript
import { useQuery, useMutation } from "convex/react";
import { Check, Circle } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { LIFECYCLE_SLOTS, SLOT_INFO, REQUIRED_SLOTS } from "../../shared/lifecycleSlots";
import { FirstValueCandidateCard } from "../interview/FirstValueCandidateCard";

interface OverviewJourneyMapProps {
  journeyId: Id<"journeys">;
  sessionId?: Id<"interviewSessions">;
}

export default function OverviewJourneyMap({ journeyId, sessionId }: OverviewJourneyMapProps) {
  const activitiesBySlot = useQuery(api.overviewInterview.getActivitiesBySlot, { journeyId });
  const completionStatus = useQuery(api.overviewInterview.checkCompletionStatus, { journeyId });
  const session = useQuery(
    api.interviews.getSession,
    sessionId ? { sessionId } : "skip"
  );

  const confirmCandidate = useMutation(api.interviews.confirmFirstValueCandidate);
  const dismissCandidate = useMutation(api.interviews.dismissFirstValueCandidate);

  if (!activitiesBySlot) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading journey...</div>
      </div>
    );
  }

  const handleConfirm = async () => {
    if (sessionId) {
      await confirmCandidate({ sessionId });
    }
  };

  const handleKeepExploring = async () => {
    if (sessionId) {
      await dismissCandidate({ sessionId });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Pending First Value Candidate */}
      {session?.pendingCandidate && (
        <div className="mb-6">
          <FirstValueCandidateCard
            activityName={session.pendingCandidate.activityName}
            reasoning={session.pendingCandidate.reasoning}
            onConfirm={handleConfirm}
            onKeepExploring={handleKeepExploring}
          />
        </div>
      )}

      <div className="space-y-6">
        {/* ... existing slot rendering ... */}
      </div>

      {/* ... existing completion status ... */}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/overview/OverviewJourneyMap.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/overview/OverviewJourneyMap.tsx src/components/overview/OverviewJourneyMap.test.tsx
git commit -m "$(cat <<'EOF'
feat(OverviewJourneyMap): integrate FirstValueCandidateCard

Shows candidate confirmation card when pendingCandidate exists on session.
Confirm and Keep Exploring buttons call respective mutations.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Mark Activity as isFirstValue on Definition Save

**Files:**
- Modify: `convex/firstValue.ts`
- Test: `convex/firstValue.test.ts`

**Step 1: Write the failing test**

Add to `convex/firstValue.test.ts`:

```typescript
describe("completeFirstValueInterview marks activity", () => {
  it("sets isFirstValue on matching measurement activity", async () => {
    const t = convexTest(schema);
    const { userId, asUser, sessionId } = await setupFirstValueSession(t);

    // Create entity and activity
    const entityId = await t.run(async (ctx) => {
      return await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Published",
        action: "Published",
        isFirstValue: false,
        createdAt: Date.now(),
      });
    });

    // Set confirmed First Value
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        confirmedFirstValue: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
          confirmedAt: Date.now(),
        },
      });
    });

    await asUser.mutation(api.firstValue.completeFirstValueInterview, {
      sessionId,
      expectedTimeframe: "Within first session",
    });

    // Verify activity was marked
    const activities = await t.run(async (ctx) => {
      return await ctx.db
        .query("measurementActivities")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    const markedActivity = activities.find((a) => a.name === "Project Published");
    expect(markedActivity?.isFirstValue).toBe(true);
  });

  it("clears isFirstValue from previous activity", async () => {
    const t = convexTest(schema);
    const { userId, asUser, sessionId } = await setupFirstValueSession(t);

    // Create entity and two activities
    const entityId = await t.run(async (ctx) => {
      return await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        isFirstValue: true, // Previously marked
        createdAt: Date.now(),
      });
      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Published",
        action: "Published",
        isFirstValue: false,
        createdAt: Date.now(),
      });
    });

    // Set confirmed First Value to the new activity
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        confirmedFirstValue: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
          confirmedAt: Date.now(),
        },
      });
    });

    await asUser.mutation(api.firstValue.completeFirstValueInterview, {
      sessionId,
      expectedTimeframe: "Within first session",
    });

    // Verify old activity was unmarked
    const activities = await t.run(async (ctx) => {
      return await ctx.db
        .query("measurementActivities")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    const oldActivity = activities.find((a) => a.name === "Project Created");
    const newActivity = activities.find((a) => a.name === "Project Published");

    expect(oldActivity?.isFirstValue).toBe(false);
    expect(newActivity?.isFirstValue).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: FAIL - isFirstValue not updated

**Step 3: Write minimal implementation**

Update `convex/firstValue.ts` `completeFirstValueInterview`:

```typescript
export const completeFirstValueInterview = mutation({
  args: {
    sessionId: v.id("interviewSessions"),
    expectedTimeframe: v.string(),
    successCriteria: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.confirmedFirstValue) {
      throw new Error("No confirmed First Value to save");
    }

    // Get the journey to find the user
    const journey = await ctx.db.get(session.journeyId);
    if (!journey) throw new Error("Journey not found");

    const userId = journey.userId;

    // Delete any existing definition for this user
    const existingDefinitions = await ctx.db
      .query("firstValueDefinitions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const def of existingDefinitions) {
      await ctx.db.delete(def._id);
    }

    // Clear isFirstValue from all user activities
    const allActivities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const activity of allActivities) {
      if (activity.isFirstValue) {
        await ctx.db.patch(activity._id, { isFirstValue: false });
      }
    }

    // Find matching activity and mark it
    const matchingActivity = allActivities.find(
      (a) => a.name.toLowerCase() === session.confirmedFirstValue!.activityName.toLowerCase()
    );

    let activityId: Id<"measurementActivities"> | undefined;
    if (matchingActivity) {
      await ctx.db.patch(matchingActivity._id, { isFirstValue: true });
      activityId = matchingActivity._id;
    }

    // Create new definition
    const definitionId = await ctx.db.insert("firstValueDefinitions", {
      userId,
      activityId,
      activityName: session.confirmedFirstValue.activityName,
      reasoning: session.confirmedFirstValue.reasoning,
      expectedTimeframe: args.expectedTimeframe,
      successCriteria: args.successCriteria,
      confirmedAt: session.confirmedFirstValue.confirmedAt,
      source: "interview",
    });

    // Complete the session
    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt: Date.now(),
    });

    return { definitionId, activityId };
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/firstValue.ts convex/firstValue.test.ts
git commit -m "$(cat <<'EOF'
feat(firstValue): mark activity isFirstValue on interview complete

Clears isFirstValue from all user activities, then marks the matching
activity. Links activityId in definition for measurement plan integration.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final Integration Test & Cleanup

**Files:**
- All files from previous tasks

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests PASS

**Step 2: Run linting**

Run: `npm run lint`
Expected: No errors

**Step 3: Test manually (if dev server available)**

1. Start dev server: `npm run dev` and `npx convex dev`
2. Start a First Value interview
3. Have the AI propose a First Value candidate
4. Verify candidate card appears in journey map
5. Confirm the candidate
6. Answer timeframe and success criteria follow-up questions
7. Complete the interview
8. Verify definition saved and visible on dashboard

**Step 4: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: complete First Value follow-up questions and definition save

- Add firstValueDefinitions schema table
- Add pendingCandidate/confirmedFirstValue to interviewSessions
- Add confirmation mutations for First Value candidates
- Add completeFirstValueInterview mutation with activity marking
- Add AI tool and follow-up question flow
- Add TimeframeQuickSelect, FirstValueCandidateCard, InterviewCompletionCard
- Integrate candidate card into OverviewJourneyMap

Closes #33

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Component | Files |
|------|-----------|-------|
| 1 | firstValueDefinitions schema | `convex/schema.ts` |
| 2 | Session schema update | `convex/schema.ts` |
| 3 | Confirmation mutations | `convex/interviews.ts` |
| 4 | completeFirstValueInterview | `convex/firstValue.ts` |
| 5 | AI follow-up flow | `convex/ai.ts`, `convex/interviews.ts` |
| 6 | TimeframeQuickSelect | `src/components/interview/TimeframeQuickSelect.tsx` |
| 7 | FirstValueCandidateCard | `src/components/interview/FirstValueCandidateCard.tsx` |
| 8 | InterviewCompletionCard | `src/components/interview/InterviewCompletionCard.tsx` |
| 9 | Journey map integration | `src/components/overview/OverviewJourneyMap.tsx` |
| 10 | Activity marking | `convex/firstValue.ts` |
| 11 | Final tests | All files |

**Total: 11 TDD tasks**

**Testing:**
- Run `npm run test:run` after each task
- Run `npm run lint` before final commit

**Dependencies:**
- Requires Issue #32 (Core Detection & Confirmation) to be completed first
- Issue #34 (Dashboard Display) depends on this issue
