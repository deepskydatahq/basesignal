import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  buildOutcomesPrompt,
  parseOutcomesResponse,
  type CrawledPageInput,
} from "./lib/extractOutcomesHelpers";

function authenticatedUser(
  t: ReturnType<typeof convexTest>,
  clerkId = "test-clerk-id",
) {
  return t.withIdentity({
    subject: clerkId,
    issuer: "https://clerk.test",
    tokenIdentifier: `https://clerk.test|${clerkId}`,
  });
}

async function setupUserProductAndProfile(
  t: ReturnType<typeof convexTest>,
  clerkId = "test-clerk-id",
) {
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
  await asUser.mutation(api.productProfiles.create, { productId });
  return { userId, productId, asUser };
}

async function setupWithCrawledPages(t: ReturnType<typeof convexTest>) {
  const { userId, productId, asUser } = await setupUserProductAndProfile(t);
  const jobId = await asUser.mutation(api.scanJobs.create, {
    productId,
    url: "https://test.io",
  });

  // Store homepage with hero messaging
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io",
    pageType: "homepage",
    title: "TestApp - Collaborate visually",
    content:
      "# Collaborate visually in real-time\nThe visual workspace for modern teams. Build, brainstorm, and ship together.\n\n## Why teams love TestApp\n- Real-time collaboration\n- Visual project management\n- Integrated design tools",
  });

  // Store features page
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io/features",
    pageType: "features",
    title: "Features",
    content:
      '## Features\n### Whiteboard\nInfinite canvas for brainstorming.\n### Templates\nGet started fast with 100+ templates.\n### Integrations\nConnect with Slack, Jira, and more.\n\n> "TestApp cut our meeting time in half" - Sarah, PM at Acme',
  });

  // Store customers page
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io/customers",
    pageType: "customers",
    title: "Customers",
    content:
      '## What our customers say\n> "We shipped 2x faster after adopting TestApp" - Mike, CTO\n> "Finally, a tool that bridges design and engineering" - Lisa, VP Design',
  });

  return { userId, productId, jobId, asUser };
}

describe("extractOutcomes helpers", () => {
  describe("buildOutcomesPrompt", () => {
    it("includes page content labeled by type", () => {
      const pages: CrawledPageInput[] = [
        {
          url: "https://test.io",
          pageType: "homepage",
          content: "# Hero: Collaborate visually",
        },
        {
          url: "https://test.io/features",
          pageType: "features",
          content: "## Whiteboard\nInfinite canvas",
        },
      ];

      const prompt = buildOutcomesPrompt(pages);
      expect(prompt).toContain("[homepage]");
      expect(prompt).toContain("https://test.io");
      expect(prompt).toContain("Collaborate visually");
      expect(prompt).toContain("[features]");
      expect(prompt).toContain("Whiteboard");
    });

    it("truncates pages exceeding 25KB", () => {
      const pages: CrawledPageInput[] = [
        {
          url: "https://test.io",
          pageType: "homepage",
          content: "x".repeat(30_000),
        },
      ];

      const prompt = buildOutcomesPrompt(pages);
      // Should contain truncated content, not all 30K chars
      expect(prompt.length).toBeLessThan(30_000);
    });
  });

  describe("parseOutcomesResponse", () => {
    it("parses valid JSON with outcomes array", () => {
      const raw = JSON.stringify({
        items: [
          {
            description: "Collaborate visually in real-time",
            type: "primary",
            linkedFeatures: ["Whiteboard", "Real-time editing"],
          },
          {
            description: "Ship products faster",
            type: "secondary",
            linkedFeatures: ["Templates", "Integrations"],
          },
        ],
        confidence: 0.85,
        evidence: [
          {
            url: "https://test.io",
            excerpt: "The visual workspace for modern teams",
          },
        ],
      });

      const result = parseOutcomesResponse(raw);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].type).toBe("primary");
      expect(result.items[0].linkedFeatures).toContain("Whiteboard");
      expect(result.confidence).toBe(0.85);
      expect(result.evidence).toHaveLength(1);
    });

    it("extracts JSON from markdown code blocks", () => {
      const raw =
        '```json\n{"items":[{"description":"Test","type":"primary","linkedFeatures":[]}],"confidence":0.7,"evidence":[]}\n```';
      const result = parseOutcomesResponse(raw);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].description).toBe("Test");
    });

    it("throws on invalid JSON", () => {
      expect(() => parseOutcomesResponse("not json")).toThrow();
    });

    it("ensures items have required fields", () => {
      const raw = JSON.stringify({
        items: [{ description: "Test" }],
        confidence: 0.5,
        evidence: [],
      });
      const result = parseOutcomesResponse(raw);
      // Should default missing fields
      expect(result.items[0].type).toBe("secondary");
      expect(result.items[0].linkedFeatures).toEqual([]);
    });

    it("classifies primary outcome from hero positioning", () => {
      const raw = JSON.stringify({
        items: [
          {
            description: "Collaborate visually in real-time",
            type: "primary",
            linkedFeatures: ["Whiteboard"],
          },
          {
            description: "Reduce meeting time",
            type: "secondary",
            linkedFeatures: [],
          },
          {
            description: "Cross-team alignment",
            type: "tertiary",
            linkedFeatures: [],
          },
        ],
        confidence: 0.8,
        evidence: [],
      });
      const result = parseOutcomesResponse(raw);
      const primary = result.items.filter((i) => i.type === "primary");
      const secondary = result.items.filter((i) => i.type === "secondary");
      const tertiary = result.items.filter((i) => i.type === "tertiary");
      expect(primary.length).toBeGreaterThanOrEqual(1);
      expect(secondary.length).toBeGreaterThanOrEqual(1);
      expect(tertiary.length).toBeGreaterThanOrEqual(1);
    });

    it("clamps confidence between 0 and 1", () => {
      const raw = JSON.stringify({
        items: [],
        confidence: 1.5,
        evidence: [],
      });
      const result = parseOutcomesResponse(raw);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});

