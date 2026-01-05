import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

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
});
