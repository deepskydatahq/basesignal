import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

function authenticatedUser(t: ReturnType<typeof convexTest>, clerkId = "test-clerk-id") {
  return t.withIdentity({
    subject: clerkId,
    issuer: "https://clerk.test",
    tokenIdentifier: `https://clerk.test|${clerkId}`,
  });
}

async function setupUserAndProduct(t: ReturnType<typeof convexTest>, clerkId = "test-clerk-id") {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId,
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });
  const asUser = authenticatedUser(t, clerkId);
  const productId = await asUser.mutation(api.products.create, {
    name: "Test Product",
    url: "https://test.io",
  });
  return { userId, productId, asUser };
}

describe("scans", () => {
  describe("startProductScan", () => {
    it("rejects invalid URLs upfront", async () => {
      const t = convexTest(schema);
      const { asUser, productId } = await setupUserAndProduct(t);

      await expect(
        asUser.mutation(api.scans.startProductScan, {
          productId,
          url: "not-a-url",
        })
      ).rejects.toThrow("Invalid URL");
    });

    it("rejects localhost URLs (SSRF prevention)", async () => {
      const t = convexTest(schema);
      const { asUser, productId } = await setupUserAndProduct(t);

      await expect(
        asUser.mutation(api.scans.startProductScan, {
          productId,
          url: "http://localhost:3000",
        })
      ).rejects.toThrow("Invalid URL");
    });

    it("rejects private IP URLs (SSRF prevention)", async () => {
      const t = convexTest(schema);
      const { asUser, productId } = await setupUserAndProduct(t);

      await expect(
        asUser.mutation(api.scans.startProductScan, {
          productId,
          url: "http://192.168.1.1",
        })
      ).rejects.toThrow("Invalid URL");
    });

    it("rejects unauthenticated users", async () => {
      const t = convexTest(schema);
      const { productId } = await setupUserAndProduct(t);

      await expect(
        t.mutation(api.scans.startProductScan, {
          productId,
          url: "https://acme.io",
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("rejects requests for products owned by other users", async () => {
      const t = convexTest(schema);
      const { productId } = await setupUserAndProduct(t);

      // Different user
      await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "other-clerk-id",
          email: "other@example.com",
          createdAt: Date.now(),
        });
      });
      const asOther = authenticatedUser(t, "other-clerk-id");

      await expect(
        asOther.mutation(api.scans.startProductScan, {
          productId,
          url: "https://acme.io",
        })
      ).rejects.toThrow("Product not found");
    });

    it("accepts valid URLs and returns a message", async () => {
      const t = convexTest(schema);
      const { asUser, productId } = await setupUserAndProduct(t);

      const result = await asUser.mutation(api.scans.startProductScan, {
        productId,
        url: "https://acme.io",
      });

      expect(result.message).toContain("acme.io");
    });
  });

  describe("getLatestScan", () => {
    it("returns null when no scans exist", async () => {
      const t = convexTest(schema);
      const { asUser, productId } = await setupUserAndProduct(t);

      const scan = await asUser.query(api.scans.getLatestScan, { productId });
      expect(scan).toBeNull();
    });

    it("returns the latest scan job", async () => {
      const t = convexTest(schema);
      const { asUser, productId, userId } = await setupUserAndProduct(t);

      // Create two jobs directly
      await t.mutation(internal.scanJobs.createInternal, {
        productId,
        userId,
        url: "https://test.io",
      });
      await t.mutation(internal.scanJobs.createInternal, {
        productId,
        userId,
        url: "https://test.io",
      });

      const scan = await asUser.query(api.scans.getLatestScan, { productId });
      expect(scan).toBeDefined();
      expect(scan?.status).toBe("mapping");
    });

    it("enforces ownership", async () => {
      const t = convexTest(schema);
      const { productId, userId } = await setupUserAndProduct(t);

      await t.mutation(internal.scanJobs.createInternal, {
        productId,
        userId,
        url: "https://test.io",
      });

      // Different user
      await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "other-clerk-id",
          email: "other@example.com",
          createdAt: Date.now(),
        });
      });
      const asOther = authenticatedUser(t, "other-clerk-id");

      const scan = await asOther.query(api.scans.getLatestScan, { productId });
      expect(scan).toBeNull();
    });
  });
});

describe("scanJobs.createInternal", () => {
  it("creates a job without auth", async () => {
    const t = convexTest(schema);
    const { productId, userId } = await setupUserAndProduct(t);

    const jobId = await t.mutation(internal.scanJobs.createInternal, {
      productId,
      userId,
      url: "https://test.io",
    });

    expect(jobId).toBeDefined();

    const job = await t.run(async (ctx) => ctx.db.get(jobId));
    expect(job).toMatchObject({
      status: "mapping",
      url: "https://test.io",
      pagesCrawled: 0,
    });
  });
});
