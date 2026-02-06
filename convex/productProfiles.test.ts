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

  it("can create profile internally without auth", async () => {
    const t = convexTest(schema);
    // Directly insert user and product (no auth needed for internal)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });
    const productId = await t.run(async (ctx) => {
      return await ctx.db.insert("products", {
        userId,
        name: "Test Product",
        url: "https://test.io",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const profileId = await t.mutation(internal.productProfiles.createInternal, { productId });
    expect(profileId).toBeDefined();

    // Verify via internal get
    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile).toBeDefined();
    expect(profile?.completeness).toBe(0);
    expect(profile?.overallConfidence).toBe(0);
  });

  it("can update section internally without auth", async () => {
    const t = convexTest(schema);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });
    const productId = await t.run(async (ctx) => {
      return await ctx.db.insert("products", {
        userId,
        name: "Test Product",
        url: "https://test.io",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.mutation(internal.productProfiles.createInternal, { productId });

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "identity",
      data: {
        productName: "Acme SaaS",
        description: "A project management tool",
        targetCustomer: "Engineering teams",
        businessModel: "B2B SaaS",
        confidence: 0.75,
        evidence: [{ url: "https://acme.io", excerpt: "Built for engineers" }],
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.identity?.productName).toBe("Acme SaaS");
    expect(profile?.identity?.confidence).toBe(0.75);
    expect(profile?.completeness).toBeCloseTo(0.1, 1);
  });

  it("createInternal is idempotent", async () => {
    const t = convexTest(schema);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });
    const productId = await t.run(async (ctx) => {
      return await ctx.db.insert("products", {
        userId,
        name: "Test Product",
        url: "https://test.io",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const id1 = await t.mutation(internal.productProfiles.createInternal, { productId });
    const id2 = await t.mutation(internal.productProfiles.createInternal, { productId });
    expect(id1).toEqual(id2);
  });

  it("uses legacy activation.confidence for completeness when no levels exist", async () => {
    const t = convexTest(schema);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });
    const productId = await t.run(async (ctx) => {
      return await ctx.db.insert("products", {
        userId,
        name: "Test Product",
        url: "https://test.io",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.mutation(internal.productProfiles.createInternal, { productId });

    // Store legacy activation format (flat, no levels)
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "definitions",
      data: {
        activation: {
          criteria: ["Signup completed"],
          timeWindow: "first_7d",
          reasoning: "Basic activation",
          confidence: 0.7,
          source: "crawl",
          evidence: [],
        },
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    // definitions.activation is 1 of 10 sections = 0.1
    expect(profile?.completeness).toBeCloseTo(0.1, 1);
    // Confidence should use legacy activation.confidence = 0.7
    expect(profile?.overallConfidence).toBeCloseTo(0.7, 1);
  });

  it("uses activation.overallConfidence when levels exist", async () => {
    const t = convexTest(schema);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });
    const productId = await t.run(async (ctx) => {
      return await ctx.db.insert("products", {
        userId,
        name: "Test Product",
        url: "https://test.io",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.mutation(internal.productProfiles.createInternal, { productId });

    // Store multi-level activation format
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "definitions",
      data: {
        activation: {
          levels: [
            {
              level: 1,
              name: "Setup",
              signalStrength: "weak",
              criteria: [{ action: "Account Created", count: 1 }],
              reasoning: "Basic setup",
              confidence: 0.9,
              evidence: [],
            },
            {
              level: 2,
              name: "Aha moment",
              signalStrength: "strong",
              criteria: [{ action: "First Project Created", count: 1 }],
              reasoning: "Core value",
              confidence: 0.8,
              evidence: [],
            },
          ],
          primaryActivation: 2,
          overallConfidence: 0.85,
        },
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    // definitions.activation is 1 of 10 sections = 0.1
    expect(profile?.completeness).toBeCloseTo(0.1, 1);
    // Should use overallConfidence (0.85), NOT individual level confidences
    expect(profile?.overallConfidence).toBeCloseTo(0.85, 1);
  });

  it("persists all 4 levels when storing multi-level activation via updateSectionInternal", async () => {
    const t = convexTest(schema);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });
    const productId = await t.run(async (ctx) => {
      return await ctx.db.insert("products", {
        userId,
        name: "Test Product",
        url: "https://test.io",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.mutation(internal.productProfiles.createInternal, { productId });

    const fourLevels = {
      activation: {
        levels: [
          {
            level: 1,
            name: "Setup",
            signalStrength: "weak" as const,
            criteria: [{ action: "Account Created", count: 1 }],
            reasoning: "Account creation is table stakes",
            confidence: 0.9,
            evidence: [{ url: "https://test.io/signup", excerpt: "Sign up free" }],
          },
          {
            level: 2,
            name: "Onboarding",
            signalStrength: "medium" as const,
            criteria: [{ action: "Profile Completed", count: 1 }, { action: "Tutorial Started", count: 1 }],
            reasoning: "Completing profile shows intent",
            confidence: 0.75,
            evidence: [],
          },
          {
            level: 3,
            name: "Aha Moment",
            signalStrength: "strong" as const,
            criteria: [{ action: "First Project Created", count: 1 }],
            reasoning: "Creating a project demonstrates core value",
            confidence: 0.8,
            evidence: [{ url: "https://test.io/docs", excerpt: "Create your first project" }],
          },
          {
            level: 4,
            name: "Habit Formation",
            signalStrength: "very_strong" as const,
            criteria: [{ action: "Project Created", count: 3, timeWindow: "first_14d" }],
            reasoning: "Repeated usage signals habit",
            confidence: 0.65,
            evidence: [],
          },
        ],
        primaryActivation: 3,
        overallConfidence: 0.78,
      },
    };

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "definitions",
      data: fourLevels,
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    const activation = (profile as any)?.definitions?.activation;

    // Verify all 4 levels persisted
    expect(activation.levels).toHaveLength(4);
    expect(activation.levels[0].name).toBe("Setup");
    expect(activation.levels[0].signalStrength).toBe("weak");
    expect(activation.levels[1].name).toBe("Onboarding");
    expect(activation.levels[1].criteria).toHaveLength(2);
    expect(activation.levels[2].name).toBe("Aha Moment");
    expect(activation.levels[2].signalStrength).toBe("strong");
    expect(activation.levels[3].name).toBe("Habit Formation");
    expect(activation.levels[3].signalStrength).toBe("very_strong");
    expect(activation.levels[3].criteria[0].timeWindow).toBe("first_14d");

    // Verify primaryActivation and overallConfidence
    expect(activation.primaryActivation).toBe(3);
    expect(activation.overallConfidence).toBe(0.78);

    // Verify evidence persisted
    expect(activation.levels[0].evidence).toHaveLength(1);
    expect(activation.levels[0].evidence[0].url).toBe("https://test.io/signup");
  });

  it("calculates correct completeness with multi-level activation and other sections", async () => {
    const t = convexTest(schema);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });
    const productId = await t.run(async (ctx) => {
      return await ctx.db.insert("products", {
        userId,
        name: "Test Product",
        url: "https://test.io",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.mutation(internal.productProfiles.createInternal, { productId });

    // Add identity section (1 of 10)
    await t.mutation(internal.productProfiles.updateSectionInternal, {
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

    // Add multi-level activation definition (2 of 10)
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "definitions",
      data: {
        activation: {
          levels: [
            {
              level: 1,
              name: "Setup",
              signalStrength: "weak" as const,
              criteria: [{ action: "Account Created", count: 1 }],
              reasoning: "Basic setup",
              confidence: 0.9,
              evidence: [],
            },
            {
              level: 2,
              name: "Aha Moment",
              signalStrength: "strong" as const,
              criteria: [{ action: "First Project Created", count: 1 }],
              reasoning: "Core value",
              confidence: 0.8,
              evidence: [],
            },
          ],
          primaryActivation: 2,
          overallConfidence: 0.85,
        },
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    // 2 sections filled out of 10 = 0.2
    expect(profile?.completeness).toBeCloseTo(0.2, 1);
    // Average confidence: (identity 0.8 + activation overallConfidence 0.85) / 2 = 0.825
    expect(profile?.overallConfidence).toBeCloseTo(0.825, 2);
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
