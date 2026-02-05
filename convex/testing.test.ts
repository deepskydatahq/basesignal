import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

async function setupProduct(t: ReturnType<typeof convexTest>) {
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

function mockActivationDefinitions() {
  return {
    activation: {
      criteria: ["User creates first board", "User invites a collaborator"],
      timeWindow: "first_7d",
      reasoning: "Activation requires collaborative use",
      confidence: 0.8,
      source: "mock",
      evidence: [{ url: "https://test.io/features", excerpt: "Collaborate in real-time" }],
    },
    firstValue: {
      description: "User experiences value when their team starts using the board",
      criteria: ["Collaborator accesses shared board"],
      reasoning: "First value is collaborative engagement",
      confidence: 0.75,
      source: "mock",
      evidence: [{ url: "https://test.io", excerpt: "Built for teams" }],
    },
    active: {
      criteria: ["User creates or edits a board in the last 7 days"],
      timeWindow: "last_7d",
      reasoning: "Active users engage with boards weekly",
      confidence: 0.7,
      source: "mock",
      evidence: [],
    },
    churn: {
      criteria: ["No board activity in 30 days"],
      timeWindow: "last_30d",
      reasoning: "30 days of inactivity indicates churn risk",
      confidence: 0.65,
      source: "mock",
      evidence: [],
    },
  };
}

describe("testing.injectActivation", () => {
  it("injects activation definitions into a new profile", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProduct(t);
    const defs = mockActivationDefinitions();

    const profileId = await t.mutation(internal.testing.injectActivation, {
      productId,
      definitions: defs,
    });

    expect(profileId).toBeDefined();

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile).toBeDefined();
    expect(profile?.definitions?.activation?.criteria).toHaveLength(2);
    expect(profile?.definitions?.firstValue?.description).toContain("team starts using");
    expect(profile?.definitions?.active?.timeWindow).toBe("last_7d");
    expect(profile?.definitions?.churn?.criteria).toHaveLength(1);
  });

  it("auto-creates profile if missing", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProduct(t);

    await t.mutation(internal.testing.injectActivation, {
      productId,
      definitions: {
        activation: mockActivationDefinitions().activation,
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile).toBeDefined();
    expect(profile?.definitions?.activation).toBeDefined();
  });

  it("updates completeness when definitions are injected", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProduct(t);
    const defs = mockActivationDefinitions();

    await t.mutation(internal.testing.injectActivation, {
      productId,
      definitions: defs,
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    // 4 definition sub-sections out of 10 total = 0.4
    expect(profile?.completeness).toBeCloseTo(0.4, 1);
    // Average confidence across 4 definitions
    const expectedConfidence = (0.8 + 0.75 + 0.7 + 0.65) / 4;
    expect(profile?.overallConfidence).toBeCloseTo(expectedConfidence, 2);
  });

  it("merges with existing definitions", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProduct(t);
    const defs = mockActivationDefinitions();

    // Inject activation only
    await t.mutation(internal.testing.injectActivation, {
      productId,
      definitions: { activation: defs.activation },
    });

    // Inject active separately
    await t.mutation(internal.testing.injectActivation, {
      productId,
      definitions: { active: defs.active },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.definitions?.activation).toBeDefined();
    expect(profile?.definitions?.active).toBeDefined();
  });

  it("allows partial definitions (activation only)", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProduct(t);

    await t.mutation(internal.testing.injectActivation, {
      productId,
      definitions: {
        activation: mockActivationDefinitions().activation,
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.definitions?.activation).toBeDefined();
    expect(profile?.definitions?.firstValue).toBeUndefined();
    // 1 definition out of 10 total = 0.1
    expect(profile?.completeness).toBeCloseTo(0.1, 1);
  });
});

describe("testing.listProductsWithProfiles", () => {
  it("lists products with their profile status", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProduct(t);
    const defs = mockActivationDefinitions();

    // Inject activation data
    await t.mutation(internal.testing.injectActivation, {
      productId,
      definitions: defs,
    });

    const results = await t.query(internal.testing.listProductsWithProfiles, {});
    expect(results).toHaveLength(1);
    expect(results[0].hasProfile).toBe(true);
    expect(results[0].hasActivation).toBe(true);
    expect(results[0].hasFirstValue).toBe(true);
    expect(results[0].hasActive).toBe(true);
    expect(results[0].hasChurn).toBe(true);
  });

  it("reports products without profiles", async () => {
    const t = convexTest(schema);
    await setupProduct(t);

    const results = await t.query(internal.testing.listProductsWithProfiles, {});
    expect(results).toHaveLength(1);
    expect(results[0].hasProfile).toBe(false);
    expect(results[0].hasActivation).toBe(false);
    expect(results[0].completeness).toBe(0);
  });
});

describe("productProfiles.getMcp", () => {
  it("returns profile without auth", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProduct(t);

    // Create profile internally
    await t.mutation(internal.productProfiles.createInternal, { productId });

    // getMcp requires no auth
    const profile = await t.query(api.productProfiles.getMcp, { productId });
    expect(profile).toBeDefined();
    expect(profile?.completeness).toBe(0);
  });

  it("returns null for non-existent profile", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProduct(t);

    const profile = await t.query(api.productProfiles.getMcp, { productId });
    expect(profile).toBeNull();
  });

  it("returns profile with activation definitions", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProduct(t);
    const defs = mockActivationDefinitions();

    await t.mutation(internal.testing.injectActivation, {
      productId,
      definitions: defs,
    });

    const profile = await t.query(api.productProfiles.getMcp, { productId });
    expect(profile?.definitions?.activation?.criteria).toHaveLength(2);
    expect(profile?.completeness).toBeCloseTo(0.4, 1);
  });
});
