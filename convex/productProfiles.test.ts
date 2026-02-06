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

  describe("activation backward compatibility", () => {
    async function setupProfileWithDirectInsert(t: ReturnType<typeof convexTest>) {
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
      return { userId, productId };
    }

    it("stores and retrieves legacy activation format correctly", async () => {
      const t = convexTest(schema);
      const { productId } = await setupProfileWithDirectInsert(t);

      await t.mutation(internal.productProfiles.createInternal, { productId });
      await t.mutation(internal.productProfiles.updateSectionInternal, {
        productId,
        section: "definitions",
        data: {
          activation: {
            criteria: ["completed_onboarding", "created_first_project"],
            timeWindow: "first_7d",
            reasoning: "Users who complete onboarding and create a project are activated",
            confidence: 0.8,
            source: "website_analysis",
            evidence: [{ url: "https://example.com/docs", excerpt: "Getting started guide" }],
          },
        },
      });

      const profile = await t.query(internal.productProfiles.getInternal, { productId });
      const activation = profile?.definitions?.activation;
      expect(activation).toBeDefined();
      // Verify legacy fields are all present
      expect(activation?.criteria).toEqual(["completed_onboarding", "created_first_project"]);
      expect(activation?.timeWindow).toBe("first_7d");
      expect(activation?.reasoning).toBe("Users who complete onboarding and create a project are activated");
      expect(activation?.confidence).toBe(0.8);
      expect(activation?.source).toBe("website_analysis");
      expect(activation?.evidence).toHaveLength(1);
    });

    it("stores and retrieves new multi-level activation format correctly", async () => {
      const t = convexTest(schema);
      const { productId } = await setupProfileWithDirectInsert(t);

      await t.mutation(internal.productProfiles.createInternal, { productId });
      await t.mutation(internal.productProfiles.updateSectionInternal, {
        productId,
        section: "definitions",
        data: {
          activation: {
            levels: [
              {
                level: 1,
                name: "explorer",
                signalStrength: "weak",
                criteria: [{ action: "view_page", count: 1, timeWindow: "first_7d" }],
                reasoning: "Basic exploration",
                confidence: 0.6,
                evidence: [],
              },
              {
                level: 2,
                name: "creator",
                signalStrength: "medium",
                criteria: [{ action: "create_item", count: 1 }],
                reasoning: "Created first item",
                confidence: 0.75,
                evidence: [],
              },
              {
                level: 3,
                name: "collaborator",
                signalStrength: "strong",
                criteria: [
                  { action: "share_item", count: 1 },
                  { action: "invite_member", count: 1, timeWindow: "first_14d" },
                ],
                reasoning: "Sharing and inviting signals activation",
                confidence: 0.9,
                evidence: [{ url: "https://example.com", excerpt: "Collaboration features" }],
              },
              {
                level: 4,
                name: "team_adopter",
                signalStrength: "very_strong",
                criteria: [{ action: "add_team_member", count: 3, timeWindow: "first_30d" }],
                reasoning: "Team adoption is the strongest signal",
                confidence: 0.95,
                evidence: [],
              },
            ],
            primaryActivation: 3,
            overallConfidence: 0.85,
          },
        },
      });

      const profile = await t.query(internal.productProfiles.getInternal, { productId });
      const activation = profile?.definitions?.activation;
      expect(activation).toBeDefined();

      // Verify all 4 levels persisted
      expect(activation?.levels).toHaveLength(4);
      expect(activation?.levels[0].name).toBe("explorer");
      expect(activation?.levels[0].signalStrength).toBe("weak");
      expect(activation?.levels[1].signalStrength).toBe("medium");
      expect(activation?.levels[2].signalStrength).toBe("strong");
      expect(activation?.levels[3].signalStrength).toBe("very_strong");

      // Verify primaryActivation
      expect(activation?.primaryActivation).toBe(3);
      expect(activation?.overallConfidence).toBe(0.85);

      // Verify nested criteria structure
      expect(activation?.levels[2].criteria).toHaveLength(2);
      expect(activation?.levels[2].criteria[0].action).toBe("share_item");
      expect(activation?.levels[2].criteria[1].timeWindow).toBe("first_14d");
    });

    it("calculates completeness correctly with legacy activation format", async () => {
      const t = convexTest(schema);
      const { productId } = await setupProfileWithDirectInsert(t);

      await t.mutation(internal.productProfiles.createInternal, { productId });
      await t.mutation(internal.productProfiles.updateSectionInternal, {
        productId,
        section: "definitions",
        data: {
          activation: {
            criteria: ["signup", "first_action"],
            reasoning: "Basic activation",
            confidence: 0.7,
            source: "analysis",
            evidence: [],
          },
        },
      });

      const profile = await t.query(internal.productProfiles.getInternal, { productId });
      // 1 definition section out of 10 total = 0.1
      expect(profile?.completeness).toBeCloseTo(0.1, 1);
      // Legacy format: uses confidence directly
      expect(profile?.overallConfidence).toBeCloseTo(0.7, 1);
    });

    it("calculates completeness correctly with multi-level activation format", async () => {
      const t = convexTest(schema);
      const { productId } = await setupProfileWithDirectInsert(t);

      await t.mutation(internal.productProfiles.createInternal, { productId });
      await t.mutation(internal.productProfiles.updateSectionInternal, {
        productId,
        section: "definitions",
        data: {
          activation: {
            levels: [
              {
                level: 1,
                name: "explorer",
                signalStrength: "weak",
                criteria: [{ action: "view_page", count: 1, timeWindow: "first_7d" }],
                reasoning: "Basic exploration",
                confidence: 0.6,
                evidence: [],
              },
              {
                level: 2,
                name: "creator",
                signalStrength: "strong",
                criteria: [{ action: "create_item", count: 1 }],
                reasoning: "Created first item",
                confidence: 0.9,
                evidence: [],
              },
            ],
            primaryActivation: 2,
            overallConfidence: 0.85,
          },
        },
      });

      const profile = await t.query(internal.productProfiles.getInternal, { productId });
      // 1 definition section out of 10 total = 0.1
      expect(profile?.completeness).toBeCloseTo(0.1, 1);
      // Multi-level format: uses overallConfidence (0.85), not individual level confidences
      expect(profile?.overallConfidence).toBeCloseTo(0.85, 1);
    });

    it("validates signalStrength enum values correctly", async () => {
      const t = convexTest(schema);
      const { productId } = await setupProfileWithDirectInsert(t);

      await t.mutation(internal.productProfiles.createInternal, { productId });

      // Valid signalStrength values should succeed
      const validStrengths = ["weak", "medium", "strong", "very_strong"] as const;
      for (const strength of validStrengths) {
        await t.mutation(internal.productProfiles.updateSectionInternal, {
          productId,
          section: "definitions",
          data: {
            activation: {
              levels: [
                {
                  level: 1,
                  name: "test",
                  signalStrength: strength,
                  criteria: [{ action: "test", count: 1 }],
                  reasoning: "test",
                  confidence: 0.5,
                  evidence: [],
                },
              ],
              overallConfidence: 0.5,
            },
          },
        });
      }

      // Invalid signalStrength should throw
      await expect(
        t.mutation(internal.productProfiles.updateSectionInternal, {
          productId,
          section: "definitions",
          data: {
            activation: {
              levels: [
                {
                  level: 1,
                  name: "test",
                  signalStrength: "invalid",
                  criteria: [{ action: "test", count: 1 }],
                  reasoning: "test",
                  confidence: 0.5,
                  evidence: [],
                },
              ],
              overallConfidence: 0.5,
            },
          },
        }),
      ).rejects.toThrow();
    });

    it("allows mixed profiles - legacy and new format coexist", async () => {
      const t = convexTest(schema);
      const { userId } = await setupProfileWithDirectInsert(t);

      // Create two products for the same user
      const product1Id = await t.run(async (ctx) => {
        return await ctx.db.insert("products", {
          userId,
          name: "Legacy Product",
          url: "https://legacy.io",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      const product2Id = await t.run(async (ctx) => {
        return await ctx.db.insert("products", {
          userId,
          name: "Modern Product",
          url: "https://modern.io",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Create legacy profile
      await t.mutation(internal.productProfiles.createInternal, { productId: product1Id });
      await t.mutation(internal.productProfiles.updateSectionInternal, {
        productId: product1Id,
        section: "definitions",
        data: {
          activation: {
            criteria: ["signup", "first_action"],
            reasoning: "Legacy activation",
            confidence: 0.7,
            source: "analysis",
            evidence: [],
          },
        },
      });

      // Create multi-level profile
      await t.mutation(internal.productProfiles.createInternal, { productId: product2Id });
      await t.mutation(internal.productProfiles.updateSectionInternal, {
        productId: product2Id,
        section: "definitions",
        data: {
          activation: {
            levels: [
              {
                level: 1,
                name: "explorer",
                signalStrength: "weak",
                criteria: [{ action: "view", count: 1 }],
                reasoning: "Exploring",
                confidence: 0.5,
                evidence: [],
              },
            ],
            primaryActivation: 1,
            overallConfidence: 0.75,
          },
        },
      });

      // Query both and verify they coexist
      const profile1 = await t.query(internal.productProfiles.getInternal, { productId: product1Id });
      const profile2 = await t.query(internal.productProfiles.getInternal, { productId: product2Id });

      // Legacy profile has criteria
      expect(profile1?.definitions?.activation?.criteria).toEqual(["signup", "first_action"]);
      expect(profile1?.overallConfidence).toBeCloseTo(0.7, 1);

      // Multi-level profile has levels
      expect(profile2?.definitions?.activation?.levels).toHaveLength(1);
      expect(profile2?.overallConfidence).toBeCloseTo(0.75, 1);
    });
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
