import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { JOURNEY_TYPES } from "../src/shared/journeyTypes";

export { JOURNEY_TYPES };

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

// Get all journeys for current authenticated user
export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("journeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Get default journey per type for home page
export const getDefaultsByType = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return {
        overview: null,
        first_value: null,
        retention: null,
        value_outcomes: null,
        value_capture: null,
        churn: null,
      };
    }

    const journeys = await ctx.db
      .query("journeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Group by type and find default (or first) for each
    const result: Record<string, Doc<"journeys"> | null> = {
      overview: null,
      first_value: null,
      retention: null,
      value_outcomes: null,
      value_capture: null,
      churn: null,
    };

    for (const type of JOURNEY_TYPES) {
      const typeJourneys = journeys.filter((j) => j.type === type);
      if (typeJourneys.length === 0) continue;

      // Find the default, or use the first one
      const defaultJourney = typeJourneys.find((j) => j.isDefault);
      result[type] = defaultJourney ?? typeJourneys[0];
    }

    return result;
  },
});

// Get a single journey by ID
export const get = query({
  args: { id: v.id("journeys") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const journey = await ctx.db.get(args.id);
    if (!journey) return null;
    if (journey.userId !== user._id) return null;

    return journey;
  },
});

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

// Create a new journey with auto-default logic
export const create = mutation({
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

    // Check if this is the first journey of this type for the user
    const existingJourneys = await ctx.db
      .query("journeys")
      .withIndex("by_user_and_type", (q) =>
        q.eq("userId", user._id).eq("type", args.type)
      )
      .collect();

    const isFirst = existingJourneys.length === 0;
    const now = Date.now();

    return await ctx.db.insert("journeys", {
      userId: user._id,
      type: args.type,
      name: args.name,
      isDefault: isFirst, // First journey of this type is default
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Set a journey as default (scoped per type)
export const setDefault = mutation({
  args: { id: v.id("journeys") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const journey = await ctx.db.get(args.id);
    if (!journey) throw new Error("Journey not found");
    if (journey.userId !== user._id) throw new Error("Not authorized");

    // Clear isDefault for other journeys of the same type and user
    const sameTypeJourneys = await ctx.db
      .query("journeys")
      .withIndex("by_user_and_type", (q) =>
        q.eq("userId", user._id).eq("type", journey.type)
      )
      .collect();

    for (const j of sameTypeJourneys) {
      if (j.isDefault && j._id !== args.id) {
        await ctx.db.patch(j._id, { isDefault: false });
      }
    }

    // Set this one as default
    await ctx.db.patch(args.id, { isDefault: true, updatedAt: Date.now() });
  },
});

// Update journey name
export const update = mutation({
  args: {
    id: v.id("journeys"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const journey = await ctx.db.get(args.id);
    if (!journey) throw new Error("Journey not found");
    if (journey.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(args.id, {
      name: args.name,
      updatedAt: Date.now(),
    });
  },
});

// Remove a journey and all related stages/transitions
export const remove = mutation({
  args: { id: v.id("journeys") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const journey = await ctx.db.get(args.id);
    if (!journey) throw new Error("Journey not found");
    if (journey.userId !== user._id) throw new Error("Not authorized");

    // Delete all transitions for this journey
    const transitions = await ctx.db
      .query("transitions")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.id))
      .collect();
    for (const t of transitions) {
      await ctx.db.delete(t._id);
    }

    // Delete all stages for this journey
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.id))
      .collect();
    for (const s of stages) {
      await ctx.db.delete(s._id);
    }

    // Delete the journey
    await ctx.db.delete(args.id);
  },
});
