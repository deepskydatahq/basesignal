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
  await t.run(async (ctx) => {
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
  return { productId, asUser };
}

describe("scanJobs", () => {
  it("can create a scan job", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);

    const jobId = await asUser.mutation(api.scanJobs.create, {
      productId,
      url: "https://test.io",
    });

    expect(jobId).toBeDefined();

    const job = await asUser.query(api.scanJobs.get, { id: jobId });
    expect(job).toMatchObject({
      status: "mapping",
      url: "https://test.io",
      pagesCrawled: 0,
      currentPhase: "Discovering pages",
    });
    expect(job?.startedAt).toBeDefined();
  });

  it("can update progress", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);

    const jobId = await asUser.mutation(api.scanJobs.create, {
      productId,
      url: "https://test.io",
    });

    await t.mutation(internal.scanJobs.updateProgress, {
      jobId,
      status: "crawling",
      pagesTotal: 25,
      pagesCrawled: 5,
      currentPhase: "Crawling pages",
    });

    const job = await asUser.query(api.scanJobs.get, { id: jobId });
    expect(job?.status).toBe("crawling");
    expect(job?.pagesTotal).toBe(25);
    expect(job?.pagesCrawled).toBe(5);
  });

  it("can mark a job as complete", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);

    const jobId = await asUser.mutation(api.scanJobs.create, {
      productId,
      url: "https://test.io",
    });

    await t.mutation(internal.scanJobs.complete, { jobId });

    const job = await asUser.query(api.scanJobs.get, { id: jobId });
    expect(job?.status).toBe("complete");
    expect(job?.completedAt).toBeDefined();
  });

  it("can mark a job as failed", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);

    const jobId = await asUser.mutation(api.scanJobs.create, {
      productId,
      url: "https://test.io",
    });

    await t.mutation(internal.scanJobs.fail, {
      jobId,
      error: "Site unreachable",
    });

    const job = await asUser.query(api.scanJobs.get, { id: jobId });
    expect(job?.status).toBe("failed");
    expect(job?.error).toBe("Site unreachable");
    expect(job?.completedAt).toBeDefined();
  });

  it("can list jobs by product", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);

    await asUser.mutation(api.scanJobs.create, { productId, url: "https://test.io" });
    await asUser.mutation(api.scanJobs.create, { productId, url: "https://test.io" });

    const jobs = await asUser.query(api.scanJobs.listByProduct, { productId });
    expect(jobs).toHaveLength(2);
  });

  it("enforces ownership on get", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);

    const jobId = await asUser.mutation(api.scanJobs.create, {
      productId,
      url: "https://test.io",
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

    const job = await asOther.query(api.scanJobs.get, { id: jobId });
    expect(job).toBeNull();
  });

  it("can store discovered resources in progress update", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);

    const jobId = await asUser.mutation(api.scanJobs.create, {
      productId,
      url: "https://test.io",
    });

    await t.mutation(internal.scanJobs.updateProgress, {
      jobId,
      discoveredDocs: "https://docs.test.io",
      discoveredPricing: "https://test.io/pricing",
      crawledPages: [
        { url: "https://test.io", pageType: "homepage", title: "Test" },
        { url: "https://test.io/pricing", pageType: "pricing", title: "Pricing" },
      ],
    });

    const job = await asUser.query(api.scanJobs.get, { id: jobId });
    expect(job?.discoveredDocs).toBe("https://docs.test.io");
    expect(job?.discoveredPricing).toBe("https://test.io/pricing");
    expect(job?.crawledPages).toHaveLength(2);
  });

  it("can transition to analyzing status via updateStatus", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);

    const jobId = await asUser.mutation(api.scanJobs.create, {
      productId,
      url: "https://test.io",
    });

    await t.mutation(internal.scanJobs.complete, { jobId });
    await t.mutation(internal.scanJobs.updateStatus, {
      jobId,
      status: "analyzing",
      currentPhase: "Running analysis extractors",
    });

    const job = await asUser.query(api.scanJobs.get, { id: jobId });
    expect(job?.status).toBe("analyzing");
    expect(job?.currentPhase).toBe("Running analysis extractors");
  });

  it("can transition from analyzing to analyzed status", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t);

    const jobId = await asUser.mutation(api.scanJobs.create, {
      productId,
      url: "https://test.io",
    });

    await t.mutation(internal.scanJobs.complete, { jobId });
    await t.mutation(internal.scanJobs.updateStatus, {
      jobId,
      status: "analyzing",
      currentPhase: "Running analysis extractors",
    });
    await t.mutation(internal.scanJobs.updateStatus, {
      jobId,
      status: "analyzed",
      currentPhase: "Analysis complete",
    });

    const job = await asUser.query(api.scanJobs.get, { id: jobId });
    expect(job?.status).toBe("analyzed");
    expect(job?.currentPhase).toBe("Analysis complete");
  });
});
