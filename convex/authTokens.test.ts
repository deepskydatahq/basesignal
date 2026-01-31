import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import * as crypto from "crypto";

describe("authTokens", () => {
  describe("Token creation and management", () => {
    it("should create a user in the database", async () => {
      const t = convexTest(schema);

      // Create a user
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "test-clerk-1",
          email: "test@example.com",
          name: "Test User",
          createdAt: Date.now(),
        });
      });

      // Verify the user was created correctly
      const user = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", "test-clerk-1"))
          .first();
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe("test@example.com");
    });

    it("should store tokens with hashed values (not plaintext)", async () => {
      const t = convexTest(schema);

      // Create user and token
      const { plainToken, hashedToken } = await t.run(async (ctx) => {
        const user = await ctx.db.insert("users", {
          clerkId: "test-clerk-hash",
          email: "hash@example.com",
          name: "Hash Test User",
          createdAt: Date.now(),
        });

        const plain = crypto.randomBytes(32).toString("hex");
        const hashed = crypto
          .createHash("sha256")
          .update(plain)
          .digest("hex");

        await ctx.db.insert("authTokens", {
          userId: user,
          token: hashed,
          name: "Hash Test Token",
          status: "active",
          expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
        });

        return { plainToken: plain, hashedToken: hashed };
      });

      // Verify the stored token is hashed, not plaintext
      const storedTokens = await t.run(async (ctx) => {
        return await ctx.db.query("authTokens").collect();
      });

      const foundToken = storedTokens.find((t) => t.token === hashedToken);
      expect(foundToken).toBeDefined();
      expect(foundToken?.token).not.toBe(plainToken); // Plaintext should not match
      expect(foundToken?.token).toBe(hashedToken); // Hashed should match
    });
  });

  describe("Token status and lifecycle", () => {
    it("should support token statuses: active, revoked", async () => {
      const t = convexTest(schema);

      const statusTests = await t.run(async (ctx) => {
        const user = await ctx.db.insert("users", {
          clerkId: "test-clerk-status",
          email: "status@example.com",
          name: "Status Test User",
          createdAt: Date.now(),
        });

        const tokenIds = [];
        for (const status of ["active", "revoked"]) {
          const hashedToken = crypto
            .createHash("sha256")
            .update(`status-${status}`)
            .digest("hex");

          const tokenId = await ctx.db.insert("authTokens", {
            userId: user,
            token: hashedToken,
            name: `Token ${status}`,
            status: status as "active" | "revoked",
            expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
            createdAt: Date.now(),
          });
          tokenIds.push({ tokenId, status });
        }
        return tokenIds;
      });

      // Verify each token has the correct status
      for (const { tokenId, status } of statusTests) {
        const token = await t.run(async (ctx) => {
          return await ctx.db.get(tokenId);
        });
        expect(token?.status).toBe(status);
      }
    });

    it("should support token expiration timestamps", async () => {
      const t = convexTest(schema);

      const now = Date.now();
      const expirations = await t.run(async (ctx) => {
        const user = await ctx.db.insert("users", {
          clerkId: "test-clerk-expiration",
          email: "expiration@example.com",
          name: "Expiration Test User",
          createdAt: Date.now(),
        });

        const tokenIds = [];

        // Active token (expires in 30 days)
        const active30 = await ctx.db.insert("authTokens", {
          userId: user,
          token: crypto.createHash("sha256").update("30day").digest("hex"),
          name: "30 Day Token",
          status: "active",
          expiresAt: now + 30 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
        });
        tokenIds.push(active30);

        // Active token (expires in 90 days)
        const active90 = await ctx.db.insert("authTokens", {
          userId: user,
          token: crypto.createHash("sha256").update("90day").digest("hex"),
          name: "90 Day Token",
          status: "active",
          expiresAt: now + 90 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
        });
        tokenIds.push(active90);

        // Expired token (expired 1 hour ago)
        const expired = await ctx.db.insert("authTokens", {
          userId: user,
          token: crypto.createHash("sha256").update("expired").digest("hex"),
          name: "Expired Token",
          status: "active",
          expiresAt: now - 60 * 60 * 1000,
          createdAt: Date.now(),
        });
        tokenIds.push(expired);

        return tokenIds;
      });

      // Verify expiration times
      const tokens = await t.run(async (ctx) => {
        return await Promise.all(
          expirations.map((id) => ctx.db.get(id))
        );
      });

      const thirtyDayToken = tokens[0]!;
      const ninetyDayToken = tokens[1]!;
      const expiredToken = tokens[2]!;

      // 30-day token should expire ~30 days from now
      expect(thirtyDayToken.expiresAt).toBeGreaterThan(now + 29 * 24 * 60 * 60 * 1000);
      expect(thirtyDayToken.expiresAt).toBeLessThan(now + 31 * 24 * 60 * 60 * 1000);

      // 90-day token should expire ~90 days from now
      expect(ninetyDayToken.expiresAt).toBeGreaterThan(now + 89 * 24 * 60 * 60 * 1000);
      expect(ninetyDayToken.expiresAt).toBeLessThan(now + 91 * 24 * 60 * 60 * 1000);

      // Expired token should be in the past
      expect(expiredToken.expiresAt).toBeLessThan(now);
    });
  });

  describe("Token database schema", () => {
    it("should store all required token fields", async () => {
      const t = convexTest(schema);

      const tokenId = await t.run(async (ctx) => {
        const user = await ctx.db.insert("users", {
          clerkId: "test-clerk-schema",
          email: "schema@example.com",
          name: "Schema Test User",
          createdAt: Date.now(),
        });

        const token = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");

        const now = Date.now();
        const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

        return await ctx.db.insert("authTokens", {
          userId: user,
          token: hashedToken,
          name: "Test Token",
          status: "active",
          expiresAt,
          createdAt: now,
        });
      });

      // Verify all fields are present
      const storedToken = await t.run(async (ctx) => {
        return await ctx.db.get(tokenId);
      });

      expect(storedToken).toBeDefined();
      expect(storedToken?.userId).toBeDefined();
      expect(storedToken?.token).toBeDefined();
      expect(storedToken?.name).toBe("Test Token");
      expect(storedToken?.status).toBe("active");
      expect(storedToken?.expiresAt).toBeDefined();
      expect(storedToken?.createdAt).toBeDefined();
      // lastUsedAt is optional and should not be set initially
      expect(storedToken?.lastUsedAt).toBeUndefined();
    });

    it("should have proper indexes for efficient queries", async () => {
      const t = convexTest(schema);

      // Create test data
      await t.run(async (ctx) => {
        const user = await ctx.db.insert("users", {
          clerkId: "test-clerk-indexes",
          email: "indexes@example.com",
          name: "Indexes Test User",
          createdAt: Date.now(),
        });

        const token = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");

        await ctx.db.insert("authTokens", {
          userId: user,
          token: hashedToken,
          name: "Indexed Token",
          status: "active",
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
        });
      });

      // Verify we can query by token (by_token index)
      const tokensByUser = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", "test-clerk-indexes"))
          .first();

        if (!user) return null;

        return await ctx.db
          .query("authTokens")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
      });

      expect(tokensByUser).toBeDefined();
      expect(tokensByUser?.length).toBeGreaterThan(0);
    });
  });
});
