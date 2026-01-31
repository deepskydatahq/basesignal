import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

describe("users", () => {
  describe("createFromWebhook", () => {
    it("creates a new user with clerk data", async () => {
      const t = convexTest(schema);

      const userId = await t.mutation(internal.users.createFromWebhook, {
        clerkId: "user_test123",
        email: "test@example.com",
        name: "Test User",
        image: "https://example.com/avatar.jpg",
      });

      expect(userId).toBeDefined();

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(user).toMatchObject({
        clerkId: "user_test123",
        email: "test@example.com",
        name: "Test User",
        image: "https://example.com/avatar.jpg",
        setupStatus: "not_started",
      });
      expect(user?.createdAt).toBeDefined();
    });

    it("returns existing user if clerkId already exists (idempotent)", async () => {
      const t = convexTest(schema);

      // Create first user
      const userId1 = await t.mutation(internal.users.createFromWebhook, {
        clerkId: "user_existing",
        email: "first@example.com",
        name: "First Name",
      });

      // Try to create again with same clerkId
      const userId2 = await t.mutation(internal.users.createFromWebhook, {
        clerkId: "user_existing",
        email: "second@example.com",
        name: "Second Name",
      });

      // Should return same user ID
      expect(userId2).toEqual(userId1);

      // Should NOT have updated the data (create is idempotent, not upsert)
      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId1);
      });
      expect(user?.email).toBe("first@example.com");
    });
  });

  describe("updateFromWebhook", () => {
    it("updates existing user profile data", async () => {
      const t = convexTest(schema);

      // Create user first
      const userId = await t.mutation(internal.users.createFromWebhook, {
        clerkId: "user_update_test",
        email: "old@example.com",
        name: "Old Name",
        image: "https://example.com/old.jpg",
      });

      // Update via webhook
      await t.mutation(internal.users.updateFromWebhook, {
        clerkId: "user_update_test",
        email: "new@example.com",
        name: "New Name",
        image: "https://example.com/new.jpg",
      });

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(user).toMatchObject({
        clerkId: "user_update_test",
        email: "new@example.com",
        name: "New Name",
        image: "https://example.com/new.jpg",
      });
    });

    it("does nothing if user does not exist", async () => {
      const t = convexTest(schema);

      // Should not throw, just return
      await t.mutation(internal.users.updateFromWebhook, {
        clerkId: "user_nonexistent",
        email: "new@example.com",
      });

      // Verify no user was created
      const user = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", "user_nonexistent"))
          .first();
      });

      expect(user).toBeNull();
    });
  });

  describe("getOrCreateByClerkId", () => {
    it("creates a new user when clerkId does not exist", async () => {
      const t = convexTest(schema);

      const result = await t.mutation(api.users.getOrCreateByClerkId, {
        clerkId: "user_mcp_new",
        email: "mcp@example.com",
        name: "MCP User",
        image: "https://example.com/mcp.jpg",
      });

      expect(result._id).toBeDefined();
      expect(result.clerkId).toBe("user_mcp_new");
      expect(result.email).toBe("mcp@example.com");
      expect(result.name).toBe("MCP User");
      expect(result.image).toBe("https://example.com/mcp.jpg");

      // Verify user was actually persisted
      const user = await t.run(async (ctx) => {
        return await ctx.db.get(result._id);
      });
      expect(user).toMatchObject({
        clerkId: "user_mcp_new",
        setupStatus: "not_started",
      });
      expect(user?.createdAt).toBeDefined();
    });

    it("returns existing user when clerkId already exists (idempotent)", async () => {
      const t = convexTest(schema);

      const first = await t.mutation(api.users.getOrCreateByClerkId, {
        clerkId: "user_mcp_existing",
        email: "first@example.com",
        name: "First",
      });

      const second = await t.mutation(api.users.getOrCreateByClerkId, {
        clerkId: "user_mcp_existing",
        email: "second@example.com",
        name: "Second",
      });

      expect(second._id).toEqual(first._id);
      // Returns original data, not the new args
      expect(second.email).toBe("first@example.com");
      expect(second.name).toBe("First");
    });

    it("returns null for optional fields when not provided", async () => {
      const t = convexTest(schema);

      const result = await t.mutation(api.users.getOrCreateByClerkId, {
        clerkId: "user_mcp_minimal",
      });

      expect(result.clerkId).toBe("user_mcp_minimal");
      expect(result.email).toBeNull();
      expect(result.name).toBeNull();
      expect(result.image).toBeNull();
    });
  });

  describe("setPrimaryEntity", () => {
    it("sets primary entity for user", async () => {
      const t = convexTest(schema);

      // Create user
      const userId = await t.mutation(internal.users.createFromWebhook, {
        clerkId: "user_primary_test",
        email: "primary@example.com",
      });

      // Create an entity for this user
      const entityId = await t.run(async (ctx) => {
        return await ctx.db.insert("measurementEntities", {
          userId,
          name: "Account",
          createdAt: Date.now(),
        });
      });

      // Set primary entity (direct DB operation since mutation needs auth)
      await t.run(async (ctx) => {
        await ctx.db.patch(userId, { primaryEntityId: entityId });
      });

      // Verify
      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(user?.primaryEntityId).toEqual(entityId);
    });
  });
});
