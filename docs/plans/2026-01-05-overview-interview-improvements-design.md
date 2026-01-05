# Overview Interview Improvements Design

## Problem Statement

The Overview Interview has three issues affecting user experience:

1. **Opening question too complex** - First prompt asks for the entire journey at once, overwhelming users
2. **Duplicate journeys created** - Race condition in React 18 strict mode causes two journey records

## Solution

### Part 1: Soft Opening Questions (AI-Guided)

**Change location:** `convex/ai.ts` - system prompt for overview interviews

Update `buildOverviewSystemPrompt()` to instruct the AI to warm up with 3 simple questions:

1. "What does your product help users do?" (context, low pressure)
2. "How does someone create an account?" (concrete, generates first activity)
3. "What's the first thing a new user does after signing up?" (starts journey thinking)

Then transition: "Great. Now let's map out the full journey from that first action to when they become a successful customer."

**Key points:**
- AI-guided flow, not hardcoded state machine
- AI can adapt based on responses (skip ahead if user gives detailed answer)
- Natural conversation feel while ensuring warm-up happens

### Part 2: Idempotent Journey Creation for Setup

**Change location:** `convex/journeys.ts`

Add new `getOrCreateForSetup` mutation that returns existing journey if one exists:

```typescript
export const getOrCreateForSetup = mutation({
  args: {
    type: v.union(...),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // For setup, return existing if one exists
    const existing = await ctx.db
      .query("journeys")
      .withIndex("by_user_and_type", (q) =>
        q.eq("userId", user._id).eq("type", args.type)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new one
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

**Frontend change:** `SetupInterviewPage.tsx` uses `getOrCreateForSetup` instead of `create`

**Rationale:** Keep `create` mutation unchanged to allow multiple journeys per type for power users. The `getOrCreateForSetup` is specifically for the setup flow where idempotency is needed.

## Files to Modify

1. `convex/ai.ts` - Update overview system prompt
2. `convex/journeys.ts` - Add `getOrCreateForSetup` mutation
3. `src/routes/SetupInterviewPage.tsx` - Use new mutation

## Testing

1. Start new Overview Interview → should ask simple opening questions
2. Answer opening questions → should feel easy, natural transition to deeper questions
3. Complete interview → check database for single journey record
4. Refresh page during setup → no duplicate journeys created

## Out of Scope

- Empty review page placeholder (separate ticket)
- Real-time journey map preview updates (already works via Convex reactivity)
