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

    // Create measurementActivity with activation lifecycleSlot
    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      // Create journey (for auth)
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
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
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "First Report Generated",
        action: "Generated",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
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
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
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
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
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

  it("links sourceActivityId to the activation measurementActivity", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    let activityId: Id<"measurementActivities">;
    const journeyId = await t.run(async (ctx) => {
      // Create entity
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      // Create activation activity
      activityId = await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      // Create journey (for auth)
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
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

    expect(activationRate?.sourceActivityId).toBe(activityId!);
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

  it("throws error when no activation activity found", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      // Create journey but no measurementActivities
      return await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asUser.mutation(api.metricCatalog.generateFromFirstValue, {
        journeyId,
      })
    ).rejects.toThrow("No activation activity found");
  });
});

describe("generateFromOverview", () => {
  it("generates 6 overview metrics when overview interview completes", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create measurementActivity with core_usage lifecycleSlot
    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Report Generated",
        action: "Generated",
        lifecycleSlot: "core_usage",
        isFirstValue: false,
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Generate metrics
    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });

    // Verify metrics were created
    const metrics = await asUser.query(api.metrics.list, {});
    const overviewMetrics = metrics.filter((m) =>
      METRIC_TEMPLATES.filter((t) => t.generatedAfter === "overview")
        .map((t) => t.key)
        .includes(m.templateKey ?? "")
    );

    expect(overviewMetrics).toHaveLength(6);
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("new_users");
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("mau");
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("dau");
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("dau_mau_ratio");
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("retention_d7");
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("core_action_frequency");
  });

  it("is idempotent - skips if metrics already exist", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Report Generated",
        action: "Generated",
        lifecycleSlot: "core_usage",
        isFirstValue: false,
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Generate twice
    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });
    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });

    // Should still only have 6 overview metrics
    const metrics = await asUser.query(api.metrics.list, {});
    const overviewMetrics = metrics.filter((m) =>
      METRIC_TEMPLATES.filter((t) => t.generatedAfter === "overview")
        .map((t) => t.key)
        .includes(m.templateKey ?? "")
    );

    expect(overviewMetrics).toHaveLength(6);
  });

  it("assigns correct order 1-6 to overview metrics", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Report Generated",
        action: "Generated",
        lifecycleSlot: "core_usage",
        isFirstValue: false,
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    const orders = metrics.map((m) => m.order).sort((a, b) => a - b);

    expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("uses fallback 'Core Action' when no core_usage activity found", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create journey without any measurementActivities
    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Should still generate with fallback
    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    expect(metrics).toHaveLength(6);

    // core_action_frequency should use fallback
    const coreActionMetric = metrics.find((m) => m.templateKey === "core_action_frequency");
    expect(coreActionMetric).toBeDefined();
  });

  it("throws error when journey not found", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create and delete a journey to get a valid but non-existent ID
    const fakeJourneyId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Temp",
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      asUser.mutation(api.metricCatalog.generateFromOverview, {
        journeyId: fakeJourneyId,
      })
    ).rejects.toThrow("Journey not found");
  });

  it("throws error when not authorized to access journey", async () => {
    const t = convexTest(schema);
    const { asUser: user1 } = await setupUser(t);

    // Create another user and their journey
    const otherUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "other-user",
        email: "other@example.com",
        createdAt: Date.now(),
      });
    });

    const otherJourneyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId: otherUserId,
        type: "overview",
        name: "Other's Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // First user trying to access other user's journey
    await expect(
      user1.mutation(api.metricCatalog.generateFromOverview, {
        journeyId: otherJourneyId,
      })
    ).rejects.toThrow("Not authorized");
  });

  it("links sourceActivityId to the core_usage measurementActivity", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create measurementActivity with core_usage lifecycleSlot
    let activityId: Id<"measurementActivities">;
    const journeyId = await t.run(async (ctx) => {
      // Create entity first
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      // Create activity
      activityId = await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Report Generated",
        action: "Generated",
        lifecycleSlot: "core_usage",
        isFirstValue: false,
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      // Create journey (still needed for auth check)
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    const coreActionMetric = metrics.find(
      (m) => m.templateKey === "core_action_frequency"
    );

    expect(coreActionMetric).toBeDefined();
    expect(coreActionMetric?.sourceActivityId).toBe(activityId!);
  });
});

describe("interview completion trigger", () => {
  it("generates overview metrics when overview interview is completed", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create measurementActivity and journey
    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Report Generated",
        action: "Generated",
        lifecycleSlot: "core_usage",
        isFirstValue: false,
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Create an active interview session
    const sessionId = await asUser.mutation(api.interviews.createSession, {
      journeyId,
      interviewType: "overview",
    });

    // Verify no metrics exist yet
    let metrics = await asUser.query(api.metrics.list, {});
    expect(metrics).toHaveLength(0);

    // Complete the interview session (this should trigger metric generation)
    await asUser.mutation(api.interviews.completeSession, {
      sessionId,
    });

    // Verify 6 overview metrics were generated
    metrics = await asUser.query(api.metrics.list, {});
    expect(metrics).toHaveLength(6);

    // Verify the correct templates were used
    const templateKeys = metrics.map((m) => m.templateKey);
    expect(templateKeys).toContain("new_users");
    expect(templateKeys).toContain("mau");
    expect(templateKeys).toContain("dau");
    expect(templateKeys).toContain("dau_mau_ratio");
    expect(templateKeys).toContain("retention_d7");
    expect(templateKeys).toContain("core_action_frequency");
  });

  it("does not generate metrics for non-overview interview completion", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // First create an overview journey with a completed overview session (to unlock first_value)
    await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create completed overview session to unlock first_value
      await ctx.db.insert("interviewSessions", {
        journeyId: jId,
        interviewType: "overview",
        status: "completed",
        startedAt: Date.now(),
        completedAt: Date.now(),
      });

      return jId;
    });

    // Create first_value journey with activation activity
    const firstValueJourneyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Create and complete a first_value interview session
    const sessionId = await asUser.mutation(api.interviews.createSession, {
      journeyId: firstValueJourneyId,
      interviewType: "first_value",
    });

    await asUser.mutation(api.interviews.completeSession, {
      sessionId,
    });

    // Verify no overview metrics were generated (first_value doesn't trigger overview generation)
    const metrics = await asUser.query(api.metrics.list, {});
    // Should have 0 metrics since we're testing that non-overview interviews don't trigger
    // (Note: first_value metrics would be generated by a separate flow)
    expect(metrics).toHaveLength(0);
  });
});
