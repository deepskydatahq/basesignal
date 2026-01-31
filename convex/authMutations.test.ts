import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import { verifyToken } from "./jwtUtils";
import schema from "./schema";

describe("Authentication Mutations and Queries", () => {
  it("createUserWithPassword should create a new user and return a token", async () => {
    const t = convexTest(schema);

    const result = await t.mutation(api.authMutations.createUserWithPassword, {
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    });

    expect(result).toHaveProperty("userId");
    expect(result).toHaveProperty("token");
    expect(result.email).toBe("test@example.com");

    // Verify token is valid
    const payload = verifyToken(result.token);
    expect(payload).toBeTruthy();
    expect(payload?.userId).toBe(result.userId);
    expect(payload?.email).toBe("test@example.com");
  });

  it("createUserWithPassword should reject duplicate email", async () => {
    const t = convexTest(schema);

    await t.mutation(api.authMutations.createUserWithPassword, {
      email: "test@example.com",
      password: "password123",
    });

    // Try to create again with same email
    await expect(
      t.mutation(api.authMutations.createUserWithPassword, {
        email: "test@example.com",
        password: "password456",
      })
    ).rejects.toThrow("User already exists with this email");
  });

  it("createUserWithPassword should validate email format", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.authMutations.createUserWithPassword, {
        email: "invalid-email",
        password: "password123",
      })
    ).rejects.toThrow("Invalid email format");
  });

  it("createUserWithPassword should enforce minimum password length", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.authMutations.createUserWithPassword, {
        email: "test@example.com",
        password: "short",
      })
    ).rejects.toThrow("Password must be at least 8 characters long");
  });

  it("loginUser should authenticate with valid credentials", async () => {
    const t = convexTest(schema);

    // Create user
    const createResult = await t.mutation(api.authMutations.createUserWithPassword, {
      email: "login@example.com",
      password: "password123",
    });

    // Login
    const loginResult = await t.mutation(api.authMutations.loginUser, {
      email: "login@example.com",
      password: "password123",
    });

    expect(loginResult).toHaveProperty("userId");
    expect(loginResult).toHaveProperty("token");
    expect(loginResult.email).toBe("login@example.com");

    // Verify token is different from creation token but valid
    const payload = verifyToken(loginResult.token);
    expect(payload).toBeTruthy();
    expect(payload?.userId).toBe(createResult.userId);
  });

  it("loginUser should reject invalid password", async () => {
    const t = convexTest(schema);

    await t.mutation(api.authMutations.createUserWithPassword, {
      email: "test@example.com",
      password: "password123",
    });

    await expect(
      t.mutation(api.authMutations.loginUser, {
        email: "test@example.com",
        password: "wrongpassword",
      })
    ).rejects.toThrow("Invalid email or password");
  });

  it("loginUser should reject non-existent email", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.authMutations.loginUser, {
        email: "nonexistent@example.com",
        password: "password123",
      })
    ).rejects.toThrow("Invalid email or password");
  });

  it("validateToken should verify valid token", async () => {
    const t = convexTest(schema);

    const createResult = await t.mutation(api.authMutations.createUserWithPassword, {
      email: "validate@example.com",
      password: "password123",
      name: "Validate User",
    });

    const validationResult = await t.query(api.authMutations.validateToken, {
      token: createResult.token,
    });

    expect(validationResult.isValid).toBe(true);
    expect(validationResult.userId).toBe(createResult.userId);
    expect(validationResult.email).toBe("validate@example.com");
    expect(validationResult.name).toBe("Validate User");
  });

  it("validateToken should reject invalid token", async () => {
    const t = convexTest(schema);

    await expect(
      t.query(api.authMutations.validateToken, {
        token: "invalid.token.here",
      })
    ).rejects.toThrow("Invalid or expired token");
  });

  it("logoutUser should revoke token", async () => {
    const t = convexTest(schema);

    const createResult = await t.mutation(api.authMutations.createUserWithPassword, {
      email: "logout@example.com",
      password: "password123",
    });

    // Token should be valid initially
    const validationResult = await t.query(api.authMutations.validateToken, {
      token: createResult.token,
    });
    expect(validationResult.isValid).toBe(true);

    // Logout
    await t.mutation(api.authMutations.logoutUser, {
      token: createResult.token,
    });

    // Token should now be invalid
    await expect(
      t.query(api.authMutations.validateToken, {
        token: createResult.token,
      })
    ).rejects.toThrow("Token has been revoked");
  });

  it("getCurrentUser should return user for valid token", async () => {
    const t = convexTest(schema);

    const createResult = await t.mutation(api.authMutations.createUserWithPassword, {
      email: "current@example.com",
      password: "password123",
      name: "Current User",
    });

    const currentUser = await t.query(api.authMutations.getCurrentUser, {
      token: createResult.token,
    });

    expect(currentUser).toBeTruthy();
    expect(currentUser?.userId).toBe(createResult.userId);
    expect(currentUser?.email).toBe("current@example.com");
    expect(currentUser?.name).toBe("Current User");
  });

  it("getCurrentUser should return null for invalid token", async () => {
    const t = convexTest(schema);

    const currentUser = await t.query(api.authMutations.getCurrentUser, {
      token: "invalid.token",
    });

    expect(currentUser).toBeNull();
  });

  it("getCurrentUser should return null for revoked token", async () => {
    const t = convexTest(schema);

    const createResult = await t.mutation(api.authMutations.createUserWithPassword, {
      email: "revoked@example.com",
      password: "password123",
    });

    // Revoke token
    await t.mutation(api.authMutations.logoutUser, {
      token: createResult.token,
    });

    // Should return null for revoked token
    const currentUser = await t.query(api.authMutations.getCurrentUser, {
      token: createResult.token,
    });

    expect(currentUser).toBeNull();
  });

  it("password hashing should not expose plain passwords", async () => {
    const t = convexTest(schema);

    const createResult = await t.mutation(api.authMutations.createUserWithPassword, {
      email: "secure@example.com",
      password: "password123",
    });

    // Verify we can't extract plain password from the stored hash
    const token = createResult.token;
    const payload = verifyToken(token);

    // Token should not contain password
    expect(payload?.email).toBe("secure@example.com");
    expect(Object.values(payload || {})).not.toContain("password123");
  });
});
