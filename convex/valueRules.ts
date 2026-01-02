import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByConnection = query({
  args: { connectionId: v.id("amplitudeConnections") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("valueRules")
      .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId))
      .collect();
  },
});

export const getByType = query({
  args: {
    connectionId: v.id("amplitudeConnections"),
    ruleType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("valueRules")
      .withIndex("by_connection_and_type", (q) =>
        q.eq("connectionId", args.connectionId).eq("ruleType", args.ruleType)
      )
      .first();
  },
});

export const create = mutation({
  args: {
    connectionId: v.id("amplitudeConnections"),
    ruleType: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    activities: v.array(v.string()),
    condition: v.string(),
    count: v.optional(v.number()),
    timeWindow: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("valueRules", {
      connectionId: args.connectionId,
      ruleType: args.ruleType,
      name: args.name,
      description: args.description,
      activities: args.activities,
      condition: args.condition,
      count: args.count,
      timeWindow: args.timeWindow,
      enabled: args.enabled,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("valueRules"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    activities: v.optional(v.array(v.string())),
    condition: v.optional(v.string()),
    count: v.optional(v.number()),
    timeWindow: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("valueRules") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
