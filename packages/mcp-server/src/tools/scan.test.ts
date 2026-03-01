import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerScanTool,
  handleScanProduct,
  scanProductMeta,
  validateUrl,
  type ScanToolDeps,
} from "./scan.js";
import { formatProfileSummary, type FormattableProfile } from "./formatProfile.js";
import type { Crawler, CrawlResult, CrawledPage } from "@basesignal/crawlers";
import type { StorageAdapter } from "@basesignal/storage";

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function mockCrawlResult(pages: CrawledPage[] = []): CrawlResult {
  return {
    pages,
    timing: { startedAt: 0, completedAt: 100, totalMs: 100 },
    errors: [],
  };
}

function mockProfile(): Record<string, unknown> {
  return {
    identity: {
      productName: "Acme",
      description: "Project management tool",
      targetCustomer: "Engineering teams",
      businessModel: "B2B SaaS",
      confidence: 0.85,
      evidence: [],
    },
    revenue: {
      model: "subscription",
      hasFreeTier: true,
      tiers: [{ name: "Free", price: "$0", features: ["Basic"] }],
      confidence: 0.8,
      evidence: [],
    },
    completeness: 0.7,
    overallConfidence: 0.82,
  };
}

function createMockCrawler(
  overrides?: Partial<Crawler>,
): Crawler {
  return {
    name: "mock-crawler",
    sourceType: "website",
    canCrawl: () => true,
    crawl: vi.fn(async () =>
      mockCrawlResult([
        {
          url: "https://example.com",
          pageType: "homepage",
          title: "Acme",
          content: "Welcome to Acme.",
        },
      ])
    ),
    ...overrides,
  };
}

function createMockStorage(
  overrides?: Partial<StorageAdapter>,
): StorageAdapter {
  return {
    save: vi.fn(async () => "profile-123"),
    load: vi.fn(async () => null),
    list: vi.fn(async () => []),
    delete: vi.fn(async () => false),
    search: vi.fn(async () => []),
    close: vi.fn(),
    ...overrides,
  };
}

function createMockDeps(overrides?: Partial<ScanToolDeps>): ScanToolDeps {
  return {
    crawler: createMockCrawler(),
    storage: createMockStorage(),
    analyzePipeline: vi.fn(async () => mockProfile()),
    ...overrides,
  };
}

function createTestServer(): McpServer {
  return new McpServer({ name: "test", version: "0.0.0" });
}

// ---------------------------------------------------------------------------
// validateUrl tests
// ---------------------------------------------------------------------------

