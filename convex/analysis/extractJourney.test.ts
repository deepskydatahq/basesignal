import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import {
  prepareCrawledContent,
  buildJourneyPrompt,
  buildDefinitionsPrompt,
  parseLlmJson,
  validateJourneyResult,
  validateDefinitionsResult,
} from "./extractJourney";

// --- Test data ---

const samplePages = [
  {
    url: "https://acme.io",
    pageType: "homepage",
    title: "Acme - Project Management",
    content: "Acme helps engineering teams ship faster. Start your free trial today. Features include kanban boards, sprint planning, and team analytics.",
  },
  {
    url: "https://acme.io/features",
    pageType: "features",
    title: "Features",
    content: "Kanban boards for visual project tracking. Sprint planning with velocity tracking. Team analytics dashboard. Integrations with GitHub, Slack.",
  },
  {
    url: "https://acme.io/about",
    pageType: "about",
    title: "About Acme",
    content: "Founded in 2023, Acme serves over 5000 engineering teams worldwide.",
  },
  {
    url: "https://acme.io/pricing",
    pageType: "pricing",
    title: "Pricing",
    content: "Free plan: 3 users, 1 project. Pro plan: $12/user/month. Enterprise: custom pricing.",
  },
];

const sampleJourneyResult = {
  stages: [
    { name: "Visitor", description: "Discovers Acme through marketing", order: 1 },
    { name: "Trial User", description: "Signs up for free trial", order: 2 },
    { name: "Activated User", description: "Creates first project and board", order: 3 },
    { name: "Active User", description: "Regularly uses sprint planning", order: 4 },
    { name: "Paying Customer", description: "Converts to Pro plan", order: 5 },
  ],
  confidence: 0.45,
  evidence: [
    { url: "https://acme.io", excerpt: "Start your free trial today" },
    { url: "https://acme.io/pricing", excerpt: "Free plan: 3 users, 1 project" },
  ],
};

const sampleDefinitionsResult = {
  activation: {
    criteria: ["Created at least one project", "Added at least one team member"],
    timeWindow: "within 7 days of signup",
    reasoning: "Creating a project and inviting a teammate shows intent to use the tool",
    confidence: 0.35,
    source: "ai-inferred" as const,
    evidence: [{ url: "https://acme.io/features", excerpt: "Kanban boards for visual project tracking" }],
  },
  firstValue: {
    description: "User completes their first sprint cycle with the team",
    criteria: ["Completed one sprint", "Viewed velocity report"],
    reasoning: "Sprint completion represents the core value proposition being realized",
    confidence: 0.35,
    source: "ai-inferred" as const,
    evidence: [{ url: "https://acme.io/features", excerpt: "Sprint planning with velocity tracking" }],
  },
  active: {
    criteria: ["Logged in at least 3 times per week", "Interacted with board or sprint"],
    timeWindow: "per rolling 7-day window",
    reasoning: "Regular engagement with core features indicates active usage",
    confidence: 0.3,
    source: "ai-inferred" as const,
    evidence: [{ url: "https://acme.io/features", excerpt: "Team analytics dashboard" }],
  },
  atRisk: {
    criteria: ["No login for 7+ days", "No board interaction for 14+ days"],
    timeWindow: "rolling 14-day window",
    reasoning: "Extended absence from a daily-use tool signals disengagement",
    confidence: 0.3,
    source: "ai-inferred" as const,
    evidence: [{ url: "https://acme.io", excerpt: "Acme helps engineering teams ship faster" }],
  },
  churn: {
    criteria: ["No login for 30+ days", "Subscription cancelled or expired"],
    timeWindow: "30 days of inactivity",
    reasoning: "A month without usage for a project management tool indicates abandonment",
    confidence: 0.3,
    source: "ai-inferred" as const,
    evidence: [{ url: "https://acme.io/pricing", excerpt: "Pro plan: $12/user/month" }],
  },
};

// --- Pure function tests ---

