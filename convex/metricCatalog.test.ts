import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { METRIC_TEMPLATES } from "../src/shared/metricTemplates";

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

describe("generateFromFirstValue", () => {
  it("generates first_value metrics when first_value interview completes", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create first_value journey with activation stage
    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Add activation stage
      await ctx.db.insert("stages", {
        journeyId: jId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "activation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Generate metrics
    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });

    // Verify metrics were created
    const metrics = await asUser.query(api.metrics.list, {});
    const firstValueMetrics = metrics.filter((m) =>
      METRIC_TEMPLATES.filter((t) => t.generatedAfter === "first_value")
        .map((t) => t.key)
        .includes(m.templateKey ?? "")
    );

    expect(firstValueMetrics).toHaveLength(2);
    expect(firstValueMetrics.map((m) => m.templateKey)).toContain(
      "activation_rate"
    );
    expect(firstValueMetrics.map((m) => m.templateKey)).toContain(
      "time_to_first_value"
    );
  });

  it("interpolates firstValueActivity into templates", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("stages", {
        journeyId: jId,
        name: "First Report Generated",
        type: "activity",
        entity: "Report",
        action: "Generated",
        lifecycleSlot: "activation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    const activationMetric = metrics.find(
      (m) => m.templateKey === "activation_rate"
    );

    expect(activationMetric).toBeDefined();
    // Should contain the activity name, not the placeholder
    expect(activationMetric?.definition).toContain("First Report Generated");
    expect(activationMetric?.definition).not.toContain("{{firstValueActivity}}");
  });

  it("is idempotent - skips if metrics already exist", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("stages", {
        journeyId: jId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "activation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Generate twice
    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });
    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });

    // Should still only have 2 first_value metrics
    const metrics = await asUser.query(api.metrics.list, {});
    const firstValueMetrics = metrics.filter((m) =>
      ["activation_rate", "time_to_first_value"].includes(m.templateKey ?? "")
    );

    expect(firstValueMetrics).toHaveLength(2);
  });

  it("appends to existing overview metrics with correct order", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Pre-create overview metrics (simulating generateFromOverview already ran)
    await t.run(async (ctx) => {
      for (let i = 1; i <= 6; i++) {
        await ctx.db.insert("metrics", {
          userId,
          name: `Overview Metric ${i}`,
          definition: "Test",
          formula: "Test",
          whyItMatters: "Test",
          howToImprove: "Test",
          category: "engagement",
          metricType: "default",
          templateKey: `overview_metric_${i}`,
          order: i,
          createdAt: Date.now(),
        });
      }
    });

    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("stages", {
        journeyId: jId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "activation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    expect(metrics).toHaveLength(8);

    // First value metrics should have order 7 and 8
    const activationRate = metrics.find(
      (m) => m.templateKey === "activation_rate"
    );
    const timeToFirstValue = metrics.find(
      (m) => m.templateKey === "time_to_first_value"
    );

    expect(activationRate?.order).toBe(7);
    expect(timeToFirstValue?.order).toBe(8);
  });

  it("links relatedActivityId to the activation stage", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    let stageId: Id<"stages">;
    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      stageId = await ctx.db.insert("stages", {
        journeyId: jId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "activation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    const activationRate = metrics.find(
      (m) => m.templateKey === "activation_rate"
    );

    expect(activationRate?.relatedActivityId).toBe(stageId!);
  });

  it("throws error when journey not found", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create and delete a journey to get a valid but non-existent ID
    const fakeJourneyId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "Temp",
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      asUser.mutation(api.metricCatalog.generateFromFirstValue, {
        journeyId: fakeJourneyId,
      })
    ).rejects.toThrow("Journey not found");
  });

  it("throws error when no activation stage found", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // No stages added
    });

    await expect(
      asUser.mutation(api.metricCatalog.generateFromFirstValue, {
        journeyId,
      })
    ).rejects.toThrow("No activation stage found");
  });
});
