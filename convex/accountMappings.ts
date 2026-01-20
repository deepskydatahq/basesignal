import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByConnection = query({
  args: { connectionId: v.id("amplitudeConnections") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accountMappings")
      .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId))
      .first();
  },
});

export const create = mutation({
  args: {
    connectionId: v.id("amplitudeConnections"),
    accountIdField: v.string(),
    accountIdFieldType: v.optional(v.string()),
    fieldMappings: v.array(v.object({
      targetField: v.string(),
      sourceField: v.string(),
      sourceType: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("accountMappings", {
      connectionId: args.connectionId,
      accountIdField: args.accountIdField,
      accountIdFieldType: args.accountIdFieldType,
      fieldMappings: args.fieldMappings,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("accountMappings"),
    accountIdField: v.optional(v.string()),
    accountIdFieldType: v.optional(v.string()),
    fieldMappings: v.optional(v.array(v.object({
      targetField: v.string(),
      sourceField: v.string(),
      sourceType: v.string(),
    }))),
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
  args: { id: v.id("accountMappings") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
