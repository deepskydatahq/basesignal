import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// Module-level mock for Anthropic SDK - vi.hoisted ensures it runs before vi.mock
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));
vi.mock("@anthropic-ai/sdk", () => {
  // Must return a class-like constructor for `new Anthropic()`
  function MockAnthropic() {
    return { messages: { create: mockCreate } };
  }
  return { default: MockAnthropic };
});

function authenticatedUser(t: ReturnType<typeof convexTest>, clerkId = "test-clerk-id") {
  return t.withIdentity({
    subject: clerkId,
    issuer: "https://clerk.test",
    tokenIdentifier: `https://clerk.test|${clerkId}`,
  });
}

async function setupWithPages(t: ReturnType<typeof convexTest>) {
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
  await asUser.mutation(api.productProfiles.create, { productId });

  const jobId = await asUser.mutation(api.scanJobs.create, {
    productId,
    url: "https://test.io",
  });

  // Store crawled pages
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io",
    pageType: "homepage",
    content: "# Test Product\nA project management tool for teams.",
  });
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io/features",
    pageType: "features",
    content: "# Features\nCreate projects, assign tasks, track time.",
  });
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io/pricing",
    pageType: "pricing",
    content: "# Pricing\nFree for individuals. $10/seat/month for teams.",
  });

  return { userId, productId, jobId, asUser };
}

const VALID_ENTITY_RESPONSE = JSON.stringify({
  items: [
    { name: "User", type: "actor", properties: ["email", "role", "plan"] },
    { name: "Project", type: "object", properties: ["name", "status", "created_at"] },
    { name: "Task", type: "object", properties: ["title", "assignee", "due_date"] },
  ],
  relationships: [
    { from: "User", to: "Project", type: "creates" },
    { from: "User", to: "Task", type: "assigns" },
    { from: "Project", to: "Task", type: "contains" },
  ],
  confidence: 0.75,
  evidence: [
    { url: "https://test.io/features", excerpt: "Create projects, assign tasks" },
  ],
});

beforeEach(() => {
  mockCreate.mockReset();
});

describe("extractEntities", () => {
  it("extracts entities from crawled pages and stores in profile", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: VALID_ENTITY_RESPONSE }],
    });

    const t = convexTest(schema);
    const { productId } = await setupWithPages(t);

    await t.action(internal.extractEntities.extractEntities, { productId });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.entities).toBeDefined();
    expect(profile?.entities?.items).toHaveLength(3);
    expect(profile?.entities?.items[0].name).toBe("User");
    expect(profile?.entities?.relationships).toHaveLength(3);
    expect(profile?.entities?.confidence).toBe(0.75);
    expect(profile?.completeness).toBeGreaterThan(0);
  });

  it("handles JSON wrapped in code blocks", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "```json\n" + VALID_ENTITY_RESPONSE + "\n```" }],
    });

    const t = convexTest(schema);
    const { productId } = await setupWithPages(t);

    await t.action(internal.extractEntities.extractEntities, { productId });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.entities?.items).toHaveLength(3);
  });

  it("stores empty entities when no pages exist", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });
    const asUser = authenticatedUser(t);
    const productId = await asUser.mutation(api.products.create, {
      name: "Empty Product",
      url: "https://empty.io",
    });
    await asUser.mutation(api.productProfiles.create, { productId });

    await t.action(internal.extractEntities.extractEntities, { productId });

    // Should not have called Claude
    expect(mockCreate).not.toHaveBeenCalled();

    // Profile entities should still be set with empty data
    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.entities?.items).toHaveLength(0);
    expect(profile?.entities?.relationships).toHaveLength(0);
    expect(profile?.entities?.confidence).toBe(0);
  });

  it("caps evidence at 10 items", async () => {
    const responseWithManyEvidences = JSON.stringify({
      items: [
        { name: "User", type: "actor", properties: ["email"] },
      ],
      relationships: [],
      confidence: 0.8,
      evidence: Array.from({ length: 15 }, (_, i) => ({
        url: `https://test.io/${i + 1}`,
        excerpt: `Evidence ${i + 1}`,
      })),
    });
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: responseWithManyEvidences }],
    });

    const t = convexTest(schema);
    const { productId } = await setupWithPages(t);

    await t.action(internal.extractEntities.extractEntities, { productId });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.entities?.evidence.length).toBeLessThanOrEqual(10);
  });

  it("excludes irrelevant page types from LLM input", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: VALID_ENTITY_RESPONSE }],
    });

    const t = convexTest(schema);
    const { productId, jobId } = await setupWithPages(t);

    // Add an irrelevant page type
    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://test.io/blog/some-post",
      pageType: "blog",
      content: "# Blog post content that should be excluded",
    });

    await t.action(internal.extractEntities.extractEntities, { productId });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content;
    expect(userMessage).not.toContain("Blog post content that should be excluded");
  });

  it("works with only a single page type", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: VALID_ENTITY_RESPONSE }],
    });

    const t = convexTest(schema);
    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });
    const asUser = authenticatedUser(t);
    const productId = await asUser.mutation(api.products.create, {
      name: "Minimal Product",
      url: "https://minimal.io",
    });
    await asUser.mutation(api.productProfiles.create, { productId });
    const jobId = await asUser.mutation(api.scanJobs.create, {
      productId,
      url: "https://minimal.io",
    });
    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://minimal.io",
      pageType: "homepage",
      content: "# Minimal Product\nA simple tool.",
    });

    await t.action(internal.extractEntities.extractEntities, { productId });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.entities?.items).toHaveLength(3);
  });

  it("throws when profile does not exist", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });
    const asUser = authenticatedUser(t);
    const productId = await asUser.mutation(api.products.create, {
      name: "No Profile Product",
      url: "https://noprofile.io",
    });

    await expect(
      t.action(internal.extractEntities.extractEntities, { productId })
    ).rejects.toThrow("Profile not found");
  });
});
