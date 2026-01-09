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

// Get foundation status for homepage progress card
export const foundationStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        overviewInterview: { status: "not_started" as const, journeyId: null, slotsCompleted: 0, slotsTotal: 5 },
        firstValue: { status: "not_defined" as const, journeyId: null },
        measurementPlan: { status: "locked" as const, entitiesCount: 0 },
        metricCatalog: { status: "locked" as const, metricsCount: 0 },
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return {
        overviewInterview: { status: "not_started" as const, journeyId: null, slotsCompleted: 0, slotsTotal: 5 },
        firstValue: { status: "not_defined" as const, journeyId: null },
        measurementPlan: { status: "locked" as const, entitiesCount: 0 },
        metricCatalog: { status: "locked" as const, metricsCount: 0 },
      };
    }

    // Get setup progress
    const progress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Get user's journeys
    const journeys = await ctx.db
      .query("journeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const overviewJourney = journeys.find((j) => j.type === "overview") ?? null;
    const firstValueJourney = journeys.find((j) => j.type === "first_value") ?? null;

    // Calculate slots completed for overview journey
    let slotsCompleted = 0;
    if (overviewJourney) {
      const stages = await ctx.db
        .query("stages")
        .withIndex("by_journey", (q) => q.eq("journeyId", overviewJourney._id))
        .collect();
      const filledSlots = new Set(stages.map((s) => s.lifecycleSlot).filter(Boolean));
      slotsCompleted = filledSlots.size;
    }

    // Derive overview interview status
    let overviewStatus: "not_started" | "in_progress" | "complete" = "not_started";
    const overviewComplete = progress?.status === "completed";
    if (overviewComplete) {
      overviewStatus = "complete";
    } else if (progress?.currentStep === "overview_interview") {
      overviewStatus = "in_progress";
    }

    // Calculate measurement plan status
    const measurementEntities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const entitiesCount = measurementEntities.length;

    let measurementPlanStatus: "locked" | "available" | "ready" = "locked";
    if (entitiesCount > 0) {
      measurementPlanStatus = "ready";
    } else if (overviewComplete) {
      measurementPlanStatus = "available";
    }

    // Calculate metric catalog status
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const metricsCount = metrics.length;

    let metricCatalogStatus: "locked" | "in_progress" | "complete" = "locked";
    if (metricsCount > 0) {
      metricCatalogStatus = "complete";
    } else if (overviewComplete) {
      metricCatalogStatus = "in_progress";
    }

    return {
      overviewInterview: {
        status: overviewStatus,
        journeyId: overviewJourney?._id ?? null,
        slotsCompleted,
        slotsTotal: 5,
      },
      firstValue: {
        status: firstValueJourney ? ("defined" as const) : ("not_defined" as const),
        journeyId: firstValueJourney?._id ?? null,
      },
      measurementPlan: { status: measurementPlanStatus, entitiesCount },
      metricCatalog: { status: metricCatalogStatus, metricsCount },
    };
  },
});
