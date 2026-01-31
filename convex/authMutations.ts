import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hashPassword, verifyPassword } from "./passwordUtils";
import { createToken, verifyToken, getTokenExpirationTime } from "./jwtUtils";

/**
 * Create a new user with email and password
 */
export const createUserWithPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error("User already exists with this email");
    }

    // Validate email format
    if (!args.email || !args.email.includes("@")) {
      throw new Error("Invalid email format");
    }

    // Validate password strength (minimum 8 characters)
    if (!args.password || args.password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    // Hash the password
    const hashedPassword = await hashPassword(args.password);

    // Create user
    const userId = await ctx.db.insert("users", {
      email: args.email,
      hashedPassword,
      name: args.name,
      createdAt: Date.now(),
    });

    // Create and store auth token
    const token = createToken(userId, args.email);
    const expiresAt = getTokenExpirationTime();

    await ctx.db.insert("authTokens", {
      userId,
      token,
      expiresAt,
      createdAt: Date.now(),
    });

    return { userId, token, email: args.email };
  },
});

/**
 * Log in a user with email and password
 */
export const loginUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Check if user has a password (not Clerk-only user)
    if (!user.hashedPassword) {
      throw new Error("User was created with SSO/OAuth. Cannot use password login");
    }

    // Verify password
    const passwordValid = await verifyPassword(args.password, user.hashedPassword);
    if (!passwordValid) {
      throw new Error("Invalid email or password");
    }

    // Create and store auth token
    const token = createToken(user._id, user.email || args.email);
    const expiresAt = getTokenExpirationTime();

    await ctx.db.insert("authTokens", {
      userId: user._id,
      token,
      expiresAt,
      createdAt: Date.now(),
    });

    return {
      userId: user._id,
      token,
      email: user.email,
    };
  },
});

/**
 * Revoke an auth token
 */
export const logoutUser = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the token record
    const tokenRecord = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!tokenRecord) {
      throw new Error("Token not found");
    }

    // Mark token as revoked
    await ctx.db.patch(tokenRecord._id, {
      revokedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Validate an auth token and return user info
 */
export const validateToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify JWT signature and expiration
    const payload = verifyToken(args.token);
    if (!payload) {
      throw new Error("Invalid or expired token");
    }

    // Check if token is revoked
    const tokenRecord = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!tokenRecord || tokenRecord.revokedAt) {
      throw new Error("Token has been revoked");
    }

    // Check token expiration
    if (tokenRecord.expiresAt < Date.now()) {
      throw new Error("Token has expired");
    }

    // Get user info
    const user = await ctx.db.get(tokenRecord.userId);
    if (!user) {
      throw new Error("User not found");
    }

    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      isValid: true,
    };
  },
});

/**
 * Get current user info using a token
 */
export const getCurrentUser = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify JWT signature
    const payload = verifyToken(args.token);
    if (!payload) {
      return null;
    }

    // Check if token is revoked
    const tokenRecord = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!tokenRecord || tokenRecord.revokedAt) {
      return null;
    }

    // Check token expiration
    if (tokenRecord.expiresAt < Date.now()) {
      return null;
    }

    // Get user info
    const user = await ctx.db.get(tokenRecord.userId);
    if (!user) {
      return null;
    }

    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  },
});
