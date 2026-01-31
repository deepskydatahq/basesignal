/**
 * MCP Authentication Module
 * Handles user registration and login for MCP clients
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  hashPassword,
  verifyPassword,
  createJWT,
  verifyJWT,
  getJWTSecret,
  getTokenExpirationTime,
} from "./authUtils";

/**
 * Create a new user with email and password
 * Used for MCP client registration
 */
export const createUserWithPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }) => {
    // Validate email format
    if (!email.includes("@")) {
      throw new Error("Invalid email format");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    if (existingUser) {
      throw new Error("User already exists with this email");
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const userId = await ctx.db.insert("users", {
      email,
      hashedPassword,
      name: email.split("@")[0], // Use email prefix as initial name
      onboardingComplete: false,
      setupStatus: "not_started",
      createdAt: Date.now(),
    });

    // Create JWT token
    const secret = getJWTSecret();
    const token = await createJWT(userId, secret);
    const expiresAt = getTokenExpirationTime();

    // Store token in authTokens table
    await ctx.db.insert("authTokens", {
      userId,
      token,
      name: "MCP Client Registration",
      status: "active",
      expiresAt,
      createdAt: Date.now(),
    });

    return {
      userId,
      token,
      expiresAt,
    };
  },
});

/**
 * Login user with email and password
 * Returns JWT token if credentials are valid
 */
export const loginUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.hashedPassword) {
      throw new Error("User does not have password-based authentication enabled");
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, user.hashedPassword);
    if (!passwordMatch) {
      throw new Error("Invalid password");
    }

    // Create JWT token
    const secret = getJWTSecret();
    const token = await createJWT(user._id, secret);
    const expiresAt = getTokenExpirationTime();

    // Store token in authTokens table
    await ctx.db.insert("authTokens", {
      userId: user._id,
      token,
      name: "MCP Client Login",
      status: "active",
      expiresAt,
      createdAt: Date.now(),
    });

    return {
      userId: user._id,
      token,
      expiresAt,
    };
  },
});

/**
 * Logout user by invalidating their token
 */
export const logoutUser = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    // Find and revoke the token
    const authToken = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (authToken) {
      await ctx.db.patch(authToken._id, {
        status: "revoked",
        lastUsedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Validate a token and return user info
 * This query checks if a token is valid and not expired
 */
export const validateToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    const secret = getJWTSecret();
    const tokenData = await verifyJWT(token, secret);

    if (!tokenData.isValid) {
      return {
        isValid: false,
        userId: null,
        isExpired: false,
      };
    }

    if (tokenData.isExpired) {
      return {
        isValid: false,
        userId: null,
        isExpired: true,
      };
    }

    // Check if token is in authTokens table and active
    const authToken = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!authToken) {
      return {
        isValid: false,
        userId: null,
        isExpired: false,
      };
    }

    // Check if token is revoked
    if (authToken.status === "revoked") {
      return {
        isValid: false,
        userId: null,
        isExpired: false,
      };
    }

    // Check if token is not expired in DB
    if (authToken.expiresAt < Date.now()) {
      return {
        isValid: false,
        userId: null,
        isExpired: true,
      };
    }

    return {
      isValid: true,
      userId: tokenData.userId,
      isExpired: false,
    };
  },
});

/**
 * Get current authenticated user from token
 * Returns user info if token is valid
 */
export const getCurrentUser = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    const secret = getJWTSecret();
    const tokenData = await verifyJWT(token, secret);

    if (!tokenData.isValid || tokenData.isExpired) {
      return null;
    }

    // Check if token exists in authTokens table and is active
    const authToken = await ctx.db
      .query("authTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!authToken) {
      return null;
    }

    // Check if token is revoked
    if (authToken.status === "revoked") {
      return null;
    }

    // Check if token is expired
    if (authToken.expiresAt < Date.now()) {
      return null;
    }

    // Get user info
    const user = await ctx.db.get(tokenData.userId);
    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  },
});
