import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    productId: v.id("products"),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== user._id) {
      throw new Error("Product not found");
    }

    return await ctx.db.insert("scanJobs", {
      productId: args.productId,
      userId: user._id,
      status: "mapping",
      url: args.url,
      pagesCrawled: 0,
      currentPhase: "Discovering pages",
      startedAt: Date.now(),
    });
  },
});

export const get = query({
  args: { id: v.id("scanJobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const job = await ctx.db.get(args.id);
    if (!job || job.userId !== user._id) return null;

    return job;
  },
});

// Internal version for use by Convex actions (no auth check)
export const createInternal = internalMutation({
  args: {
    productId: v.id("products"),
    userId: v.id("users"),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("scanJobs", {
      productId: args.productId,
      userId: args.userId,
      status: "mapping",
      url: args.url,
      pagesCrawled: 0,
      currentPhase: "Discovering pages",
      startedAt: Date.now(),
    });
  },
});

export const updateProgress = internalMutation({
  args: {
    jobId: v.id("scanJobs"),
    status: v.optional(v.string()),
    pagesCrawled: v.optional(v.number()),
    pagesTotal: v.optional(v.number()),
    currentPhase: v.optional(v.string()),
    crawledPages: v.optional(v.array(v.object({
      url: v.string(),
      pageType: v.optional(v.string()),
      title: v.optional(v.string()),
    }))),
    discoveredDocs: v.optional(v.string()),
    discoveredPricing: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;
    const cleanUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }
    await ctx.db.patch(jobId, cleanUpdates);
  },
});

export const complete = internalMutation({
  args: { jobId: v.id("scanJobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "complete",
      currentPhase: "Done",
      completedAt: Date.now(),
    });
  },
});

export const fail = internalMutation({
  args: {
    jobId: v.id("scanJobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: args.error,
      currentPhase: "Failed",
      completedAt: Date.now(),
    });
  },
});

export const listByProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== user._id) return [];

    return await ctx.db
      .query("scanJobs")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
  },
});
