import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByJourney = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transitions")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();
  },
});

export const create = mutation({
  args: {
    journeyId: v.id("journeys"),
    fromStageId: v.id("stages"),
    toStageId: v.id("stages"),
    label: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Prevent duplicate transitions
    const existing = await ctx.db
      .query("transitions")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .filter((q) =>
        q.and(
          q.eq(q.field("fromStageId"), args.fromStageId),
          q.eq(q.field("toStageId"), args.toStageId)
        )
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("transitions", {
      journeyId: args.journeyId,
      fromStageId: args.fromStageId,
      toStageId: args.toStageId,
      label: args.label,
      type: args.type,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("transitions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
