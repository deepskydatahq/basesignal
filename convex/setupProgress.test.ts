import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to set up user with journey for complete mutation tests
async function setupUserWithJourney(t: ReturnType<typeof convexTest>) {
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

  // Start setup
  await asUser.mutation(api.setupProgress.start, {});

  // Create overview journey with stages
  const journeyId = await asUser.mutation(api.journeys.create, {
    type: "overview",
    name: "Overview Journey",
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("stages", {
      journeyId,
      name: "Account Created",
      type: "activity",
      entity: "Account",
      action: "Created",
      lifecycleSlot: "account_creation",
      position: { x: 100, y: 100 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  return { userId, asUser, journeyId };
}

describe("setupProgress.foundationStatus", () => {
  it("returns not_started status when no setup progress exists", async () => {
    const t = convexTest(schema);

    // Create a user
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
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

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.overviewInterview.status).toBe("not_started");
    expect(status.overviewInterview.journeyId).toBeNull();
    expect(status.firstValue.status).toBe("not_defined");
    expect(status.measurementPlan.status).toBe("locked");
    expect(status.metricCatalog.status).toBe("locked");
  });

  it("returns in_progress when setup is active on overview_interview step", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "overview_interview",
        status: "active",
        stepsCompleted: ["onboarding"],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.overviewInterview.status).toBe("in_progress");
  });

  it("returns complete when setup is completed with overview journey", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "My Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "review_save",
        status: "completed",
        stepsCompleted: ["onboarding", "overview_interview", "review_save"],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completedAt: Date.now(),
        remindersSent: 0,
        overviewJourneyId: journeyId,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.overviewInterview.status).toBe("complete");
    expect(status.overviewInterview.journeyId).toBe(journeyId);
  });

  it("returns defined for firstValue when first_value journey exists", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.firstValue.status).toBe("defined");
    expect(status.firstValue.journeyId).toBe(journeyId);
  });

  it("includes slot completion count for in-progress overview", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "My Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Add some stages to different slots
    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stages", {
        journeyId,
        name: "User Activated",
        type: "activity",
        entity: "User",
        action: "Activated",
        lifecycleSlot: "activation",
        position: { x: 100, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "overview_interview",
        status: "active",
        stepsCompleted: ["onboarding"],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
        overviewJourneyId: journeyId,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.overviewInterview.slotsCompleted).toBe(2);
    expect(status.overviewInterview.slotsTotal).toBe(5);
  });

  it("returns locked for metricCatalog when overview is not complete", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
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

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.metricCatalog.status).toBe("locked");
    expect(status.metricCatalog.metricsCount).toBe(0);
  });

  it("returns in_progress for metricCatalog when overview complete but no metrics", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "My Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "review_save",
        status: "completed",
        stepsCompleted: ["onboarding", "overview_interview", "review_save"],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completedAt: Date.now(),
        remindersSent: 0,
        overviewJourneyId: journeyId,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.metricCatalog.status).toBe("in_progress");
    expect(status.metricCatalog.metricsCount).toBe(0);
  });

  it("returns complete for metricCatalog when metrics exist", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "My Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "review_save",
        status: "completed",
        stepsCompleted: ["onboarding", "overview_interview", "review_save"],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completedAt: Date.now(),
        remindersSent: 0,
        overviewJourneyId: journeyId,
      });
    });

    // Add some metrics
    await t.run(async (ctx) => {
      await ctx.db.insert("metrics", {
        userId,
        name: "New Users",
        definition: "Test",
        formula: "Test",
        whyItMatters: "Test",
        howToImprove: "Test",
        category: "reach",
        metricType: "default",
        templateKey: "new_users",
        order: 1,
        createdAt: Date.now(),
      });
      await ctx.db.insert("metrics", {
        userId,
        name: "DAU",
        definition: "Test",
        formula: "Test",
        whyItMatters: "Test",
        howToImprove: "Test",
        category: "engagement",
        metricType: "default",
        templateKey: "dau",
        order: 2,
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.metricCatalog.status).toBe("complete");
    expect(status.metricCatalog.metricsCount).toBe(2);
  });

  it("returns locked for measurementPlan when overview is not complete", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
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

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.measurementPlan.status).toBe("locked");
    expect(status.measurementPlan.entitiesCount).toBe(0);
  });

  it("returns available for measurementPlan when overview complete but no entities", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "My Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "review_save",
        status: "completed",
        stepsCompleted: ["onboarding", "overview_interview", "review_save"],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completedAt: Date.now(),
        remindersSent: 0,
        overviewJourneyId: journeyId,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.measurementPlan.status).toBe("available");
    expect(status.measurementPlan.entitiesCount).toBe(0);
  });

  it("returns ready for measurementPlan when entities exist", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "My Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "review_save",
        status: "completed",
        stepsCompleted: ["onboarding", "overview_interview", "review_save"],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completedAt: Date.now(),
        remindersSent: 0,
        overviewJourneyId: journeyId,
      });
    });

    // Add measurement entities
    await t.run(async (ctx) => {
      await ctx.db.insert("measurementEntities", {
        userId,
        name: "Account",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });
      await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.measurementPlan.status).toBe("ready");
    expect(status.measurementPlan.entitiesCount).toBe(2);
  });
});

describe("setupProgress.complete", () => {
  it("auto-generates measurement plan on completion", async () => {
    const t = convexTest(schema);
    const { asUser, journeyId } = await setupUserWithJourney(t);

    // Complete setup
    await asUser.mutation(api.setupProgress.complete, {
      overviewJourneyId: journeyId,
    });

    // Verify measurement plan was auto-generated
    const entities = await asUser.query(api.measurementPlan.listEntities);
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.map((e) => e.name)).toContain("Account");
  });
});