describe("prepareCrawledContent", () => {
  it("selects homepage, features, about, and pricing pages", () => {
    const extraPages = [
      ...samplePages,
      { url: "https://acme.io/blog/post-1", pageType: "blog", title: "Blog Post", content: "Some blog content" },
      { url: "https://acme.io/careers", pageType: "careers", title: "Careers", content: "Join us" },
    ];

    const result = prepareCrawledContent(extraPages);

    expect(result).toContain("homepage");
    expect(result).toContain("features");
    expect(result).toContain("about");
    expect(result).toContain("pricing");
    expect(result).not.toContain("blog");
    expect(result).not.toContain("careers");
  });

  it("falls back to first 4 pages when no priority types match", () => {
    const nonPriorityPages = [
      { url: "https://acme.io/blog/1", pageType: "blog", title: "Blog 1", content: "Content 1" },
      { url: "https://acme.io/blog/2", pageType: "blog", title: "Blog 2", content: "Content 2" },
    ];

    const result = prepareCrawledContent(nonPriorityPages);
    expect(result).toContain("Blog 1");
    expect(result).toContain("Blog 2");
  });

  it("truncates individual pages that exceed max length", () => {
    const longPage = {
      url: "https://acme.io",
      pageType: "homepage",
      title: "Acme",
      content: "x".repeat(10000),
    };

    const result = prepareCrawledContent([longPage]);
    expect(result).toContain("[... truncated]");
    // Should be less than original 10000 chars + metadata
    expect(result.length).toBeLessThan(10000);
  });
});

describe("buildJourneyPrompt", () => {
  it("includes crawled content in the prompt", () => {
    const prompt = buildJourneyPrompt("Some website content");
    expect(prompt).toContain("Some website content");
    expect(prompt).toContain("user journey stages");
  });

  it("includes identity context when provided", () => {
    const prompt = buildJourneyPrompt("Content", "Product: Acme\nBusiness model: B2B SaaS");
    expect(prompt).toContain("Product: Acme");
    expect(prompt).toContain("B2B SaaS");
  });

  it("omits identity context section when not provided", () => {
    const prompt = buildJourneyPrompt("Content");
    expect(prompt).not.toContain("Product context:");
  });
});

describe("buildDefinitionsPrompt", () => {
  const stages = [
    { name: "Visitor", description: "First visit", order: 1 },
    { name: "User", description: "Signed up", order: 2 },
  ];

  it("includes journey stages in the prompt", () => {
    const prompt = buildDefinitionsPrompt("Content", stages);
    expect(prompt).toContain("1. Visitor: First visit");
    expect(prompt).toContain("2. User: Signed up");
  });

  it("includes all definition types in instructions", () => {
    const prompt = buildDefinitionsPrompt("Content", stages);
    expect(prompt).toContain("activation");
    expect(prompt).toContain("firstValue");
    expect(prompt).toContain("active");
    expect(prompt).toContain("atRisk");
    expect(prompt).toContain("churn");
    expect(prompt).toContain("ai-inferred");
  });
});

describe("parseLlmJson", () => {
  it("parses plain JSON", () => {
    const result = parseLlmJson<{ a: number }>('{"a": 1}');
    expect(result).toEqual({ a: 1 });
  });

  it("strips markdown code fences", () => {
    const result = parseLlmJson<{ a: number }>("```json\n{\"a\": 1}\n```");
    expect(result).toEqual({ a: 1 });
  });

  it("strips code fences without language", () => {
    const result = parseLlmJson<{ a: number }>("```\n{\"a\": 1}\n```");
    expect(result).toEqual({ a: 1 });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseLlmJson("not json")).toThrow();
  });
});

describe("validateJourneyResult", () => {
  it("accepts valid journey data", () => {
    const result = validateJourneyResult(sampleJourneyResult);
    expect(result.stages).toHaveLength(5);
    expect(result.confidence).toBe(0.45);
  });

  it("rejects missing stages", () => {
    expect(() => validateJourneyResult({ stages: [], confidence: 0.5, evidence: [] })).toThrow(
      "non-empty",
    );
  });

  it("rejects stage without name", () => {
    expect(() =>
      validateJourneyResult({
        stages: [{ name: "", description: "desc", order: 1 }],
        confidence: 0.5,
        evidence: [],
      }),
    ).toThrow("Invalid stage");
  });

  it("rejects missing confidence", () => {
    expect(() =>
      validateJourneyResult({
        stages: [{ name: "A", description: "B", order: 1 }],
        evidence: [],
      }),
    ).toThrow("confidence");
  });

  it("rejects missing evidence array", () => {
    expect(() =>
      validateJourneyResult({
        stages: [{ name: "A", description: "B", order: 1 }],
        confidence: 0.5,
      }),
    ).toThrow("evidence");
  });
});

