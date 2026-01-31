import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { validateUrl } from "./lib/urlUtils";

/**
 * User-facing mutation to start a product scan.
 * Validates auth and ownership, then schedules the scan action.
 * Returns immediately with a job ID.
 */
export const startProductScan = mutation({
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

    // Validate URL upfront for fast user feedback
    const validation = validateUrl(args.url);
    if (!validation.valid) {
      throw new Error(`Invalid URL: ${validation.error}`);
    }

    // Schedule the scan action (runs async, returns immediately)
    await ctx.scheduler.runAfter(0, internal.scanning.startScan, {
      productId: args.productId,
      userId: user._id,
      url: args.url,
    });

    return { message: `Scan scheduled for ${args.url}` };
  },
});

/**
 * Get the latest scan job for a product.
 */
export const getLatestScan = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== user._id) return null;

    const jobs = await ctx.db
      .query("scanJobs")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .order("desc")
      .take(1);

    return jobs[0] ?? null;
  },
});
