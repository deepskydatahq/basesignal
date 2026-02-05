import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { selectPages, buildPageContext, parseExtractionResponse } from "./extractRevenue";

// --- Test helpers ---

function authenticatedUser(t: ReturnType<typeof convexTest>, clerkId = "test-clerk-id") {
  return t.withIdentity({
    subject: clerkId,
    issuer: "https://clerk.test",
    tokenIdentifier: `https://clerk.test|${clerkId}`,
  });
}

async function setupUserProductAndPages(
  t: ReturnType<typeof convexTest>,
  pages: Array<{ url: string; pageType: string; title?: string; content: string }>
) {
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

  for (const page of pages) {
    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: page.url,
      pageType: page.pageType,
      title: page.title,
      content: page.content,
    });
  }

  return { userId, productId, jobId, asUser };
}

function makePage(overrides: Partial<{
  url: string;
  pageType: string;
  title: string;
  content: string;
  contentLength: number;
}> = {}) {
  return {
    url: overrides.url ?? "https://test.io",
    pageType: overrides.pageType ?? "homepage",
    title: overrides.title,
    content: overrides.content ?? "Some content",
    contentLength: overrides.contentLength ?? (overrides.content?.length ?? 12),
  };
}

// --- Pure function tests ---

describe("selectPages", () => {
  it("prefers pricing pages with high confidence", () => {
    const pages = [
      makePage({ url: "https://test.io", pageType: "homepage" }),
      makePage({ url: "https://test.io/pricing", pageType: "pricing", content: "Plans" }),
      makePage({ url: "https://test.io/features", pageType: "features" }),
    ];

    const result = selectPages(pages);
    expect(result.confidence).toBe("high");
    expect(result.selectedPages).toHaveLength(1);
    expect(result.selectedPages[0].pageType).toBe("pricing");
  });

  it("falls back to homepage and features with medium confidence", () => {
    const pages = [
      makePage({ url: "https://test.io", pageType: "homepage" }),
      makePage({ url: "https://test.io/features", pageType: "features" }),
      makePage({ url: "https://test.io/about", pageType: "about" }),
    ];

    const result = selectPages(pages);
    expect(result.confidence).toBe("medium");
    expect(result.selectedPages).toHaveLength(2);
    expect(result.selectedPages.map((p) => p.pageType).sort()).toEqual(["features", "homepage"]);
  });

  it("uses all pages as last resort with low confidence", () => {
    const pages = [
      makePage({ url: "https://test.io/about", pageType: "about" }),
      makePage({ url: "https://test.io/blog", pageType: "blog" }),
    ];

    const result = selectPages(pages);
    expect(result.confidence).toBe("low");
    expect(result.selectedPages).toHaveLength(2);
  });

  it("selects multiple pricing pages when available", () => {
    const pages = [
      makePage({ url: "https://test.io/pricing", pageType: "pricing" }),
      makePage({ url: "https://test.io/pricing/enterprise", pageType: "pricing" }),
    ];

    const result = selectPages(pages);
    expect(result.confidence).toBe("high");
    expect(result.selectedPages).toHaveLength(2);
  });
});

describe("buildPageContext", () => {
  it("builds context from pages with titles and URLs", () => {
    const pages = [
      makePage({
        url: "https://test.io/pricing",
        pageType: "pricing",
        title: "Pricing - Test Product",
        content: "## Plans\n- Free: $0\n- Pro: $29/mo",
      }),
    ];

    const context = buildPageContext(pages);
    expect(context).toContain("https://test.io/pricing");
    expect(context).toContain("pricing");
    expect(context).toContain("Pricing - Test Product");
    expect(context).toContain("## Plans");
  });

  it("truncates long content per page", () => {
    const longContent = "x".repeat(20_000);
    const pages = [
      makePage({ content: longContent, pageType: "pricing" }),
    ];

    const context = buildPageContext(pages);
    expect(context).toContain("[...truncated]");
    expect(context.length).toBeLessThan(longContent.length);
  });

  it("handles pages without titles", () => {
    const pages = [
      makePage({ url: "https://test.io/pricing", pageType: "pricing", content: "Plans" }),
    ];

    const context = buildPageContext(pages);
    expect(context).not.toContain("Title:");
    expect(context).toContain("Plans");
  });
});

