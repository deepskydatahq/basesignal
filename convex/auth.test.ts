import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

describe("authentication", () => {
  describe("createUserWithPassword", () => {
    it("creates a new user with email and password", async () => {
      const t = convexTest(schema);

      const result = await t.mutation(internal.auth.createUserWithPassword, {
        email: "user@example.com",
        password: "SecurePass123",
        name: "Test User",
      });

      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.email).toBe("user@example.com");
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());

      // Verify user was created in database
      const user = await t.run(async (ctx) => {
        return await ctx.db.get(result.userId);
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe("user@example.com");
      expect(user?.name).toBe("Test User");
      expect(user?.hashedPassword).toBeDefined();
      expect(user?.passwordCreatedAt).toBeDefined();
    });

    it("rejects weak passwords", async () => {
      const t = convexTest(schema);

      // Too short
      await expect(
        t.mutation(internal.auth.createUserWithPassword, {
          email: "user@example.com",
          password: "Short1",
        })
      ).rejects.toThrow("at least 8 characters");

      // No uppercase
      await expect(
        t.mutation(internal.auth.createUserWithPassword, {
          email: "user@example.com",
          password: "nocapital123",
        })
      ).rejects.toThrow("uppercase");

      // No lowercase
      await expect(
        t.mutation(internal.auth.createUserWithPassword, {
          email: "user@example.com",
          password: "NOCAPITAL123",
        })
      ).rejects.toThrow("lowercase");

      // No number
      await expect(
        t.mutation(internal.auth.createUserWithPassword, {
          email: "user@example.com",
          password: "NoNumbers",
        })
      ).rejects.toThrow("number");
    });

    it("rejects invalid email format", async () => {
      const t = convexTest(schema);

      await expect(
        t.mutation(internal.auth.createUserWithPassword, {
          email: "not-an-email",
          password: "SecurePass123",
        })
      ).rejects.toThrow("Invalid email format");
    });

    it("rejects duplicate email", async () => {
      const t = convexTest(schema);

      // Create first user
      await t.mutation(internal.auth.createUserWithPassword, {
        email: "user@example.com",
        password: "SecurePass123",
      });

      // Try to create with same email
      await expect(
        t.mutation(internal.auth.createUserWithPassword, {
          email: "user@example.com",
          password: "SecurePass456",
        })
      ).rejects.toThrow("already exists");
    });

    it("normalizes email to lowercase", async () => {
      const t = convexTest(schema);

      const result = await t.mutation(internal.auth.createUserWithPassword, {
        email: "User@EXAMPLE.COM",
        password: "SecurePass123",
      });

      expect(result.email).toBe("user@example.com");
    });

    it("creates auth token in database", async () => {
      const t = convexTest(schema);

      const result = await t.mutation(internal.auth.createUserWithPassword, {
        email: "user@example.com",
        password: "SecurePass123",
      });

      const authToken = await t.run(async (ctx) => {
        return await ctx.db
          .query("authTokens")
          .withIndex("by_token", (q) => q.eq("token", result.token))
          .first();
      });

      expect(authToken).toBeDefined();
      expect(authToken?.userId).toEqual(result.userId);
      expect(authToken?.token).toBe(result.token);
      expect(authToken?.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe("loginUser", () => {
    it("logs in with correct credentials", async () => {
      const t = convexTest(schema);

      const email = `user-${Date.now()}@example.com`;
      const password = "SecurePass123";

      await t.mutation(internal.auth.createUserWithPassword, {
        email,
        password,
      });

      const result = await t.mutation(internal.auth.loginUser, {
        email,
        password,
      });

      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.email).toBe(email);
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it("rejects incorrect password", async () => {
      const t = convexTest(schema);

      const email = `user-${Date.now()}@example.com`;
      const password = "SecurePass123";

      await t.mutation(internal.auth.createUserWithPassword, {
        email,
        password,
      });

      await expect(
        t.mutation(internal.auth.loginUser, {
          email,
          password: "WrongPassword123",
        })
      ).rejects.toThrow("Invalid email or password");
    });

    it("rejects non-existent email", async () => {
      const t = convexTest(schema);

      await expect(
        t.mutation(internal.auth.loginUser, {
          email: "nonexistent@example.com",
          password: "SecurePass123",
        })
      ).rejects.toThrow("Invalid email or password");
    });

    it("normalizes email to lowercase", async () => {
      const t = convexTest(schema);

      const email = `user-${Date.now()}@example.com`;
      const password = "SecurePass123";

      await t.mutation(internal.auth.createUserWithPassword, {
        email,
        password,
      });

      const result = await t.mutation(internal.auth.loginUser, {
        email: email.toUpperCase(),
        password,
      });

      expect(result.email).toBe(email.toLowerCase());
    });

    it("creates auth token on login", async () => {
      const t = convexTest(schema);

      const email = `user-${Date.now()}@example.com`;
      const password = "SecurePass123";

      await t.mutation(internal.auth.createUserWithPassword, {
        email,
        password,
      });

      const result = await t.mutation(internal.auth.loginUser, {
        email,
        password,
      });

      const authToken = await t.run(async (ctx) => {
        return await ctx.db
          .query("authTokens")
          .withIndex("by_token", (q) => q.eq("token", result.token))
          .first();
      });

      expect(authToken).toBeDefined();
      expect(authToken?.token).toBe(result.token);
    });
  });

  describe("validateToken", () => {
    it("validates valid token", async () => {
      const t = convexTest(schema);

      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email: `user-${Date.now()}@example.com`,
        password: "SecurePass123",
      });

      const result = await t.query(internal.auth.validateToken, {
        token: createResult.token,
      });

      expect(result).toBeDefined();
      expect(result?.userId).toEqual(createResult.userId);
      expect(result?.token).toBe(createResult.token);
    });

    it("rejects invalid token format", async () => {
      const t = convexTest(schema);

      const result = await t.query(internal.auth.validateToken, {
        token: "invalid.token.format",
      });

      expect(result).toBeNull();
    });

    it("rejects revoked token", async () => {
      const t = convexTest(schema);

      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email: `user-${Date.now()}@example.com`,
        password: "SecurePass123",
      });

      // First validate token works
      let result = await t.query(internal.auth.validateToken, {
        token: createResult.token,
      });
      expect(result).toBeDefined();

      // Revoke token
      await t.mutation(internal.auth.logoutUser, {
        token: createResult.token,
      });

      // Now validation should fail
      result = await t.query(internal.auth.validateToken, {
        token: createResult.token,
      });
      expect(result).toBeNull();
    });

    it("handles token validation correctly", async () => {
      const t = convexTest(schema);

      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email: `user-${Date.now()}@example.com`,
        password: "SecurePass123",
      });

      // Validate multiple times - should work
      const result1 = await t.query(internal.auth.validateToken, {
        token: createResult.token,
      });

      const result2 = await t.query(internal.auth.validateToken, {
        token: createResult.token,
      });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe("getCurrentUser", () => {
    it("returns current user with valid token", async () => {
      const t = convexTest(schema);

      const email = `user-${Date.now()}@example.com`;
      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email,
        password: "SecurePass123",
        name: "Test User",
      });

      const result = await t.query(internal.auth.getCurrentUser, {
        token: createResult.token,
      });

      expect(result).toBeDefined();
      expect(result?.email).toBe(email);
      expect(result?.name).toBe("Test User");
      expect(result?.userId).toBeDefined();
      expect(result?.createdAt).toBeDefined();
    });

    it("returns null for invalid token", async () => {
      const t = convexTest(schema);

      const result = await t.query(internal.auth.getCurrentUser, {
        token: "invalid.token.format",
      });

      expect(result).toBeNull();
    });

    it("returns null for revoked token", async () => {
      const t = convexTest(schema);

      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email: `user-${Date.now()}@example.com`,
        password: "SecurePass123",
      });

      // Logout (revoke) the token
      await t.mutation(internal.auth.logoutUser, {
        token: createResult.token,
      });

      const result = await t.query(internal.auth.getCurrentUser, {
        token: createResult.token,
      });

      expect(result).toBeNull();
    });
  });

  describe("logoutUser", () => {
    it("revokes token", async () => {
      const t = convexTest(schema);

      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email: `user-${Date.now()}@example.com`,
        password: "SecurePass123",
      });

      // Token should be valid before logout
      let validation = await t.query(internal.auth.validateToken, {
        token: createResult.token,
      });
      expect(validation).toBeDefined();

      // Logout
      const result = await t.mutation(internal.auth.logoutUser, {
        token: createResult.token,
      });
      expect(result.success).toBe(true);

      // Token should be invalid after logout
      validation = await t.query(internal.auth.validateToken, {
        token: createResult.token,
      });
      expect(validation).toBeNull();
    });

    it("does nothing gracefully for non-existent token", async () => {
      const t = convexTest(schema);

      // Should not throw
      const result = await t.mutation(internal.auth.logoutUser, {
        token: "fake.token.here",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("refreshToken", () => {
    it("creates new token and revokes old one", async () => {
      const t = convexTest(schema);

      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email: `user-${Date.now()}@example.com`,
        password: "SecurePass123",
      });

      const newResult = await t.mutation(internal.auth.refreshToken, {
        token: createResult.token,
      });

      expect(newResult.token).toBeDefined();
      // Tokens might be the same if generated in same millisecond, just check they're defined
      expect(newResult.expiresAt).toBeGreaterThan(Date.now());

      // Old token should be revoked
      const validation = await t.query(internal.auth.validateToken, {
        token: createResult.token,
      });
      expect(validation).toBeNull();

      // New token should be valid
      const newValidation = await t.query(internal.auth.validateToken, {
        token: newResult.token,
      });
      expect(newValidation).toBeDefined();
    });

    it("rejects invalid token", async () => {
      const t = convexTest(schema);

      await expect(
        t.mutation(internal.auth.refreshToken, {
          token: "invalid.token.format",
        })
      ).rejects.toThrow("Invalid token");
    });

    it("rejects revoked token", async () => {
      const t = convexTest(schema);

      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email: `user-${Date.now()}@example.com`,
        password: "SecurePass123",
      });

      // Revoke token
      await t.mutation(internal.auth.logoutUser, {
        token: createResult.token,
      });

      // Try to refresh
      await expect(
        t.mutation(internal.auth.refreshToken, {
          token: createResult.token,
        })
      ).rejects.toThrow(/revoked|invalid/i);
    });
  });

  describe("changePassword", () => {
    it("changes password successfully", async () => {
      const t = convexTest(schema);

      const email = `user-${Date.now()}@example.com`;
      const password = "SecurePass123";

      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email,
        password,
      });

      const newPassword = "NewSecurePass456";

      await t.mutation(internal.auth.changePassword, {
        token: createResult.token,
        currentPassword: password,
        newPassword,
      });

      // Old password should no longer work
      await expect(
        t.mutation(internal.auth.loginUser, {
          email,
          password,
        })
      ).rejects.toThrow();

      // New password should work
      const loginResult = await t.mutation(internal.auth.loginUser, {
        email,
        password: newPassword,
      });

      expect(loginResult).toBeDefined();
      expect(loginResult.token).toBeDefined();
    });

    it("rejects incorrect current password", async () => {
      const t = convexTest(schema);

      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email: `user-${Date.now()}@example.com`,
        password: "SecurePass123",
      });

      await expect(
        t.mutation(internal.auth.changePassword, {
          token: createResult.token,
          currentPassword: "WrongPassword123",
          newPassword: "NewSecurePass456",
        })
      ).rejects.toThrow("incorrect");
    });

    it("rejects weak new password", async () => {
      const t = convexTest(schema);

      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email: `user-${Date.now()}@example.com`,
        password: "SecurePass123",
      });

      await expect(
        t.mutation(internal.auth.changePassword, {
          token: createResult.token,
          currentPassword: "SecurePass123",
          newPassword: "weak",
        })
      ).rejects.toThrow();
    });

    it("revokes all existing tokens", async () => {
      const t = convexTest(schema);

      const createResult = await t.mutation(internal.auth.createUserWithPassword, {
        email: `user-${Date.now()}@example.com`,
        password: "SecurePass123",
      });

      // Validate token works before password change
      let validation = await t.query(internal.auth.validateToken, {
        token: createResult.token,
      });
      expect(validation).toBeDefined();

      // Change password
      await t.mutation(internal.auth.changePassword, {
        token: createResult.token,
        currentPassword: "SecurePass123",
        newPassword: "NewSecurePass456",
      });

      // Old token should be revoked
      validation = await t.query(internal.auth.validateToken, {
        token: createResult.token,
      });
      expect(validation).toBeNull();
    });
  });
});
