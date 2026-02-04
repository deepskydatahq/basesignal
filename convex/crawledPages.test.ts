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

async function setupUserProductAndJob(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
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
  return { productId, jobId, asUser };
}

describe("crawledPages", () => {
  it("can store a crawled page", async () => {
    const t = convexTest(schema);
    const { productId, jobId, asUser } = await setupUserProductAndJob(t);

    const pageId = await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io",
      pageType: "homepage",
      title: "Test Product - Home",
      content: "# Welcome to Test Product",
    });

    expect(pageId).toBeDefined();

    const pages = await asUser.query(api.crawledPages.listByScanJob, { scanJobId: jobId });
    expect(pages).toHaveLength(1);
    expect(pages[0].url).toBe("https://test.io");
    expect(pages[0].pageType).toBe("homepage");
    expect(pages[0].content).toBe("# Welcome to Test Product");
    expect(pages[0].contentLength).toBe(25);
  });

  it("truncates content exceeding 100KB", async () => {
    const t = convexTest(schema);
    const { productId, jobId, asUser } = await setupUserProductAndJob(t);

    const longContent = "x".repeat(150_000);
    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io/big",
      pageType: "other",
      content: longContent,
    });

    const pages = await asUser.query(api.crawledPages.listByScanJob, { scanJobId: jobId });
    expect(pages[0].content.length).toBe(100_000);
    // contentLength stores the original length
    expect(pages[0].contentLength).toBe(150_000);
  });

  it("can list pages by product", async () => {
    const t = convexTest(schema);
    const { productId, jobId, asUser } = await setupUserProductAndJob(t);

    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io",
      pageType: "homepage",
      content: "Home",
    });
    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io/pricing",
      pageType: "pricing",
      content: "Pricing",
    });

    const pages = await asUser.query(api.crawledPages.listByProduct, { productId });
    expect(pages).toHaveLength(2);
  });

  it("can filter pages by type", async () => {
    const t = convexTest(schema);
    const { productId, jobId, asUser } = await setupUserProductAndJob(t);

    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io",
      pageType: "homepage",
      content: "Home",
    });
    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io/pricing",
      pageType: "pricing",
      content: "Pricing",
    });
    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io/about",
      pageType: "about",
      content: "About",
    });

    const pricingPages = await asUser.query(api.crawledPages.getByProductAndType, {
      productId,
      pageType: "pricing",
    });
    expect(pricingPages).toHaveLength(1);
    expect(pricingPages[0].url).toBe("https://test.io/pricing");
  });

  it("can remove all pages for a scan job", async () => {
    const t = convexTest(schema);
    const { productId, jobId, asUser } = await setupUserProductAndJob(t);

    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io",
      pageType: "homepage",
      content: "Home",
    });
    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io/pricing",
      pageType: "pricing",
      content: "Pricing",
    });

    await t.mutation(internal.crawledPages.removeByScanJob, { scanJobId: jobId });

    const pages = await asUser.query(api.crawledPages.listByScanJob, { scanJobId: jobId });
    expect(pages).toHaveLength(0);
  });

  it("stores metadata when provided", async () => {
    const t = convexTest(schema);
    const { productId, jobId, asUser } = await setupUserProductAndJob(t);

    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io",
      pageType: "homepage",
      content: "Home",
      metadata: {
        description: "Test product homepage",
        ogImage: "https://test.io/og.png",
      },
    });

    const pages = await asUser.query(api.crawledPages.listByScanJob, { scanJobId: jobId });
    expect(pages[0].metadata?.description).toBe("Test product homepage");
    expect(pages[0].metadata?.ogImage).toBe("https://test.io/og.png");
  });

  it("can list pages by product via internal query (no auth)", async () => {
    const t = convexTest(schema);
    const { productId, jobId } = await setupUserProductAndJob(t);

    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io",
      pageType: "homepage",
      content: "Home",
    });
    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io/features",
      pageType: "features",
      content: "Features",
    });

    // Internal query - no auth needed
    const pages = await t.query(internal.crawledPages.listByProductInternal, { productId });
    expect(pages).toHaveLength(2);
    expect(pages[0].pageType).toBeDefined();
  });

  it("enforces ownership - cannot list another user's pages", async () => {
    const t = convexTest(schema);
    const { productId, jobId } = await setupUserProductAndJob(t);

    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io",
      pageType: "homepage",
      content: "Home",
    });

    // Different user
    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "other-clerk-id",
        email: "other@example.com",
        createdAt: Date.now(),
      });
    });
    const asOther = authenticatedUser(t, "other-clerk-id");

    const pages = await asOther.query(api.crawledPages.listByProduct, { productId });
    expect(pages).toHaveLength(0);
  });
});