describe("parseExtractionResponse", () => {
  const samplePages = [
    makePage({ url: "https://test.io/pricing", pageType: "pricing", title: "Pricing" }),
  ];

  it("parses a valid JSON response", () => {
    const response = JSON.stringify({
      model: "subscription",
      billingUnit: "seat",
      hasFreeTier: true,
      tiers: [
        { name: "Free", price: "$0", features: ["Basic"] },
        { name: "Pro", price: "$29/month", features: ["Advanced", "Priority Support"] },
      ],
      expansionPaths: ["add seats", "upgrade tier"],
      contractionRisks: ["seat reduction", "downgrade to free"],
      confidence: 0.9,
    });

    const result = parseExtractionResponse(response, samplePages, "high");

    expect(result.model).toBe("subscription");
    expect(result.billingUnit).toBe("seat");
    expect(result.hasFreeTier).toBe(true);
    expect(result.tiers).toHaveLength(2);
    expect(result.tiers[0].name).toBe("Free");
    expect(result.tiers[1].features).toContain("Priority Support");
    expect(result.expansionPaths).toHaveLength(2);
    expect(result.contractionRisks).toHaveLength(2);
    expect(result.confidence).toBe(0.9);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].url).toBe("https://test.io/pricing");
  });

  it("adjusts confidence for medium page selection", () => {
    const response = JSON.stringify({
      model: "subscription",
      hasFreeTier: false,
      tiers: [],
      expansionPaths: [],
      contractionRisks: [],
      confidence: 0.8,
    });

    const result = parseExtractionResponse(response, samplePages, "medium");
    expect(result.confidence).toBe(0.64); // 0.8 * 0.8
  });

  it("adjusts confidence for low page selection", () => {
    const response = JSON.stringify({
      model: "subscription",
      hasFreeTier: false,
      tiers: [],
      expansionPaths: [],
      contractionRisks: [],
      confidence: 0.8,
    });

    const result = parseExtractionResponse(response, samplePages, "low");
    expect(result.confidence).toBe(0.48); // 0.8 * 0.6
  });

  it("handles null billingUnit", () => {
    const response = JSON.stringify({
      model: "usage-based",
      billingUnit: null,
      hasFreeTier: false,
      tiers: [],
      expansionPaths: [],
      contractionRisks: [],
      confidence: 0.7,
    });

    const result = parseExtractionResponse(response, samplePages, "high");
    expect(result.billingUnit).toBeUndefined();
  });

  it("throws on missing model field", () => {
    const response = JSON.stringify({
      hasFreeTier: false,
      confidence: 0.7,
    });

    expect(() => parseExtractionResponse(response, samplePages, "high")).toThrow("Missing or invalid 'model'");
  });

  it("throws on non-JSON response", () => {
    expect(() => parseExtractionResponse("No pricing info found.", samplePages, "high")).toThrow(
      "Failed to extract JSON"
    );
  });

  it("extracts JSON embedded in other text", () => {
    const response = `Here is the extraction:\n${JSON.stringify({
      model: "freemium",
      hasFreeTier: true,
      tiers: [{ name: "Free", price: "$0", features: [] }],
      expansionPaths: [],
      contractionRisks: [],
      confidence: 0.6,
    })}\nThat's the result.`;

    const result = parseExtractionResponse(response, samplePages, "high");
    expect(result.model).toBe("freemium");
    expect(result.hasFreeTier).toBe(true);
  });
});

// --- Internal query/mutation tests ---

describe("crawledPages.listByProductInternal", () => {
  it("returns all pages for a product without auth", async () => {
    const t = convexTest(schema);
    const { productId } = await setupUserProductAndPages(t, [
      { url: "https://test.io", pageType: "homepage", content: "Home" },
      { url: "https://test.io/pricing", pageType: "pricing", content: "Plans" },
    ]);

    const pages = await t.query(internal.crawledPages.listByProductInternal, { productId });
    expect(pages).toHaveLength(2);
  });
});

describe("productProfiles.getInternal", () => {
  it("returns profile without auth check", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserProductAndPages(t, []);

    await asUser.mutation(api.productProfiles.create, { productId });
    const profile = await t.query(internal.productProfiles.getInternal, { productId });

    expect(profile).toBeDefined();
    expect(profile?.completeness).toBe(0);
  });

  it("returns null when no profile exists", async () => {
    const t = convexTest(schema);
    const { productId } = await setupUserProductAndPages(t, []);

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile).toBeNull();
  });
});

describe("productProfiles.updateSectionInternal", () => {
  it("creates profile if missing and updates section", async () => {
    const t = convexTest(schema);
    const { productId } = await setupUserProductAndPages(t, []);

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "revenue",
      data: {
        model: "subscription",
        hasFreeTier: true,
        tiers: [{ name: "Free", price: "$0", features: ["Basic"] }],
        expansionPaths: ["seats"],
        contractionRisks: ["churn"],
        confidence: 0.8,
        evidence: [{ url: "https://test.io/pricing", excerpt: "Plans start at $0" }],
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile).toBeDefined();
    expect(profile?.revenue?.model).toBe("subscription");
    expect(profile?.revenue?.hasFreeTier).toBe(true);
    expect(profile?.completeness).toBeCloseTo(0.1, 1); // 1 of 10 sections
    expect(profile?.overallConfidence).toBeCloseTo(0.8, 1);
  });

  it("updates existing profile section", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserProductAndPages(t, []);

    // Create profile first via user mutation
    await asUser.mutation(api.productProfiles.create, { productId });

    // Then update via internal mutation
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "revenue",
      data: {
        model: "usage-based",
        billingUnit: "request",
        hasFreeTier: false,
        tiers: [],
        expansionPaths: ["increase usage"],
        contractionRisks: ["usage decrease"],
        confidence: 0.7,
        evidence: [],
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.revenue?.model).toBe("usage-based");
    expect(profile?.revenue?.billingUnit).toBe("request");
  });

  it("recalculates completeness with multiple sections", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserProductAndPages(t, []);
    await asUser.mutation(api.productProfiles.create, { productId });

    // Set identity via user mutation
    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Acme",
        description: "Tool",
        targetCustomer: "Devs",
        businessModel: "SaaS",
        confidence: 0.9,
        evidence: [],
      },
    });

    // Set revenue via internal mutation
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "revenue",
      data: {
        model: "subscription",
        hasFreeTier: true,
        tiers: [],
        expansionPaths: [],
        contractionRisks: [],
        confidence: 0.7,
        evidence: [],
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    // 2 out of 10 sections
    expect(profile?.completeness).toBeCloseTo(0.2, 1);
    // Average of 0.9 and 0.7
    expect(profile?.overallConfidence).toBeCloseTo(0.8, 1);
  });
});
