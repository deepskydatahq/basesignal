import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hashPassword, verifyPassword, validatePasswordStrength } from "./password";
import { createJWT, verifyJWT } from "./jwt";

// Create a new user with email and password
export const createUserWithPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { email, password, name }) => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // Validate password strength
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.toLowerCase()))
      .first();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const userId = await ctx.db.insert("users", {
      email: email.toLowerCase(),
      name: name || undefined,
      hashedPassword,
      passwordCreatedAt: Date.now(),
      setupStatus: "not_started",
      createdAt: Date.now(),
    });

    // Create JWT token
    const token = await createJWT(userId.toString(), 30); // 30-day expiration

    // Store auth token
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    await ctx.db.insert("authTokens", {
      userId,
      token,
      expiresAt,
      createdAt: Date.now(),
    });

    return {
      userId,
      email: email.toLowerCase(),
      token,
      expiresAt,
    };
  },
});

// Login with email and password
export const loginUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.toLowerCase()))
      .first();

    if (!user || !user.hashedPassword) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isValid = await verifyPassword(password, user.hashedPassword);
    if (!isValid) {
      throw new Error("Invalid email or password");
    }

    // Create JWT token
    const token = await createJWT(user._id.toString(), 30); // 30-day expiration

    // Store auth token
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    await ctx.db.insert("authTokens", {
      userId: user._id,
      token,
      expiresAt,
      createdAt: Date.now(),
    });

    return {
      userId: user._id,
      email: user.email,
      token,
      expiresAt,
    };
  },
});

// Validate token and return user ID if valid
export const validateToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    // Verify JWT signature and expiration
    const payload = await verifyJWT(token);
    if (!payload) {
      return null;
    }

    // Check if token exists in database and hasn't been revoked
    const authToken = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!authToken || authToken.revokedAt) {
      return null;
    }

    // Check if token is expired
    if (authToken.expiresAt < Date.now()) {
      return null;
    }

    // Note: Update last used timestamp in mutation if needed
    // Skip in query to avoid side effects

    return {
      userId: authToken.userId,
      token,
    };
  },
});

// Get current user from token
export const getCurrentUser = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    // Verify JWT signature and expiration
    const payload = await verifyJWT(token);
    if (!payload) {
      return null;
    }

    // Check if token exists in database and hasn't been revoked
    const authToken = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!authToken || authToken.revokedAt) {
      return null;
    }

    // Check if token is expired
    if (authToken.expiresAt < Date.now()) {
      return null;
    }

    // Get user data
    const user = await ctx.db.get(authToken.userId);
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

// Logout by revoking token
export const logoutUser = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    // Find and revoke token
    const authToken = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (authToken) {
      await ctx.db.patch(authToken._id, {
        revokedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Refresh token (create new token for valid existing token)
export const refreshToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    // Check if token exists in database and hasn't been revoked
    const authToken = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!authToken) {
      throw new Error("Invalid token");
    }

    if (authToken.revokedAt) {
      throw new Error("Token has been revoked");
    }

    if (authToken.expiresAt < Date.now()) {
      throw new Error("Token has expired");
    }

    // Verify JWT signature is still valid
    const payload = await verifyJWT(token);
    if (!payload) {
      throw new Error("Invalid token signature");
    }

    // Create new JWT token
    const newToken = await createJWT(authToken.userId.toString(), 30);

    // Store new auth token
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await ctx.db.insert("authTokens", {
      userId: authToken.userId,
      token: newToken,
      expiresAt,
      createdAt: Date.now(),
    });

    // Optionally revoke old token
    await ctx.db.patch(authToken._id, {
      revokedAt: Date.now(),
    });

    return {
      token: newToken,
      expiresAt,
    };
  },
});

// Change password for authenticated user
export const changePassword = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { token, currentPassword, newPassword }) => {
    // Check if token exists in database and hasn't been revoked
    const authToken = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!authToken || authToken.revokedAt) {
      throw new Error("Invalid token");
    }

    // Get user
    const user = await ctx.db.get(authToken.userId);
    if (!user || !user.hashedPassword) {
      throw new Error("User not found");
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.hashedPassword);
    if (!isValid) {
      throw new Error("Current password is incorrect");
    }

    // Validate new password strength
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      throw new Error(passwordError);
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    await ctx.db.patch(user._id, {
      hashedPassword,
      passwordCreatedAt: Date.now(),
    });

    // Revoke all existing tokens
    const tokens = await ctx.db
      .query("authTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const t of tokens) {
      if (!t.revokedAt) {
        await ctx.db.patch(t._id, {
          revokedAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});
