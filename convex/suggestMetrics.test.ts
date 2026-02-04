import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { classifyArchetype, selectMetrics } from "./lib/metricSuggestions";

/**
 * Integration tests for the suggestMetrics pipeline.
 *
 * Since convex-test doesn't support internalAction well (ctx.runMutation
 * causes "Write outside of transaction" errors), we test the integration
 * by exercising the same data flow: getInternal → classifyArchetype →
 * selectMetrics → updateSectionInternal, using convex-test for the
 * Convex portions and direct calls for the pure functions.
 */

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

describe("suggestMetrics integration", () => {
  it("getInternal returns profile without auth", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });
    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Acme",
        description: "A tool",
        targetCustomer: "Devs",
        businessModel: "B2B SaaS",
        confidence: 0.8,
        evidence: [],
      },
    });

    // Internal query (no auth needed)
    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile).not.toBeNull();
    expect(profile?.identity?.businessModel).toBe("B2B SaaS");
  });

  it("updateSectionInternal stores metrics without auth", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    const metrics = [
      { name: "Activation Rate", category: "reach", formula: "activated / signups", linkedTo: ["activation"] },
    ];

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "metrics",
      data: {
        items: metrics,
        confidence: 0.7,
        evidence: [],
      },
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile?.metrics?.items).toHaveLength(1);
    expect(profile?.metrics?.items[0].name).toBe("Activation Rate");
    expect(profile?.completeness).toBeGreaterThan(0);
  });

  it("full pipeline: PLG product gets correct metrics stored", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    // Set identity
    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Acme SaaS",
        description: "Project management",
        targetCustomer: "Engineering teams",
        businessModel: "Product-Led Growth SaaS",
        confidence: 0.8,
        evidence: [],
      },
    });

    // Set revenue
    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "revenue",
      data: {
        model: "subscription",
        hasFreeTier: true,
        tiers: [{ name: "Free", price: "$0", features: ["Basic"] }],
        expansionPaths: ["seats"],
        contractionRisks: ["churn"],
        confidence: 0.7,
        evidence: [],
      },
    });

    // Simulate what the action does:
    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    const archetype = classifyArchetype(profile!.identity!, profile!.revenue ?? undefined);
    expect(archetype).toBe("plg");

    const metrics = selectMetrics(archetype);
    expect(metrics.length).toBeGreaterThan(5);

    // Store via internal mutation
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "metrics",
      data: {
        items: metrics,
        confidence: 0.7,
        evidence: [],
      },
    });

    // Verify stored result
    const updated = await asUser.query(api.productProfiles.get, { productId });
    expect(updated?.metrics?.items.length).toBe(metrics.length);

    const names = updated?.metrics?.items.map((m: { name: string }) => m.name) ?? [];
    expect(names).toContain("Activation Rate");
    expect(names).toContain("Trial-to-Paid Conversion");
    expect(names).toContain("Time to First Value");
  });

  it("full pipeline: sales-led product gets correct metrics", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Enterprise Platform",
        description: "Security compliance",
        targetCustomer: "CISOs",
        businessModel: "Enterprise sales-led",
        confidence: 0.9,
        evidence: [],
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    const archetype = classifyArchetype(profile!.identity!);
    expect(archetype).toBe("sales_led");

    const metrics = selectMetrics(archetype);
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "metrics",
      data: { items: metrics, confidence: 0.7, evidence: [] },
    });

    const updated = await asUser.query(api.productProfiles.get, { productId });
    const names = updated?.metrics?.items.map((m: { name: string }) => m.name) ?? [];
    expect(names).toContain("Qualified Leads");
    expect(names).toContain("Average Deal Size");
    expect(names).not.toContain("Trial-to-Paid Conversion");
  });

  it("full pipeline: marketplace product gets correct metrics", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Uber for X",
        description: "Two-sided marketplace",
        targetCustomer: "Buyers and sellers",
        businessModel: "Two-sided marketplace",
        confidence: 0.8,
        evidence: [],
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    const archetype = classifyArchetype(profile!.identity!);
    expect(archetype).toBe("marketplace");

    const metrics = selectMetrics(archetype);
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "metrics",
      data: { items: metrics, confidence: 0.7, evidence: [] },
    });

    const updated = await asUser.query(api.productProfiles.get, { productId });
    const names = updated?.metrics?.items.map((m: { name: string }) => m.name) ?? [];
    expect(names).toContain("Liquidity Rate");
    expect(names).toContain("Gross Merchandise Value");
    expect(names).toContain("Take Rate");
  });

  it("metrics include all required categories for each archetype", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Test",
        description: "Test",
        targetCustomer: "Test",
        businessModel: "Product-Led Growth",
        confidence: 0.8,
        evidence: [],
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    const archetype = classifyArchetype(profile!.identity!);
    const metrics = selectMetrics(archetype);

    const categories = new Set(metrics.map((m) => m.category));
    expect(categories.has("reach")).toBe(true);
    expect(categories.has("engagement")).toBe(true);
    expect(categories.has("retention")).toBe(true);
    expect(categories.has("revenue")).toBe(true);
    expect(categories.has("value")).toBe(true);
  });
});
