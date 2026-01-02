import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
