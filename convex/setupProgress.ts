import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get current user's setup progress
export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return null;

    const progress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return progress;
  },
});

// Start setup mode for current user
export const start = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Check if setup already exists
    const existing = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) return existing._id;

    // Create new setup progress - start with onboarding
    const now = Date.now();
    const progressId = await ctx.db.insert("setupProgress", {
      userId: user._id,
      currentStep: "onboarding",
      status: "active",
      stepsCompleted: [],
      startedAt: now,
      lastActiveAt: now,
      remindersSent: 0,
    });

    // Update user status
    await ctx.db.patch(user._id, {
      setupStatus: "in_progress",
    });

    return progressId;
  },
});

// Update setup progress
export const update = mutation({
  args: {
    currentStep: v.optional(v.string()),
    status: v.optional(v.string()),
    stepsCompleted: v.optional(v.array(v.string())),
    overviewJourneyId: v.optional(v.id("journeys")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const progress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) throw new Error("Setup progress not found");

    const now = Date.now();
    const updates: Record<string, unknown> = {
      ...args,
      lastActiveAt: now,
    };

    // Handle status changes
    if (args.status === "paused") {
      updates.pausedAt = now;
    } else if (args.status === "completed") {
      updates.completedAt = now;
      await ctx.db.patch(user._id, {
        setupStatus: "complete",
        setupCompletedAt: now,
      });
    }

    await ctx.db.patch(progress._id, updates);
  },
});

// Pause setup
export const pause = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const progress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) throw new Error("Setup progress not found");

    const now = Date.now();
    await ctx.db.patch(progress._id, {
      status: "paused",
      pausedAt: now,
      lastActiveAt: now,
    });
  },
});

// Resume setup
export const resume = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const progress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) throw new Error("Setup progress not found");

    await ctx.db.patch(progress._id, {
      status: "active",
      lastActiveAt: Date.now(),
    });
  },
});

// Complete setup
export const complete = mutation({
  args: {
    overviewJourneyId: v.id("journeys"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const progress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) throw new Error("Setup progress not found");

    const now = Date.now();

    await ctx.db.patch(progress._id, {
      status: "completed",
      completedAt: now,
      lastActiveAt: now,
      stepsCompleted: ["overview_interview", "review_save"],
      overviewJourneyId: args.overviewJourneyId,
    });

    await ctx.db.patch(user._id, {
      setupStatus: "complete",
      setupCompletedAt: now,
    });
  },
});

// Dev helper: Reset setup
export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const progress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (progress) {
      await ctx.db.delete(progress._id);
    }

    await ctx.db.patch(user._id, {
      setupStatus: "not_started",
      setupCompletedAt: undefined,
    });
  },
});
