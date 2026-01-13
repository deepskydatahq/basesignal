import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get verification configuration from environment
export const getConfig = query({
  args: {},
  handler: async () => {
    const mode = process.env.COMMUNITY_VERIFICATION_MODE || "honor";
    const discordInvite = process.env.COMMUNITY_DISCORD_INVITE || "";
    return { mode, discordInvite };
  },
});

// Verify community join
export const verify = mutation({
  args: {
    method: v.string(), // "honor" | "magic_code" | "email_fallback"
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Validate magic code if applicable
    if (args.method === "magic_code") {
      const expectedCode = process.env.COMMUNITY_MAGIC_CODE;
      if (!expectedCode || args.code !== expectedCode) {
        throw new Error("Invalid code");
      }
    }

    const now = Date.now();

    // Update user record
    await ctx.db.patch(user._id, {
      communityJoined: args.method !== "email_fallback",
      communityJoinedAt: now,
      communityJoinMethod: args.method,
    });

    // Update setup progress
    const progress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (progress) {
      await ctx.db.patch(progress._id, {
        communityJoinStatus:
          args.method === "email_fallback" ? "skipped_email" : "verified",
        lastActiveAt: now,
      });
    }

    return { success: true };
  },
});
