import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
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

// Get the First Value definition for current user
export const getDefinition = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const definition = await ctx.db
      .query("firstValueDefinitions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return definition;
  },
});

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

    // Mark measurement activity as First Value
    const allActivities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Clear isFirstValue from all activities first
    for (const activity of allActivities) {
      if (activity.isFirstValue) {
        await ctx.db.patch(activity._id, { isFirstValue: false });
      }
    }

    // Find and mark the matching activity
    const matchingActivity = allActivities.find(
      (a) => a.name === session.confirmedFirstValue!.activityName
    );
    if (matchingActivity) {
      await ctx.db.patch(matchingActivity._id, { isFirstValue: true });
    }

    // Complete the session
    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt: Date.now(),
    });

    return { definitionId };
  },
});

// Update (or create) the First Value definition
export const updateDefinition = mutation({
  args: {
    activityId: v.optional(v.id("measurementActivities")),
    activityName: v.string(),
    reasoning: v.string(),
    expectedTimeframe: v.string(),
    successCriteria: v.optional(v.string()),
    additionalContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("firstValueDefinitions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing definition
      await ctx.db.patch(existing._id, {
        activityId: args.activityId,
        activityName: args.activityName,
        reasoning: args.reasoning,
        expectedTimeframe: args.expectedTimeframe,
        successCriteria: args.successCriteria,
        additionalContext: args.additionalContext,
        source: "manual_edit",
        confirmedAt: now,
      });
      return existing._id;
    } else {
      // Create new definition
      return await ctx.db.insert("firstValueDefinitions", {
        userId: user._id,
        activityId: args.activityId,
        activityName: args.activityName,
        reasoning: args.reasoning,
        expectedTimeframe: args.expectedTimeframe,
        successCriteria: args.successCriteria,
        additionalContext: args.additionalContext,
        source: "manual_edit",
        confirmedAt: now,
      });
    }
  },
});
