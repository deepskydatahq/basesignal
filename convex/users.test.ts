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
});
