import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
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

describe("productProfiles", () => {
  it("can create an empty profile for a product", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);

    const profileId = await asUser.mutation(api.productProfiles.create, { productId });
    expect(profileId).toBeDefined();

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile).toBeDefined();
    expect(profile?.completeness).toBe(0);
    expect(profile?.overallConfidence).toBe(0);
  });

  it("is idempotent - creating twice returns same id", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);

    const id1 = await asUser.mutation(api.productProfiles.create, { productId });
    const id2 = await asUser.mutation(api.productProfiles.create, { productId });
    expect(id1).toEqual(id2);
  });

  it("can update the identity section", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Acme SaaS",
        description: "A project management tool",
        targetCustomer: "Engineering teams",
        businessModel: "B2B SaaS",
        confidence: 0.7,
        evidence: [{ url: "https://acme.io", excerpt: "Built for engineering teams" }],
      },
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile?.identity?.productName).toBe("Acme SaaS");
    expect(profile?.identity?.confidence).toBe(0.7);
    expect(profile?.completeness).toBeGreaterThan(0);
  });

  it("can update the revenue section", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "revenue",
      data: {
        model: "subscription",
        hasFreeTier: true,
        tiers: [{ name: "Free", price: "$0", features: ["Basic"] }],
        expansionPaths: ["seats"],
        contractionRisks: ["churn"],
        confidence: 0.6,
        evidence: [],
      },
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile?.revenue?.model).toBe("subscription");
    expect(profile?.revenue?.hasFreeTier).toBe(true);
  });

  it("can update the journey section", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "journey",
      data: {
        stages: [
          { name: "Signup", description: "User creates account", order: 1 },
          { name: "Activated", description: "User completes onboarding", order: 2 },
        ],
        confidence: 0.5,
        evidence: [],
      },
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile?.journey?.stages).toHaveLength(2);
  });

  it("validates a section by setting confidence to 1.0", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Acme",
        description: "Tool",
        targetCustomer: "Devs",
        businessModel: "SaaS",
        confidence: 0.5,
        evidence: [],
      },
    });

    await asUser.mutation(api.productProfiles.validateSection, {
      productId,
      section: "identity",
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile?.identity?.confidence).toBe(1.0);
  });

  it("calculates completeness correctly with one section", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Acme",
        description: "Tool",
        targetCustomer: "Devs",
        businessModel: "SaaS",
        confidence: 0.8,
        evidence: [],
      },
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    // 1 section filled out of 10 = 0.1
    expect(profile?.completeness).toBeCloseTo(0.1, 1);
    expect(profile?.overallConfidence).toBeCloseTo(0.8, 1);
  });

  it("calculates completeness with multiple sections", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Acme",
        description: "Tool",
        targetCustomer: "Devs",
        businessModel: "SaaS",
        confidence: 0.8,
        evidence: [],
      },
    });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "revenue",
      data: {
        model: "subscription",
        hasFreeTier: false,
        tiers: [],
        expansionPaths: [],
        contractionRisks: [],
        confidence: 0.6,
        evidence: [],
      },
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    // 2 sections filled out of 10 = 0.2
    expect(profile?.completeness).toBeCloseTo(0.2, 1);
    // Average confidence: (0.8 + 0.6) / 2 = 0.7
    expect(profile?.overallConfidence).toBeCloseTo(0.7, 1);
  });

  it("removes profile when called", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.remove, { productId });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile).toBeNull();
  });

  it("enforces ownership - cannot access other user's profile", async () => {
    const t = convexTest(schema);
    const { productId } = await setupUserAndProduct(t);

    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "other-clerk-id",
        email: "other@example.com",
        createdAt: Date.now(),
      });
    });
    const asOther = authenticatedUser(t, "other-clerk-id");

    const profile = await asOther.query(api.productProfiles.get, { productId });
    expect(profile).toBeNull();
  });
});