describe("extractOutcomes internal helpers", () => {
  it("listByProductInternal returns crawled pages without auth", async () => {
    const t = convexTest(schema);
    const { productId } = await setupWithCrawledPages(t);

    const pages = await t.query(internal.crawledPages.listByProductInternal, {
      productId,
    });
    expect(pages).toHaveLength(3);
    expect(pages.map((p) => p.pageType).sort()).toEqual([
      "customers",
      "features",
      "homepage",
    ]);
  });

  it("createInternal creates profile if not exists", async () => {
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
      name: "Test Product",
      url: "https://test.io",
    });

    const profileId = await t.mutation(
      internal.productProfiles.createInternal,
      { productId },
    );
    expect(profileId).toBeDefined();

    // Idempotent
    const profileId2 = await t.mutation(
      internal.productProfiles.createInternal,
      { productId },
    );
    expect(profileId2).toEqual(profileId);
  });

  it("updateSectionInternal stores outcomes and recalculates completeness", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserProductAndProfile(t);

    const outcomesData = {
      items: [
        {
          description: "Collaborate visually in real-time",
          type: "primary",
          linkedFeatures: ["Whiteboard", "Real-time editing"],
        },
        {
          description: "Ship products faster",
          type: "secondary",
          linkedFeatures: ["Templates"],
        },
      ],
      confidence: 0.8,
      evidence: [
        {
          url: "https://test.io",
          excerpt: "The visual workspace for modern teams",
        },
      ],
    };

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "outcomes",
      data: outcomesData,
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile?.outcomes?.items).toHaveLength(2);
    expect(profile?.outcomes?.items[0].type).toBe("primary");
    expect(profile?.outcomes?.items[0].linkedFeatures).toContain("Whiteboard");
    expect(profile?.outcomes?.confidence).toBe(0.8);
    expect(profile?.outcomes?.evidence).toHaveLength(1);
    // 1 out of 10 sections = 0.1
    expect(profile?.completeness).toBeCloseTo(0.1, 1);
  });

  it("evidence includes URLs and excerpts", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserProductAndProfile(t);

    const outcomesData = {
      items: [
        {
          description: "Test outcome",
          type: "primary",
          linkedFeatures: [],
        },
      ],
      confidence: 0.7,
      evidence: [
        {
          url: "https://test.io",
          excerpt: "Hero section excerpt",
        },
        {
          url: "https://test.io/features",
          excerpt: "Value prop excerpt",
        },
        {
          url: "https://test.io/customers",
          excerpt: "Testimonial excerpt",
        },
      ],
    };

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "outcomes",
      data: outcomesData,
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile?.outcomes?.evidence).toHaveLength(3);
    expect(profile?.outcomes?.evidence[0].url).toBe("https://test.io");
    expect(profile?.outcomes?.evidence[0].excerpt).toBe(
      "Hero section excerpt",
    );
  });
});
