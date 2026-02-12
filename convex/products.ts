import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
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

    const now = Date.now();
    return await ctx.db.insert("products", {
      userId: user._id,
      name: args.name,
      url: args.url,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    return await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const listWithProfiles = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const products = await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return Promise.all(
      products.map(async (product) => {
        const profileDoc = await ctx.db
          .query("productProfiles")
          .withIndex("by_product", (q) => q.eq("productId", product._id))
          .first();

        if (!profileDoc) {
          return { ...product, profile: null };
        }

        const profileAny = profileDoc as Record<string, unknown>;
        return {
          ...product,
          profile: {
            completeness: profileDoc.completeness,
            overallConfidence: profileDoc.overallConfidence,
            hasConvergence: !!profileAny.convergence,
            hasOutputs: !!profileAny.outputs,
          },
        };
      })
    );
  },
});

export const get = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const product = await ctx.db.get(args.id);
    if (!product || product.userId !== user._id) return null;

    return product;
  },
});

export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const product = await ctx.db.get(args.id);
    if (!product || product.userId !== user._id) {
      throw new Error("Product not found");
    }

    await ctx.db.delete(args.id);
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const product = await ctx.db.get(args.id);
    if (!product || product.userId !== user._id) {
      throw new Error("Product not found");
    }

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.url !== undefined && { url: args.url }),
      updatedAt: Date.now(),
    });
  },
});

export const updateDocsUrlInternal = internalMutation({
  args: {
    productId: v.id("products"),
    docsUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.productId, {
      docsUrl: args.docsUrl,
      updatedAt: Date.now(),
    });
  },
});
