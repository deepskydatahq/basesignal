/**
 * MCP-facing product functions.
 * These accept userId directly (resolved by the MCP server from Clerk auth)
 * instead of using ctx.auth.getUserIdentity().
 */
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { validateUrl } from "./lib/urlUtils";

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const now = Date.now();
    const productId = await ctx.db.insert("products", {
      userId: args.userId,
      name: args.name,
      url: args.url,
      createdAt: now,
      updatedAt: now,
    });

    return { productId, name: args.name, url: args.url };
  },
});

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const scanProduct = mutation({
  args: {
    userId: v.id("users"),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== args.userId) {
      throw new Error("Product not found");
    }

    const validation = validateUrl(product.url);
    if (!validation.valid) {
      throw new Error(`Invalid URL: ${validation.error}`);
    }

    await ctx.scheduler.runAfter(0, internal.scanning.startScan, {
      productId: args.productId,
      userId: args.userId,
      url: product.url,
    });

    return { message: `Scan scheduled for ${product.url}` };
  },
});

export const getScanStatus = query({
  args: {
    userId: v.id("users"),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== args.userId) return null;

    const jobs = await ctx.db
      .query("scanJobs")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .order("desc")
      .take(1);

    return jobs[0] ?? null;
  },
});
