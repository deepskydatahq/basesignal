import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import * as crypto from "crypto";

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a token for secure storage
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a new auth token for MCP/API access
 * Returns both the token (to display once) and the stored hash
 */
export const createToken = mutation({
  args: {
    name: v.string(),                    // e.g., "MCP Client", "API Key"
    expirationDays: v.optional(v.number()), // Default: 90 days
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Generate token
    const plainToken = generateToken();
    const hashedToken = hashToken(plainToken);

    // Calculate expiration
    const expirationDays = args.expirationDays ?? 90;
    const expiresAt = Date.now() + expirationDays * 24 * 60 * 60 * 1000;

    // Store hashed token
    const tokenId = await ctx.db.insert("authTokens", {
      userId: user._id,
      token: hashedToken,
      name: args.name,
      status: "active",
      expiresAt,
      createdAt: Date.now(),
    });

    return {
      tokenId,
      // Return plain token only once - user must save it
      token: plainToken,
      expiresAt,
      message: "Save this token - you won't see it again!",
    };
  },
});

/**
 * Validate a token and return the user if valid
 * Used by MCP connections and API calls
 * Uses action instead of query to allow updating lastUsedAt
 */
export const validateToken = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const hashedToken = hashToken(args.token);

    const tokenRecord = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", hashedToken))
      .first();

    if (!tokenRecord) {
      throw new Error("Invalid token");
    }

    // Check if token is revoked
    if (tokenRecord.status === "revoked") {
      throw new Error("Token has been revoked");
    }

    // Check if token has expired
    if (tokenRecord.expiresAt < Date.now()) {
      throw new Error("Token has expired");
    }

    // Get user info
    const user = await ctx.db.get(tokenRecord.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Update last used timestamp
    await ctx.db.patch(tokenRecord._id, {
      lastUsedAt: Date.now(),
    });

    // Return user identity for MCP context
    return {
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      tokenId: tokenRecord._id,
    };
  },
});

/**
 * List all active tokens for the current user
 */
export const listTokens = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const tokens = await ctx.db
      .query("authTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return tokens.map((token) => ({
      _id: token._id,
      name: token.name,
      status: token.status,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
      // Never return the hashed token
    }));
  },
});

/**
 * Revoke a token (prevent future use)
 */
export const revokeToken = mutation({
  args: {
    tokenId: v.id("authTokens"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Get token and verify ownership
    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");
    if (token.userId !== user._id) {
      throw new Error("Not authorized to revoke this token");
    }

    // Revoke token
    await ctx.db.patch(args.tokenId, {
      status: "revoked",
    });

    return { success: true };
  },
});

/**
 * Delete a token record (cleanup after expiration)
 */
export const deleteToken = mutation({
  args: {
    tokenId: v.id("authTokens"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Get token and verify ownership
    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");
    if (token.userId !== user._id) {
      throw new Error("Not authorized to delete this token");
    }

    // Delete token
    await ctx.db.delete(args.tokenId);

    return { success: true };
  },
});

/**
 * Get token by ID (for viewing details, but not the hashed value)
 */
export const getToken = query({
  args: {
    tokenId: v.id("authTokens"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return null;

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.userId !== user._id) return null;

    return {
      _id: token._id,
      name: token.name,
      status: token.status,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
    };
  },
});
