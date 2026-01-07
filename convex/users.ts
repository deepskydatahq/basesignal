import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Called by Clerk webhook - creates user from webhook payload
export const createFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId, email, name, image }) => {
    // Check if user already exists (idempotent)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (existingUser) {
      return existingUser._id;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      clerkId,
      email,
      name,
      image,
      onboardingComplete: false,
      setupStatus: "not_started",
      createdAt: Date.now(),
    });

    return userId;
  },
});

// Called by Clerk webhook - updates user profile from webhook payload
export const updateFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId, email, name, image }) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!existingUser) {
      // User doesn't exist - ignore (might have been deleted)
      return;
    }

    // Update user profile fields
    await ctx.db.patch(existingUser._id, {
      ...(email !== undefined && { email }),
      ...(name !== undefined && { name }),
      ...(image !== undefined && { image }),
    });
  },
});

// Get user by email address (for dev reset scripts)
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
  },
});

// Get current user from Clerk identity
export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Look up user by Clerk subject ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    return user;
  },
});

// Create or get user from Clerk identity (called on first sign-in)
export const createOrGetUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existingUser) return existingUser._id;

    // Create new user from Clerk identity - setup not started
    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email,
      name: identity.name,
      image: identity.pictureUrl,
      // Legacy field (kept for migration)
      onboardingComplete: false,
      // New setup mode - not started yet
      setupStatus: "not_started",
      createdAt: Date.now(),
    });

    return userId;
  },
});

export const updateOnboarding = mutation({
  args: {
    productName: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    userTerminology: v.optional(v.string()),
    hasMultiUserAccounts: v.optional(v.boolean()),
    businessType: v.optional(v.string()),
    revenueModels: v.optional(v.array(v.string())),
    role: v.optional(v.string()),
    onboardingStep: v.optional(v.string()),
    onboardingComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, args);
  },
});

// Dev helper: Reset setup to test the flow again
export const resetSetup = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Reset setup status
    await ctx.db.patch(user._id, {
      setupStatus: "not_started",
      setupCompletedAt: undefined,
      // Also reset legacy flag for clean testing
      onboardingComplete: false,
    });
  },
});

// Legacy: Reset onboarding (deprecated, use resetSetup instead)
export const resetOnboarding = mutation({
  args: {
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let user;

    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();
    } else if (args.email) {
      user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", args.email))
        .first();
    }

    if (!user) throw new Error("User not found - provide email if using dashboard");

    await ctx.db.patch(user._id, {
      onboardingComplete: false,
      onboardingStep: undefined,
      productName: undefined,
      websiteUrl: undefined,
      userTerminology: undefined,
      hasMultiUserAccounts: undefined,
      businessType: undefined,
      revenueModels: undefined,
      role: undefined,
      // Also reset setup for full reset
      setupStatus: "not_started",
      setupCompletedAt: undefined,
    });
  },
});
