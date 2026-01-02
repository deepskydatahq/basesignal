import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sources").collect();
  },
});

export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sources")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

export const upsert = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    dagsterJobUrl: v.optional(v.string()),
    tables: v.array(
      v.object({
        name: v.string(),
        bqTable: v.string(),
        freshnessThresholdHours: v.number(),
        lastSyncAt: v.optional(v.string()),
        rowCount: v.optional(v.number()),
      })
    ),
    lastCheckedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        dagsterJobUrl: args.dagsterJobUrl,
        tables: args.tables,
        lastCheckedAt: args.lastCheckedAt,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("sources", args);
    }
  },
});
