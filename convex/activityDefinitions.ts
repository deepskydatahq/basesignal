import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByConnection = query({
  args: { connectionId: v.id("amplitudeConnections") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("activityDefinitions")
      .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId))
      .collect();
  },
});

export const getByName = query({
  args: {
    connectionId: v.id("amplitudeConnections"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("activityDefinitions")
      .withIndex("by_connection_and_name", (q) =>
        q.eq("connectionId", args.connectionId).eq("name", args.name)
      )
      .first();
  },
});

export const create = mutation({
  args: {
    connectionId: v.id("amplitudeConnections"),
    name: v.string(),
    description: v.optional(v.string()),
    type: v.string(),
    sourceEvent: v.optional(v.string()),
    propertyFilters: v.optional(v.array(v.object({
      property: v.string(),
      operator: v.string(),
      value: v.any(),
    }))),
    syntheticRule: v.optional(v.object({
      events: v.array(v.string()),
      condition: v.string(),
      count: v.optional(v.number()),
      timeWindow: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("activityDefinitions", {
      connectionId: args.connectionId,
      name: args.name,
      description: args.description,
      type: args.type,
      sourceEvent: args.sourceEvent,
      propertyFilters: args.propertyFilters,
      syntheticRule: args.syntheticRule,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("activityDefinitions"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
    sourceEvent: v.optional(v.string()),
    propertyFilters: v.optional(v.array(v.object({
      property: v.string(),
      operator: v.string(),
      value: v.any(),
    }))),
    syntheticRule: v.optional(v.object({
      events: v.array(v.string()),
      condition: v.string(),
      count: v.optional(v.number()),
      timeWindow: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("activityDefinitions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
