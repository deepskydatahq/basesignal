import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to create authenticated user
async function setupUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user",
  });

  return { userId, asUser };
}

describe("metrics", () => {
  describe("list", () => {
    it("returns empty array for user with no metrics", async () => {
      const t = convexTest(schema);
      const { asUser } = await setupUser(t);

      const metrics = await asUser.query(api.metrics.list, {});
      expect(metrics).toEqual([]);
    });

    it("returns metrics ordered by order field", async () => {
      const t = convexTest(schema);
      const { asUser, userId } = await setupUser(t);

      // Insert metrics in reverse order
      await t.run(async (ctx) => {
        await ctx.db.insert("metrics", {
          userId,
          name: "DAU",
          definition: "Daily active users",
          formula: "Count unique users active per day",
          whyItMatters: "Growth indicator",
          howToImprove: "Improve onboarding",
          category: "engagement",
          metricType: "default",
          templateKey: "dau",
          order: 2,
          createdAt: Date.now(),
        });
        await ctx.db.insert("metrics", {
          userId,
          name: "New Users",
          definition: "New signups",
          formula: "Count signups per period",
          whyItMatters: "Acquisition health",
          howToImprove: "Marketing",
          category: "reach",
          metricType: "default",
          templateKey: "new_users",
          order: 1,
          createdAt: Date.now(),
        });
      });

      const metrics = await asUser.query(api.metrics.list, {});
      expect(metrics).toHaveLength(2);
      expect(metrics[0].name).toBe("New Users");
      expect(metrics[1].name).toBe("DAU");
    });

    it("returns empty for unauthenticated users", async () => {
      const t = convexTest(schema);

      const metrics = await t.query(api.metrics.list, {});
      expect(metrics).toEqual([]);
    });
  });

  describe("get", () => {
    it("returns a metric by ID", async () => {
      const t = convexTest(schema);
      const { asUser, userId } = await setupUser(t);

      const metricId = await t.run(async (ctx) => {
        return await ctx.db.insert("metrics", {
          userId,
          name: "Activation Rate",
          definition: "Users who complete first value",
          formula: "Activated / Signed Up",
          whyItMatters: "Value delivery",
          howToImprove: "Simplify onboarding",
          category: "value_delivery",
          metricType: "default",
          templateKey: "activation_rate",
          order: 1,
          createdAt: Date.now(),
        });
      });

      const metric = await asUser.query(api.metrics.get, { id: metricId });
      expect(metric).not.toBeNull();
      expect(metric?.name).toBe("Activation Rate");
    });

    it("returns null for another user's metric", async () => {
      const t = convexTest(schema);

      // Create first user's metric
      const otherUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "other-user",
          email: "other@example.com",
          createdAt: Date.now(),
        });
      });

      const metricId = await t.run(async (ctx) => {
        return await ctx.db.insert("metrics", {
          userId: otherUserId,
          name: "Other Metric",
          definition: "Test",
          formula: "Test",
          whyItMatters: "Test",
          howToImprove: "Test",
          category: "reach",
          metricType: "default",
          order: 1,
          createdAt: Date.now(),
        });
      });

      // Second user tries to access
      const { asUser } = await setupUser(t);
      const metric = await asUser.query(api.metrics.get, { id: metricId });
      expect(metric).toBeNull();
    });
  });

  describe("getByTemplateKey", () => {
    it("returns metric by template key", async () => {
      const t = convexTest(schema);
      const { asUser, userId } = await setupUser(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("metrics", {
          userId,
          name: "Activation Rate",
          definition: "Test",
          formula: "Test",
          whyItMatters: "Test",
          howToImprove: "Test",
          category: "value_delivery",
          metricType: "default",
          templateKey: "activation_rate",
          order: 1,
          createdAt: Date.now(),
        });
      });

      const metric = await asUser.query(api.metrics.getByTemplateKey, {
        templateKey: "activation_rate",
      });
      expect(metric).not.toBeNull();
      expect(metric?.name).toBe("Activation Rate");
    });

    it("returns null when template key not found", async () => {
      const t = convexTest(schema);
      const { asUser } = await setupUser(t);

      const metric = await asUser.query(api.metrics.getByTemplateKey, {
        templateKey: "nonexistent",
      });
      expect(metric).toBeNull();
    });

    it("returns null for another user's metric with same template key", async () => {
      const t = convexTest(schema);

      // Create first user's metric
      const otherUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "other-user",
          email: "other@example.com",
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("metrics", {
          userId: otherUserId,
          name: "Other Activation Rate",
          definition: "Test",
          formula: "Test",
          whyItMatters: "Test",
          howToImprove: "Test",
          category: "value_delivery",
          metricType: "default",
          templateKey: "activation_rate",
          order: 1,
          createdAt: Date.now(),
        });
      });

      // Second user tries to get by template key
      const { asUser } = await setupUser(t);
      const metric = await asUser.query(api.metrics.getByTemplateKey, {
        templateKey: "activation_rate",
      });
      expect(metric).toBeNull();
    });

    it("returns null for unauthenticated users", async () => {
      const t = convexTest(schema);

      const metric = await t.query(api.metrics.getByTemplateKey, {
        templateKey: "activation_rate",
      });
      expect(metric).toBeNull();
    });
  });

  describe("count", () => {
    it("returns count of metrics for user", async () => {
      const t = convexTest(schema);
      const { asUser, userId } = await setupUser(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("metrics", {
          userId,
          name: "Metric 1",
          definition: "Test",
          formula: "Test",
          whyItMatters: "Test",
          howToImprove: "Test",
          category: "reach",
          metricType: "default",
          order: 1,
          createdAt: Date.now(),
        });
        await ctx.db.insert("metrics", {
          userId,
          name: "Metric 2",
          definition: "Test",
          formula: "Test",
          whyItMatters: "Test",
          howToImprove: "Test",
          category: "engagement",
          metricType: "default",
          order: 2,
          createdAt: Date.now(),
        });
      });

      const count = await asUser.query(api.metrics.count, {});
      expect(count).toBe(2);
    });

    it("returns 0 for user with no metrics", async () => {
      const t = convexTest(schema);
      const { asUser } = await setupUser(t);

      const count = await asUser.query(api.metrics.count, {});
      expect(count).toBe(0);
    });

    it("returns 0 for unauthenticated users", async () => {
      const t = convexTest(schema);

      const count = await t.query(api.metrics.count, {});
      expect(count).toBe(0);
    });
  });
});