describe("validateUrl", () => {
  it("accepts valid HTTPS URLs", () => {
    expect(validateUrl("https://linear.app")).toEqual({ valid: true });
    expect(validateUrl("https://example.com/pricing")).toEqual({ valid: true });
    expect(validateUrl("http://example.com")).toEqual({ valid: true });
  });

  it("rejects invalid URL format", () => {
    const result = validateUrl("not-a-url");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid URL");
  });

  it("rejects non-HTTP protocols", () => {
    const result = validateUrl("ftp://example.com");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("HTTP");
  });

  it("rejects localhost", () => {
    const result = validateUrl("http://localhost:3000");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("blocked");
  });

  it("rejects private IPs", () => {
    expect(validateUrl("http://192.168.1.1").valid).toBe(false);
    expect(validateUrl("http://10.0.0.1").valid).toBe(false);
    expect(validateUrl("http://127.0.0.1").valid).toBe(false);
  });

  it("rejects cloud metadata endpoint", () => {
    const result = validateUrl("http://169.254.169.254/latest/meta-data");
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatProfileSummary tests
// ---------------------------------------------------------------------------

describe("formatProfileSummary", () => {
  it("renders product name as heading", () => {
    const profile: FormattableProfile = {
      url: "https://acme.io",
      identity: {
        productName: "Acme",
        description: "A tool",
        targetCustomer: "Teams",
        businessModel: "SaaS",
        confidence: 0.9,
      },
      completeness: 0.5,
      overallConfidence: 0.8,
    };
    const result = formatProfileSummary(profile, "p-1");
    expect(result).toContain("# Acme Profile");
    expect(result).toContain("**Profile ID:** p-1");
    expect(result).toContain("**URL:** https://acme.io");
  });

  it("falls back to 'Product' when no identity", () => {
    const profile: FormattableProfile = {
      url: "https://example.com",
      completeness: 0,
      overallConfidence: 0,
    };
    const result = formatProfileSummary(profile, "p-2");
    expect(result).toContain("# Product Profile");
  });

  it("includes revenue section when present", () => {
    const profile: FormattableProfile = {
      url: "https://example.com",
      revenue: {
        model: "subscription",
        hasFreeTier: true,
        tiers: [
          { name: "Free", price: "$0", features: [] },
          { name: "Pro", price: "$20/mo", features: [] },
        ],
        confidence: 0.75,
      },
      completeness: 0.3,
      overallConfidence: 0.75,
    };
    const result = formatProfileSummary(profile, "p-3");
    expect(result).toContain("## Revenue");
    expect(result).toContain("**Model:** subscription");
    expect(result).toContain("**Free Tier:** Yes");
    expect(result).toContain("Free, Pro");
    expect(result).toContain("75%");
  });

  it("includes journey stages sorted by order", () => {
    const profile: FormattableProfile = {
      url: "https://example.com",
      journey: {
        stages: [
          { name: "Activation", description: "First value", order: 2 },
          { name: "Signup", description: "Create account", order: 1 },
        ],
        confidence: 0.6,
      },
      completeness: 0.2,
      overallConfidence: 0.6,
    };
    const result = formatProfileSummary(profile, "p-4");
    expect(result).toContain("## Journey Stages");
    const signupIdx = result.indexOf("Signup");
    const activationIdx = result.indexOf("Activation");
    expect(signupIdx).toBeLessThan(activationIdx);
  });

  it("renders completeness and confidence as percentages", () => {
    const profile: FormattableProfile = {
      url: "https://example.com",
      completeness: 0.856,
      overallConfidence: 0.923,
    };
    const result = formatProfileSummary(profile, "p-5");
    expect(result).toContain("**Score:** 86%");
    expect(result).toContain("**Overall Confidence:** 92%");
  });

  it("renders measurement spec with all three perspectives", () => {
    const profile: FormattableProfile = {
      url: "https://example.com",
      measurement_spec: {
        perspectives: {
          product: {
            entities: [
              {
                id: "project",
                name: "Project",
                description: "A project container",
                isHeartbeat: true,
                properties: [
                  { name: "project_id", type: "id", description: "Unique ID", isRequired: true },
                  { name: "name", type: "string", description: "Project name", isRequired: true },
                ],
                activities: [{ name: "project_created" }, { name: "project_archived" }],
              },
            ],
          },
          customer: {
            entities: [
              {
                name: "User",
                properties: [
                  { name: "user_id", type: "id", description: "User ID", isRequired: true },
                ],
                activities: [
                  { name: "signed_up", derivation_rule: "account_created" },
                  { name: "activated", derivation_rule: "first_project_created" },
                ],
              },
            ],
          },
          interaction: {
            entities: [
              {
                name: "PageView",
                properties: [
                  { name: "page_url", type: "string", description: "URL visited", isRequired: true },
                ],
                activities: [{ name: "page_viewed" }],
              },
            ],
          },
        },
        confidence: 0.85,
      },
      completeness: 0.7,
      overallConfidence: 0.8,
    };
    const result = formatProfileSummary(profile, "p-6");

    // Section headings
    expect(result).toContain("## Measurement Spec");
    expect(result).toContain("### Product Entities");
    expect(result).toContain("### Customer Entities");
    expect(result).toContain("### Interaction Entities");

    // Product entity details
    expect(result).toContain("**Project** [heartbeat]: A project container");
    expect(result).toContain("Properties: project_id, name");
    expect(result).toContain("Activities: project_created, project_archived");

    // Customer entity details
    expect(result).toContain("**User**");
    expect(result).toContain("signed_up (account_created)");
    expect(result).toContain("activated (first_project_created)");

    // Interaction entity details
    expect(result).toContain("**PageView**");
    expect(result).toContain("Activities: page_viewed");

    // Confidence
    expect(result).toContain("85%");
  });

  it("skips empty perspective sub-sections", () => {
    const profile: FormattableProfile = {
      url: "https://example.com",
      measurement_spec: {
        perspectives: {
          product: {
            entities: [
              {
                id: "task",
                name: "Task",
                description: "A work item",
                isHeartbeat: false,
                properties: [],
                activities: [],
              },
            ],
          },
          customer: { entities: [] },
          interaction: { entities: [] },
        },
        confidence: 0.7,
      },
      completeness: 0.5,
      overallConfidence: 0.6,
    };
    const result = formatProfileSummary(profile, "p-7");

    expect(result).toContain("## Measurement Spec");
    expect(result).toContain("### Product Entities");
    expect(result).not.toContain("### Customer Entities");
    expect(result).not.toContain("### Interaction Entities");
    // Non-heartbeat entity should not have [heartbeat] marker
    expect(result).toContain("**Task**:");
    expect(result).not.toContain("[heartbeat]");
  });

  it("omits measurement spec section when not present", () => {
    const profile: FormattableProfile = {
      url: "https://example.com",
      completeness: 0.5,
      overallConfidence: 0.6,
    };
    const result = formatProfileSummary(profile, "p-8");
    expect(result).not.toContain("## Measurement Spec");
  });

  it("omits measurement spec section when all perspectives are empty", () => {
    const profile: FormattableProfile = {
      url: "https://example.com",
      measurement_spec: {
        perspectives: {
          product: { entities: [] },
          customer: { entities: [] },
          interaction: { entities: [] },
        },
        confidence: 0.5,
      },
      completeness: 0.5,
      overallConfidence: 0.6,
    };
    const result = formatProfileSummary(profile, "p-9");
    expect(result).not.toContain("## Measurement Spec");
  });
});

// ---------------------------------------------------------------------------
// scan_product tool registration tests
// ---------------------------------------------------------------------------

describe("registerScanTool", () => {
  it("registers scan_product tool with correct metadata", () => {
    const server = createTestServer();
    const deps = createMockDeps();
    registerScanTool(server, deps);

    const tools = (server as any)._registeredTools;
    expect(tools["scan_product"]).toBeDefined();
    expect(tools["scan_product"].description).toBe(scanProductMeta.description);
  });

  it("accepts url as required input parameter", () => {
    const server = createTestServer();
    registerScanTool(server, createMockDeps());

    const tools = (server as any)._registeredTools;
    const tool = tools["scan_product"];
    expect(tool).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// scan_product handler tests (pipeline orchestration)
// ---------------------------------------------------------------------------

describe("scan_product handler", () => {
  it("returns error for invalid URL", async () => {
    const server = createTestServer();
    const deps = createMockDeps();
    const handler = handleScanProduct(server, deps);
    const result = await handler({ url: "not-a-url" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid URL");
  });

  it("returns error for localhost URL", async () => {
    const server = createTestServer();
    const deps = createMockDeps();
    const handler = handleScanProduct(server, deps);
    const result = await handler({ url: "http://localhost:3000" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("blocked");
  });

  it("orchestrates crawl -> analyze -> save -> summarize", async () => {
    const server = createTestServer();
    const deps = createMockDeps();
    const handler = handleScanProduct(server, deps);
    const result = await handler({ url: "https://example.com" });

    expect(result.isError).toBeUndefined();
    expect(deps.crawler.crawl).toHaveBeenCalledWith("https://example.com");
    expect(deps.analyzePipeline).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ url: "https://example.com", pageType: "homepage" }),
      ]),
    );
    expect(deps.storage.save).toHaveBeenCalled();
    expect(result.content[0].text).toContain("# Acme Profile");
    expect(result.content[0].text).toContain("profile-123");
  });

  it("returns error when crawler returns zero pages", async () => {
    const server = createTestServer();
    const deps = createMockDeps({
      crawler: createMockCrawler({
        crawl: vi.fn(async () => mockCrawlResult([])),
      }),
    });
    const handler = handleScanProduct(server, deps);
    const result = await handler({ url: "https://example.com" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No pages could be crawled");
  });

  it("returns error when crawler throws", async () => {
    const server = createTestServer();
    const deps = createMockDeps({
      crawler: createMockCrawler({
        crawl: vi.fn(async () => {
          throw new Error("DNS resolution failed");
        }),
      }),
    });
    const handler = handleScanProduct(server, deps);
    const result = await handler({ url: "https://bad-domain.example" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Crawl failed");
    expect(result.content[0].text).toContain("DNS resolution failed");
  });

  it("returns error when analysis pipeline throws", async () => {
    const server = createTestServer();
    const deps = createMockDeps({
      analyzePipeline: vi.fn(async () => {
        throw new Error("LLM API key invalid");
      }),
    });
    const handler = handleScanProduct(server, deps);
    const result = await handler({ url: "https://example.com" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Analysis failed");
  });

  it("returns summary with warning when storage fails", async () => {
    const server = createTestServer();
    const deps = createMockDeps({
      storage: createMockStorage({
        save: vi.fn(async () => {
          throw new Error("Disk full");
        }),
      }),
    });
    const handler = handleScanProduct(server, deps);
    const result = await handler({ url: "https://example.com" });

    // Should NOT be an error -- profile was generated
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("# Acme Profile");
    expect(result.content[0].text).toContain("(unsaved)");
    expect(result.content[0].text).toContain("Disk full");
  });

  it("includes crawl errors in message when zero pages", async () => {
    const server = createTestServer();
    const deps = createMockDeps({
      crawler: createMockCrawler({
        crawl: vi.fn(async () => ({
          pages: [],
          timing: { startedAt: 0, completedAt: 0, totalMs: 0 },
          errors: [{ url: "https://example.com", error: "403 Forbidden" }],
        })),
      }),
    });
    const handler = handleScanProduct(server, deps);
    const result = await handler({ url: "https://example.com" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("403 Forbidden");
  });

  it("returns human-readable markdown, not raw JSON", async () => {
    const server = createTestServer();
    const deps = createMockDeps();
    const handler = handleScanProduct(server, deps);
    const result = await handler({ url: "https://example.com" });

    const text = result.content[0].text;
    // Should contain markdown headings, not JSON brackets
    expect(text).toContain("#");
    expect(text).toContain("**");
    expect(text).not.toMatch(/^\s*\{/); // Not starting with JSON
  });
});
