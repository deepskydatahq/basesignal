import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("profile.getProfileData", () => {
  it("returns null for unauthenticated users", async () => {
    const t = convexTest(schema);

    const result = await t.query(api.profile.getProfileData, {});

    expect(result).toBeNull();
  });

  it("returns profile data for authenticated user with empty data", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        name: "Test User",
        productName: "My Product",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-clerk-id",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-clerk-id",
    });

    const result = await asUser.query(api.profile.getProfileData, {});

    expect(result).not.toBeNull();
    expect(result?.identity.productName).toBe("My Product");
    expect(result?.journeyMap.stages).toEqual([]);
    expect(result?.firstValue).toBeNull();
    expect(result?.metricCatalog.metrics).toEqual({});
    expect(result?.metricCatalog.totalCount).toBe(0);
    expect(result?.measurementPlan.entities).toEqual([]);
    expect(result?.measurementPlan.activityCount).toBe(0);
    expect(result?.measurementPlan.propertyCount).toBe(0);
    expect(result?.completeness.completed).toBe(1); // has productName
    expect(result?.completeness.total).toBe(11);
  });

  it("returns complete profile data for user with all sections populated", async () => {
    const t = convexTest(schema);

    const { journeyId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "full-profile-user",
        email: "full@example.com",
        productName: "Full Product",
        websiteUrl: "https://example.com",
        hasMultiUserAccounts: true,
        businessType: "b2b",
        revenueModels: ["seat_subscription"],
        createdAt: Date.now(),
      });

      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

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

      await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Account Created",
        reasoning: "First value moment",
        expectedTimeframe: "3 days",
        confirmedAt: Date.now(),
        source: "interview",
      });

      await ctx.db.insert("metrics", {
        userId,
        name: "Activation Rate",
        definition: "Rate of activation",
        formula: "activated / signed_up",
        whyItMatters: "Shows health",
        howToImprove: "Improve onboarding",
        category: "engagement",
        metricType: "default",
        order: 0,
        createdAt: Date.now(),
      });

      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Account",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Account Created",
        action: "Created",
        isFirstValue: true,
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementProperties", {
        userId,
        entityId,
        name: "plan",
        dataType: "string",
        isRequired: true,
        createdAt: Date.now(),
      });

      return { userId, journeyId };
    });

    const asUser = t.withIdentity({
      subject: "full-profile-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|full-profile-user",
    });

    const result = await asUser.query(api.profile.getProfileData, {});

    expect(result).not.toBeNull();
    expect(result?.identity.productName).toBe("Full Product");
    expect(result?.identity.websiteUrl).toBe("https://example.com");
    expect(result?.journeyMap.stages).toHaveLength(1);
    expect(result?.journeyMap.journeyId).toBe(journeyId);
    expect(result?.firstValue).not.toBeNull();
    expect(result?.firstValue?.activityName).toBe("Account Created");
    expect(result?.metricCatalog.totalCount).toBe(1);
    expect(result?.measurementPlan.entities).toHaveLength(1);
    expect(result?.measurementPlan.activityCount).toBe(1);
    expect(result?.measurementPlan.propertyCount).toBe(1);
    expect(result?.completeness.completed).toBe(5);
  });

  it("calculates completeness correctly for partial data", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "partial-user",
        productName: "Partial Product",
        createdAt: Date.now(),
      });

      // Only add journey stages - no first value, metrics, or measurement plan
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("stages", {
        journeyId,
        name: "Signed Up",
        type: "activity",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "partial-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|partial-user",
    });

    const result = await asUser.query(api.profile.getProfileData, {});

    // core_identity (has productName) + journey_map (has stages) = 2
    expect(result?.completeness.completed).toBe(2);
    expect(result?.completeness.percentage).toBe(18); // 2/11 = 18%
  });
});
