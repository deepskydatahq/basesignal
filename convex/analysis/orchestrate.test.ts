import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

function authenticatedUser(t: ReturnType<typeof convexTest>, clerkId = "test-clerk-id") {
  return t.withIdentity({
    subject: clerkId,
    issuer: "https://clerk.test",
    tokenIdentifier: `https://clerk.test|${clerkId}`,
  });
}

async function setupFullScanScenario(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-clerk-id",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });
  const asUser = authenticatedUser(t);
  const productId = await asUser.mutation(api.products.create, {
    name: "Test Product",
    url: "https://test.io",
  });
  const jobId = await asUser.mutation(api.scanJobs.create, {
    productId,
    url: "https://test.io",
  });

  // Store some crawled pages
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io",
    pageType: "homepage",
    title: "Test Product - Home",
    content: "# Welcome to Test Product\nWe help engineering teams ship faster.",
  });
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io/pricing",
    pageType: "pricing",
    title: "Pricing",
    content: "# Pricing\nFree tier available. Pro: $29/mo. Enterprise: custom.",
  });
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io/about",
    pageType: "about",
    title: "About Us",
    content: "# About\nFounded in 2024. B2B SaaS for developer tools.",
  });

  // Complete the scan
  await t.mutation(internal.scanJobs.complete, { jobId });

  return { userId, productId, jobId, asUser };
}