describe("validateDefinitionsResult", () => {
  it("accepts valid definitions data", () => {
    const result = validateDefinitionsResult(sampleDefinitionsResult);
    expect(result.activation.source).toBe("ai-inferred");
    expect(result.firstValue.description).toBeDefined();
    expect(result.active.criteria.length).toBeGreaterThan(0);
    expect(result.atRisk.criteria.length).toBeGreaterThan(0);
    expect(result.churn.criteria.length).toBeGreaterThan(0);
  });

  it("rejects when activation is missing", () => {
    const data = { ...sampleDefinitionsResult, activation: undefined };
    expect(() => validateDefinitionsResult(data)).toThrow("activation");
  });

  it("rejects when source is not ai-inferred", () => {
    const data = {
      ...sampleDefinitionsResult,
      activation: { ...sampleDefinitionsResult.activation, source: "manual" },
    };
    expect(() => validateDefinitionsResult(data)).toThrow("ai-inferred");
  });

  it("rejects when firstValue is missing description", () => {
    const data = {
      ...sampleDefinitionsResult,
      firstValue: { ...sampleDefinitionsResult.firstValue, description: "" },
    };
    expect(() => validateDefinitionsResult(data)).toThrow("description");
  });

  it("rejects when criteria is empty", () => {
    const data = {
      ...sampleDefinitionsResult,
      active: { ...sampleDefinitionsResult.active, criteria: [] },
    };
    expect(() => validateDefinitionsResult(data)).toThrow("non-empty");
  });

  it("enforces all five definition keys", () => {
    for (const key of ["activation", "firstValue", "active", "atRisk", "churn"] as const) {
      const data = { ...sampleDefinitionsResult, [key]: undefined };
      expect(() => validateDefinitionsResult(data)).toThrow(key);
    }
  });

  it("validates confidence scores are within draft range", () => {
    const result = validateDefinitionsResult(sampleDefinitionsResult);
    for (const key of ["activation", "firstValue", "active", "atRisk", "churn"] as const) {
      expect(result[key].confidence).toBeGreaterThanOrEqual(0.3);
      expect(result[key].confidence).toBeLessThanOrEqual(0.5);
    }
  });
});

// --- Integration tests with Convex ---

async function setupProductWithPages(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-clerk-id",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-clerk-id",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-clerk-id",
  });

  const { api } = await import("../_generated/api");
  const productId = await asUser.mutation(api.products.create, {
    name: "Test Product",
    url: "https://test.io",
  });

  // Create profile
  await asUser.mutation(api.productProfiles.create, { productId });

  // Create a scan job
  const scanJobId = await t.run(async (ctx) => {
    return await ctx.db.insert("scanJobs", {
      productId,
      userId,
      url: "https://test.io",
      status: "completed",
      pagesTotal: 4,
      pagesCrawled: 4,
      currentPhase: "Completed",
      startedAt: Date.now(),
      completedAt: Date.now(),
    });
  });

  // Insert crawled pages
  for (const page of samplePages) {
    await t.run(async (ctx) => {
      await ctx.db.insert("crawledPages", {
        productId,
        scanJobId,
        url: page.url,
        pageType: page.pageType,
        title: page.title,
        content: page.content,
        contentLength: page.content.length,
        crawledAt: Date.now(),
      });
    });
  }

  return { userId, productId, asUser, scanJobId };
}

describe("internal helpers", () => {
  it("listByProductInternal returns pages without auth", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductWithPages(t);

    const pages = await t.query(internal.crawledPages.listByProductInternal, {
      productId,
    });

    expect(pages).toHaveLength(4);
    expect(pages.some((p) => p.pageType === "homepage")).toBe(true);
    expect(pages.some((p) => p.pageType === "features")).toBe(true);
  });

  it("getInternal returns profile without auth", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductWithPages(t);

    const profile = await t.query(internal.productProfiles.getInternal, {
      productId,
    });

    expect(profile).toBeDefined();
    expect(profile?.productId).toEqual(productId);
  });

  it("updateSectionInternal updates journey without auth", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductWithPages(t);

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "journey",
      data: sampleJourneyResult,
    });

    const profile = await t.query(internal.productProfiles.getInternal, {
      productId,
    });

    expect(profile?.journey?.stages).toHaveLength(5);
    expect(profile?.journey?.confidence).toBe(0.45);
    expect(profile?.completeness).toBeGreaterThan(0);
  });

  it("updateSectionInternal updates definitions without auth", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductWithPages(t);

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "definitions",
      data: sampleDefinitionsResult,
    });

    const profile = await t.query(internal.productProfiles.getInternal, {
      productId,
    });

    expect(profile?.definitions?.activation).toBeDefined();
    expect(profile?.definitions?.activation?.source).toBe("ai-inferred");
    expect(profile?.definitions?.firstValue?.description).toBeDefined();
    expect(profile?.definitions?.active).toBeDefined();
    expect(profile?.definitions?.atRisk).toBeDefined();
    expect(profile?.definitions?.churn).toBeDefined();
    // 4 definition sub-keys (activation, firstValue, active, churn) counted by completeness
    expect(profile?.completeness).toBeGreaterThan(0);
  });
});
