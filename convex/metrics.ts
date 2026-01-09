import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

// Helper to get current authenticated user
async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

// Get a single metric by ID
export const get = query({
  args: { id: v.id("metrics") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const metric = await ctx.db.get(args.id);
    if (!metric) return null;
    if (metric.userId !== user._id) return null;

    return metric;
  },
});

// List all metrics for current user, ordered by order field
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Sort by order field
    return metrics.sort((a, b) => a.order - b.order);
  },
});

// Count metrics for current user (for dashboard status)
export const count = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return 0;

    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return metrics.length;
  },
});
