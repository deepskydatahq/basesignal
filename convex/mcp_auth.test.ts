/**
 * Tests for MCP Authentication
 */

import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("MCP Authentication", () => {
  describe("createUserWithPassword", () => {
    it("should create a new user with email and password", async () => {
      const t = convexTest(schema);

      const result = await t.mutation(api.mcp_auth.createUserWithPassword, {
        email: "test@example.com",
        password: "password123",
      });

      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should fail if user already exists", async () => {
      const t = convexTest(schema);

      // Create first user
      await t.mutation(api.mcp_auth.createUserWithPassword, {
        email: "duplicate@example.com",
        password: "password123",
      });

      // Try to create same user again
      await expect(
        t.mutation(api.mcp_auth.createUserWithPassword, {
          email: "duplicate@example.com",
          password: "password456",
        })
      ).rejects.toThrow("User already exists with this email");
    });

    it("should fail with invalid email", async () => {
      const t = convexTest(schema);

      await expect(
        t.mutation(api.mcp_auth.createUserWithPassword, {
          email: "notanemail",
          password: "password123",
        })
      ).rejects.toThrow("Invalid email format");
    });

    it("should fail with weak password", async () => {
      const t = convexTest(schema);

      await expect(
        t.mutation(api.mcp_auth.createUserWithPassword, {
          email: "test@example.com",
          password: "pass",
        })
      ).rejects.toThrow("Password must be at least 6 characters");
    });

    it("should store token in authTokens table", async () => {
      const t = convexTest(schema);

      const result = await t.mutation(api.mcp_auth.createUserWithPassword, {
        email: "tokentest@example.com",
        password: "password123",
      });

      // Verify token is valid
      const tokenValidation = await t.query(api.mcp_auth.validateToken, {
        token: result.token,
      });

      expect(tokenValidation.isValid).toBe(true);
      expect(tokenValidation.userId).toBe(result.userId);
      expect(tokenValidation.isExpired).toBe(false);
    });
  });

  describe("loginUser", () => {
    it("should login user with correct credentials", async () => {
      const t = convexTest(schema);

      // Create user first
      await t.mutation(api.mcp_auth.createUserWithPassword, {
        email: "login@example.com",
        password: "password123",
      });

      // Login with correct credentials
      const result = await t.mutation(api.mcp_auth.loginUser, {
        email: "login@example.com",
        password: "password123",
      });

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should fail with incorrect password", async () => {
      const t = convexTest(schema);

      // Create user first
      await t.mutation(api.mcp_auth.createUserWithPassword, {
        email: "login2@example.com",
        password: "password123",
      });

      // Try to login with wrong password
      await expect(
        t.mutation(api.mcp_auth.loginUser, {
          email: "login2@example.com",
          password: "wrongpassword",
        })
      ).rejects.toThrow("Invalid password");
    });

    it("should fail if user does not exist", async () => {
      const t = convexTest(schema);

      await expect(
        t.mutation(api.mcp_auth.loginUser, {
          email: "nonexistent@example.com",
          password: "password123",
        })
      ).rejects.toThrow("User not found");
    });

    it("should create a new token on each login", async () => {
      const t = convexTest(schema);

      // Create user
      await t.mutation(api.mcp_auth.createUserWithPassword, {
        email: "multilogin@example.com",
        password: "password123",
      });

      // Login twice
      const result1 = await t.mutation(api.mcp_auth.loginUser, {
        email: "multilogin@example.com",
        password: "password123",
      });

      const result2 = await t.mutation(api.mcp_auth.loginUser, {
        email: "multilogin@example.com",
        password: "password123",
      });

      // Tokens should be different
      expect(result1.token).not.toBe(result2.token);

      // Both tokens should be valid
      const validation1 = await t.query(api.mcp_auth.validateToken, {
        token: result1.token,
      });
      const validation2 = await t.query(api.mcp_auth.validateToken, {
        token: result2.token,
      });

      expect(validation1.isValid).toBe(true);
      expect(validation2.isValid).toBe(true);
    });
  });

  describe("logoutUser", () => {
    it("should invalidate token on logout", async () => {
      const t = convexTest(schema);

      // Create and login user
      const createResult = await t.mutation(
        api.mcp_auth.createUserWithPassword,
        {
          email: "logout@example.com",
          password: "password123",
        }
      );

      // Verify token is valid before logout
      const validationBefore = await t.query(api.mcp_auth.validateToken, {
        token: createResult.token,
      });
      expect(validationBefore.isValid).toBe(true);

      // Logout
      await t.mutation(api.mcp_auth.logoutUser, {
        token: createResult.token,
      });

      // Verify token is now invalid
      const validationAfter = await t.query(api.mcp_auth.validateToken, {
        token: createResult.token,
      });
      expect(validationAfter.isValid).toBe(false);
    });

    it("should handle logout with non-existent token", async () => {
      const t = convexTest(schema);

      // This should not throw an error
      const result = await t.mutation(api.mcp_auth.logoutUser, {
        token: "nonexistent-token-12345",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("validateToken", () => {
    it("should return false for invalid token", async () => {
      const t = convexTest(schema);

      const result = await t.query(api.mcp_auth.validateToken, {
        token: "invalid-token",
      });

      expect(result.isValid).toBe(false);
      expect(result.userId).toBeNull();
      expect(result.isExpired).toBe(false);
    });

    it("should return false for malformed token", async () => {
      const t = convexTest(schema);

      const result = await t.query(api.mcp_auth.validateToken, {
        token: "malformed.token",
      });

      expect(result.isValid).toBe(false);
      expect(result.userId).toBeNull();
    });

    it("should return true for valid token", async () => {
      const t = convexTest(schema);

      // Create user
      const createResult = await t.mutation(
        api.mcp_auth.createUserWithPassword,
        {
          email: "validate@example.com",
          password: "password123",
        }
      );

      // Validate token
      const result = await t.query(api.mcp_auth.validateToken, {
        token: createResult.token,
      });

      expect(result.isValid).toBe(true);
      expect(result.userId).toBe(createResult.userId);
      expect(result.isExpired).toBe(false);
    });
  });

  describe("getCurrentUser", () => {
    it("should return user info for valid token", async () => {
      const t = convexTest(schema);

      // Create user
      const createResult = await t.mutation(
        api.mcp_auth.createUserWithPassword,
        {
          email: "getuser@example.com",
          password: "password123",
        }
      );

      // Get current user
      const user = await t.query(api.mcp_auth.getCurrentUser, {
        token: createResult.token,
      });

      expect(user).toBeDefined();
      expect(user?._id).toBe(createResult.userId);
      expect(user?.email).toBe("getuser@example.com");
      expect(user?.name).toBeDefined();
    });

    it("should return null for invalid token", async () => {
      const t = convexTest(schema);

      const user = await t.query(api.mcp_auth.getCurrentUser, {
        token: "invalid-token",
      });

      expect(user).toBeNull();
    });

    it("should return null for logged out user", async () => {
      const t = convexTest(schema);

      // Create user
      const createResult = await t.mutation(
        api.mcp_auth.createUserWithPassword,
        {
          email: "getuser2@example.com",
          password: "password123",
        }
      );

      // Logout
      await t.mutation(api.mcp_auth.logoutUser, {
        token: createResult.token,
      });

      // Try to get current user
      const user = await t.query(api.mcp_auth.getCurrentUser, {
        token: createResult.token,
      });

      expect(user).toBeNull();
    });

    it("should not return sensitive user fields", async () => {
      const t = convexTest(schema);

      // Create user
      const createResult = await t.mutation(
        api.mcp_auth.createUserWithPassword,
        {
          email: "sensitive@example.com",
          password: "password123",
        }
      );

      // Get current user
      const user = await t.query(api.mcp_auth.getCurrentUser, {
        token: createResult.token,
      });

      // Verify sensitive fields are not returned
      expect(user?.hashedPassword).toBeUndefined();
      expect((user as any)?.clerkId).toBeUndefined();
    });
  });

  describe("User Identity Availability", () => {
    it("should have user identity available to getCurrentUser", async () => {
      const t = convexTest(schema);

      // Create user
      const createResult = await t.mutation(
        api.mcp_auth.createUserWithPassword,
        {
          email: "identity@example.com",
          password: "password123",
        }
      );

      // Get current user
      const user = await t.query(api.mcp_auth.getCurrentUser, {
        token: createResult.token,
      });

      // Verify user identity is available
      expect(user).toBeDefined();
      expect(user?._id).toBe(createResult.userId);
      expect(user?.email).toBe("identity@example.com");
    });
  });

  describe("Token Reuse", () => {
    it("should reuse token across multiple requests", async () => {
      const t = convexTest(schema);

      // Create user
      const createResult = await t.mutation(
        api.mcp_auth.createUserWithPassword,
        {
          email: "reuse@example.com",
          password: "password123",
        }
      );

      const token = createResult.token;

      // Use token multiple times
      const user1 = await t.query(api.mcp_auth.getCurrentUser, {
        token,
      });

      const validation1 = await t.query(api.mcp_auth.validateToken, {
        token,
      });

      const user2 = await t.query(api.mcp_auth.getCurrentUser, {
        token,
      });

      // All requests should succeed and return same user
      expect(user1?._id).toBe(user2?._id);
      expect(validation1.isValid).toBe(true);
    });
  });

  describe("First Connection Flow", () => {
    it("should support create and login flow on first connection", async () => {
      const t = convexTest(schema);

      // First connection - create account
      const createResult = await t.mutation(
        api.mcp_auth.createUserWithPassword,
        {
          email: "firstconnect@example.com",
          password: "securepass123",
        }
      );

      expect(createResult.token).toBeDefined();

      // Verify token works
      const user = await t.query(api.mcp_auth.getCurrentUser, {
        token: createResult.token,
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe("firstconnect@example.com");
    });

    it("should support login flow on subsequent connections", async () => {
      const t = convexTest(schema);

      // Create account
      const email = "subsequent@example.com";
      const password = "securepass123";

      await t.mutation(api.mcp_auth.createUserWithPassword, {
        email,
        password,
      });

      // Subsequent connection - login
      const loginResult = await t.mutation(api.mcp_auth.loginUser, {
        email,
        password,
      });

      expect(loginResult.token).toBeDefined();

      // Verify token works
      const user = await t.query(api.mcp_auth.getCurrentUser, {
        token: loginResult.token,
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });
  });
});
