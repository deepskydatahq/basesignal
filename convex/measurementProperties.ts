import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// Helper to get current authenticated user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

// List all properties for an entity
export const listByEntity = query({
  args: {
    entityId: v.id("measurementEntities"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // Verify entity belongs to user
    const entity = await ctx.db.get(args.entityId);
    if (!entity || entity.userId !== user._id) return [];

    return await ctx.db
      .query("measurementProperties")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .collect();
  },
});

// Create a new property
export const create = mutation({
  args: {
    entityId: v.id("measurementEntities"),
    name: v.string(),
    dataType: v.string(),
    description: v.optional(v.string()),
    isRequired: v.boolean(),
    suggestedFrom: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Verify entity belongs to user
    const entity = await ctx.db.get(args.entityId);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Not authorized");

    // Check for duplicate name within this entity
    const existing = await ctx.db
      .query("measurementProperties")
      .withIndex("by_entity_and_name", (q) =>
        q.eq("entityId", args.entityId).eq("name", args.name)
      )
      .first();

    if (existing) {
      throw new Error(`Property "${args.name}" already exists on this entity`);
    }

    return await ctx.db.insert("measurementProperties", {
      userId: user._id,
      entityId: args.entityId,
      name: args.name,
      dataType: args.dataType,
      description: args.description,
      isRequired: args.isRequired,
      suggestedFrom: args.suggestedFrom ?? "manual",
      createdAt: Date.now(),
    });
  },
});

// Update a property
export const update = mutation({
  args: {
    id: v.id("measurementProperties"),
    name: v.optional(v.string()),
    dataType: v.optional(v.string()),
    description: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.id);
    if (!property) throw new Error("Property not found");
    if (property.userId !== user._id) throw new Error("Not authorized");

    // Check for duplicate name if name is being changed
    if (args.name && args.name !== property.name) {
      const existing = await ctx.db
        .query("measurementProperties")
        .withIndex("by_entity_and_name", (q) =>
          q.eq("entityId", property.entityId).eq("name", args.name)
        )
        .first();

      if (existing) {
        throw new Error(`Property "${args.name}" already exists on this entity`);
      }
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.dataType !== undefined) updates.dataType = args.dataType;
    if (args.description !== undefined) updates.description = args.description;
    if (args.isRequired !== undefined) updates.isRequired = args.isRequired;

    await ctx.db.patch(args.id, updates);
  },
});

// Remove a property
export const remove = mutation({
  args: {
    id: v.id("measurementProperties"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.id);
    if (!property) throw new Error("Property not found");
    if (property.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(args.id);
  },
});
