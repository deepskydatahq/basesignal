import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByJourney = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("stages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    journeyId: v.id("journeys"),
    name: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
    position: v.object({ x: v.number(), y: v.number() }),
    entity: v.optional(v.string()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("stages", {
      journeyId: args.journeyId,
      name: args.name,
      type: args.type,
      description: args.description,
      position: args.position,
      entity: args.entity,
      action: args.action,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("stages"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    description: v.optional(v.string()),
    entity: v.optional(v.string()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.type !== undefined) updates.type = args.type;
    if (args.description !== undefined) updates.description = args.description;
    if (args.entity !== undefined) updates.entity = args.entity;
    if (args.action !== undefined) updates.action = args.action;
    await ctx.db.patch(args.id, updates);
  },
});

export const updatePosition = mutation({
  args: {
    id: v.id("stages"),
    position: v.object({ x: v.number(), y: v.number() }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      position: args.position,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("stages") },
  handler: async (ctx, args) => {
    // Delete transitions connected to this stage (both from and to)
    const fromTransitions = await ctx.db
      .query("transitions")
      .withIndex("by_from", (q) => q.eq("fromStageId", args.id))
      .collect();
    const toTransitions = await ctx.db
      .query("transitions")
      .withIndex("by_to", (q) => q.eq("toStageId", args.id))
      .collect();

    for (const t of [...fromTransitions, ...toTransitions]) {
      await ctx.db.delete(t._id);
    }

    // Delete the stage
    await ctx.db.delete(args.id);
  },
});
