import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const MAX_CONTENT_LENGTH = 100_000; // 100KB truncation limit

export const store = internalMutation({
  args: {
    productId: v.id("products"),
    scanJobId: v.id("scanJobs"),
    url: v.string(),
    pageType: v.string(),
    title: v.optional(v.string()),
    content: v.string(),
    metadata: v.optional(v.object({
      description: v.optional(v.string()),
      ogImage: v.optional(v.string()),
      structuredData: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const content = args.content.length > MAX_CONTENT_LENGTH
      ? args.content.slice(0, MAX_CONTENT_LENGTH)
      : args.content;

    return await ctx.db.insert("crawledPages", {
      productId: args.productId,
      scanJobId: args.scanJobId,
      url: args.url,
      pageType: args.pageType,
      title: args.title,
      content,
      contentLength: args.content.length,
      metadata: args.metadata,
      crawledAt: Date.now(),
    });
  },
});

export const listByScanJob = query({
  args: { scanJobId: v.id("scanJobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    // Verify job ownership
    const job = await ctx.db.get(args.scanJobId);
    if (!job || job.userId !== user._id) return [];

    return await ctx.db
      .query("crawledPages")
      .withIndex("by_scan_job", (q) => q.eq("scanJobId", args.scanJobId))
      .collect();
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
      .query("crawledPages")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
  },
});

export const getByProductAndType = query({
  args: {
    productId: v.id("products"),
    pageType: v.string(),
  },
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
      .query("crawledPages")
      .withIndex("by_product_type", (q) =>
        q.eq("productId", args.productId).eq("pageType", args.pageType)
      )
      .collect();
  },
});

export const removeByScanJob = internalMutation({
  args: { scanJobId: v.id("scanJobs") },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("crawledPages")
      .withIndex("by_scan_job", (q) => q.eq("scanJobId", args.scanJobId))
      .collect();

    for (const page of pages) {
      await ctx.db.delete(page._id);
    }
  },
});

// Internal query: no auth, for use by internalActions (e.g. analysis pipeline)
export const listByProductInternal = internalQuery({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawledPages")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
  },
});

// MCP-facing query: accepts userId directly for auth (MCP server validates via Clerk JWT)
export const listByProductMcp = query({
  args: {
    userId: v.id("users"),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== args.userId) return [];

    return await ctx.db
      .query("crawledPages")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
  },
});