describe("analysis orchestration", () => {
  describe("orchestration prerequisites", () => {
    it("can create profile and fetch crawled pages for analysis", async () => {
      const t = convexTest(schema);
      const { productId } = await setupFullScanScenario(t);

      // Create profile via internal mutation
      const profileId = await t.mutation(internal.productProfiles.createInternal, { productId });
      expect(profileId).toBeDefined();

      // Fetch crawled pages via internal query
      const pages = await t.query(internal.crawledPages.listByProductInternal, { productId });
      expect(pages).toHaveLength(3);
      expect(pages.some(p => p.pageType === "homepage")).toBe(true);
      expect(pages.some(p => p.pageType === "pricing")).toBe(true);
    });

    it("can store extraction results via updateSectionInternal", async () => {
      const t = convexTest(schema);
      const { productId } = await setupFullScanScenario(t);

      await t.mutation(internal.productProfiles.createInternal, { productId });

      // Simulate storing identity extraction result
      await t.mutation(internal.productProfiles.updateSectionInternal, {
        productId,
        section: "identity",
        data: {
          productName: "Test Product",
          description: "A developer tool for shipping faster",
          targetCustomer: "Engineering teams",
          businessModel: "B2B SaaS",
          confidence: 0.8,
          evidence: [{ url: "https://test.io", excerpt: "We help engineering teams ship faster" }],
        },
      });

      // Simulate storing revenue extraction result
      await t.mutation(internal.productProfiles.updateSectionInternal, {
        productId,
        section: "revenue",
        data: {
          model: "subscription",
          hasFreeTier: true,
          tiers: [
            { name: "Free", price: "$0", features: ["Basic"] },
            { name: "Pro", price: "$29/mo", features: ["Advanced"] },
          ],
          expansionPaths: ["seat-based", "tier upgrade"],
          contractionRisks: ["competitor switching"],
          confidence: 0.7,
          evidence: [{ url: "https://test.io/pricing", excerpt: "Free tier available" }],
        },
      });

      const profile = await t.query(internal.productProfiles.getInternal, { productId });
      expect(profile?.identity?.productName).toBe("Test Product");
      expect(profile?.revenue?.model).toBe("subscription");
      expect(profile?.completeness).toBeCloseTo(0.2, 1);
    });

    it("can transition scan job through analysis states", async () => {
      const t = convexTest(schema);
      const { productId, jobId, asUser } = await setupFullScanScenario(t);

      // Transition to analyzing
      await t.mutation(internal.scanJobs.updateStatus, {
        jobId,
        status: "analyzing",
        currentPhase: "Running analysis extractors",
      });

      let job = await asUser.query(api.scanJobs.get, { id: jobId });
      expect(job?.status).toBe("analyzing");

      // Transition to analyzed
      await t.mutation(internal.scanJobs.updateStatus, {
        jobId,
        status: "analyzed",
        currentPhase: "Analysis complete",
      });

      job = await asUser.query(api.scanJobs.get, { id: jobId });
      expect(job?.status).toBe("analyzed");
    });

    it("supports partial profile when some extractors fail", async () => {
      const t = convexTest(schema);
      const { productId } = await setupFullScanScenario(t);

      await t.mutation(internal.productProfiles.createInternal, { productId });

      // Only identity succeeds
      await t.mutation(internal.productProfiles.updateSectionInternal, {
        productId,
        section: "identity",
        data: {
          productName: "Test Product",
          description: "A tool",
          targetCustomer: "Teams",
          businessModel: "SaaS",
          confidence: 0.6,
          evidence: [],
        },
      });

      // revenue, entities, outcomes would "fail" - not stored

      const profile = await t.query(internal.productProfiles.getInternal, { productId });
      expect(profile?.identity).toBeDefined();
      expect(profile?.revenue).toBeUndefined();
      expect(profile?.entities).toBeUndefined();
      expect(profile?.completeness).toBeCloseTo(0.1, 1);
    });

    it("can store all six sections to build a complete profile", async () => {
      const t = convexTest(schema);
      const { productId } = await setupFullScanScenario(t);

      await t.mutation(internal.productProfiles.createInternal, { productId });

      const sections = {
        identity: {
          productName: "Test Product",
          description: "Tool",
          targetCustomer: "Teams",
          businessModel: "SaaS",
          confidence: 0.8,
          evidence: [],
        },
        revenue: {
          model: "subscription",
          hasFreeTier: true,
          tiers: [],
          expansionPaths: [],
          contractionRisks: [],
          confidence: 0.7,
          evidence: [],
        },
        entities: {
          items: [{ name: "User", type: "primary", properties: ["email", "name"] }],
          relationships: [],
          confidence: 0.6,
          evidence: [],
        },
        journey: {
          stages: [
            { name: "Signup", description: "Creates account", order: 1 },
            { name: "Activated", description: "Completes setup", order: 2 },
          ],
          confidence: 0.5,
          evidence: [],
        },
        outcomes: {
          items: [{ description: "Ships faster", type: "business", linkedFeatures: ["CI/CD"] }],
          confidence: 0.6,
          evidence: [],
        },
        metrics: {
          items: [{ name: "Activation Rate", category: "value_delivery", linkedTo: ["identity"] }],
          confidence: 0.5,
          evidence: [],
        },
      };

      for (const [section, data] of Object.entries(sections)) {
        await t.mutation(internal.productProfiles.updateSectionInternal, {
          productId,
          section,
          data,
        });
      }

      const profile = await t.query(internal.productProfiles.getInternal, { productId });
      // 6 top sections out of 10 = 0.6
      expect(profile?.completeness).toBeCloseTo(0.6, 1);
      expect(profile?.identity).toBeDefined();
      expect(profile?.revenue).toBeDefined();
      expect(profile?.entities).toBeDefined();
      expect(profile?.journey).toBeDefined();
      expect(profile?.outcomes).toBeDefined();
      expect(profile?.metrics).toBeDefined();
    });
  });

  describe("extractor prompt building", () => {
    it("buildPageContext concatenates pages into a structured context string", async () => {
      // Import the helper
      const { buildPageContext } = await import("./orchestrate");

      const pages = [
        { url: "https://test.io", pageType: "homepage", title: "Home", content: "Welcome" },
        { url: "https://test.io/pricing", pageType: "pricing", title: "Pricing", content: "Plans" },
      ];

      const context = buildPageContext(pages as any);
      expect(context).toContain("https://test.io");
      expect(context).toContain("homepage");
      expect(context).toContain("Welcome");
      expect(context).toContain("pricing");
      expect(context).toContain("Plans");
    });
  });
});
