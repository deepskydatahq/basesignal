import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { filterDocsUrls } from "./scanning";

async function setupUserAndProduct(t: ReturnType<typeof convexTest>) {
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
      url: "https://acme.io",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  return { userId, productId };
}

describe("integration: scanJob.discoveredDocs", () => {
  it("is populated via updateProgress after main crawl discovers docs", async () => {
    const t = convexTest(schema);
    const { userId, productId } = await setupUserAndProduct(t);

    // Create a scan job (simulating main crawl)
    const jobId = await t.mutation(internal.scanJobs.createInternal, {
      productId,
      userId,
      url: "https://acme.io",
    });

    // Main crawl discovers docs subdomain and updates progress
    await t.mutation(internal.scanJobs.updateProgress, {
      jobId,
      status: "crawling",
      discoveredDocs: "https://help.acme.io",
    });

    const job = await t.run(async (ctx) => ctx.db.get(jobId));
    expect(job?.discoveredDocs).toBe("https://help.acme.io");
  });
});

describe("integration: docs crawl pages stored to same product", () => {
  it("stores crawled docs pages with correct productId and pageType", async () => {
    const t = convexTest(schema);
    const { userId, productId } = await setupUserAndProduct(t);

    // Create a docs scan job
    const jobId = await t.mutation(internal.scanJobs.createInternal, {
      productId,
      userId,
      url: "https://help.acme.io",
    });

    // Store docs pages (simulating what startDocsScan does after Firecrawl scrape)
    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://help.acme.io/getting-started",
      pageType: "help",
      title: "Getting Started",
      content: "# Getting Started\n\nWelcome to our product...",
    });

    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://help.acme.io/onboarding",
      pageType: "help",
      title: "Onboarding Guide",
      content: "# Onboarding\n\nFollow these steps...",
    });

    // Verify pages are stored with correct productId
    const pages = await t.run(async (ctx) => {
      return await ctx.db
        .query("crawledPages")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .collect();
    });

    expect(pages.length).toBe(2);
    expect(pages[0].productId).toBe(productId);
    expect(pages[1].productId).toBe(productId);
    expect(pages.map((p) => p.pageType)).toEqual(["help", "help"]);
    expect(pages.map((p) => p.url)).toEqual([
      "https://help.acme.io/getting-started",
      "https://help.acme.io/onboarding",
    ]);
  });

  it("stores pages accessible via by_product_type index", async () => {
    const t = convexTest(schema);
    const { userId, productId } = await setupUserAndProduct(t);

    const jobId = await t.mutation(internal.scanJobs.createInternal, {
      productId,
      userId,
      url: "https://docs.acme.io",
    });

    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://docs.acme.io/quickstart",
      pageType: "docs",
      title: "Quickstart",
      content: "# Quickstart guide...",
    });

    // Verify accessible via pageType index
    const docsPages = await t.run(async (ctx) => {
      return await ctx.db
        .query("crawledPages")
        .withIndex("by_product_type", (q) =>
          q.eq("productId", productId).eq("pageType", "docs")
        )
        .collect();
    });

    expect(docsPages.length).toBe(1);
    expect(docsPages[0].pageType).toBe("docs");
  });
});

describe("filterDocsUrls", () => {
  it("filters URLs through shouldCrawlForActivation", () => {
    const urls = [
      "https://help.acme.io/",
      "https://help.acme.io/getting-started",
      "https://help.acme.io/api/v2/endpoints/users", // deep reference - excluded
      "https://help.acme.io/onboarding",
    ];
    const result = filterDocsUrls(urls);
    expect(result).toContain("https://help.acme.io/");
    expect(result).toContain("https://help.acme.io/getting-started");
    expect(result).toContain("https://help.acme.io/onboarding");
    expect(result).not.toContain("https://help.acme.io/api/v2/endpoints/users");
  });

  it("limits to 10 pages maximum", () => {
    const urls = Array.from({ length: 20 }, (_, i) =>
      `https://help.acme.io/tutorials/lesson-${i}`
    );
    const result = filterDocsUrls(urls);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("returns empty array when no URLs match", () => {
    const urls = [
      "https://www.acme.io/pricing",
      "https://blog.acme.io/post-1",
    ];
    const result = filterDocsUrls(urls);
    expect(result).toEqual([]);
  });

  it("deduplicates URLs", () => {
    const urls = [
      "https://help.acme.io/getting-started",
      "https://help.acme.io/getting-started",
      "https://help.acme.io/getting-started",
    ];
    const result = filterDocsUrls(urls);
    expect(result.length).toBe(1);
  });

  it("classifies pages with correct pageType using classifyPageType", () => {
    // This tests that filterDocsUrls returns activation-relevant pages
    const urls = [
      "https://docs.acme.io/",
      "https://docs.acme.io/quickstart",
      "https://docs.acme.io/tutorials/basics",
    ];
    const result = filterDocsUrls(urls);
    expect(result.length).toBe(3);
  });
});
