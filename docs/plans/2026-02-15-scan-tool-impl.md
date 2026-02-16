# Implementation Plan: scan_product MCP Tool Handler

**Task:** basesignal-8ir (M008-E002-S003)
**Design:** docs/plans/2026-02-15-scan-tool-design.md

## Context

The `scan_product` tool is the flagship MCP tool for the open-source, self-hostable `packages/mcp-server/` package. Today it lives in `server/tools/products.ts` as a thin proxy that delegates to Convex backend actions (Firecrawl map/scrape, page storage, analysis pipeline). The redesigned tool orchestrates the full pipeline directly using injected interfaces (Crawler, LlmProvider, StorageAdapter), runs synchronously (no polling), and returns a human-readable markdown summary.

### Dependencies

This story depends on three other stories that define the interfaces it composes:

| Dependency | Package | What It Provides |
|-----------|---------|-----------------|
| M008-E002-S002 | Analysis pipeline | `analyzePipeline(pages, llm)` returning a `ProductProfile` |
| M008-E003-S002 | `@basesignal/crawlers` | `Crawler` interface with `crawl(url, options?)` returning `CrawlResult` |
| M008-E004-S001 | `@basesignal/storage` | `StorageAdapter` with `save(profile)`, `load(id)`, `list()` |

Additionally, M008-E004-S003 provides the `LlmProvider` interface and M008-E001-S002 provides the `ProductProfile` types from `@basesignal/core`.

### Key Design Decisions (from design doc)

- **Single `url` input**, no options object
- **Synchronous execution** (no polling tool needed)
- **No auth wrapper** at tool level (server-level concern)
- **Human-readable markdown output**, not raw JSON
- **Partial failure tolerance**: if some extractors fail, continue with available sections
- **No idempotency**: always re-scan, store as new version

## Approach

Create three files in `server/tools/`: the tool registration + handler (`scan.ts`), the profile summary formatter (`formatProfile.ts`), and tests (`scan.test.ts`). Update `server/tools/index.ts` to wire dependencies. The handler composes three injected interfaces into a sequential pipeline: validate -> crawl -> analyze -> save -> summarize.

Since dependency packages (`@basesignal/crawlers`, `@basesignal/storage`, `@basesignal/core`) do not yet exist, define slim local interfaces in the scan tool module that match the expected signatures from those dependency stories. When the packages land, replace the local types with imports. This avoids blocking on dependency delivery.

## Implementation Steps

### Step 1: Create `server/tools/formatProfile.ts` -- profile summary formatter

This is a pure function with zero dependencies. Build it first so the handler can import it.

Create `server/tools/formatProfile.ts`:

```typescript
/**
 * Format a ProductProfile into a human-readable markdown summary.
 * Pure function -- no side effects, easy to test independently.
 */

/** Slim interface matching the ProductProfile shape from @basesignal/core */
interface ProfileIdentity {
  productName: string;
  description: string;
  targetCustomer: string;
  businessModel: string;
  industry?: string | null;
  companyStage?: string | null;
  confidence: number;
}

interface ProfileRevenueTier {
  name: string;
  price: string;
  features: string[];
}

interface ProfileRevenue {
  model: string;
  hasFreeTier: boolean;
  tiers: ProfileRevenueTier[];
  confidence: number;
}

interface ProfileEntity {
  name: string;
  type: string;
  properties: string[];
}

interface ProfileEntities {
  items: ProfileEntity[];
  confidence: number;
}

interface ProfileJourneyStage {
  name: string;
  description: string;
  order: number;
}

interface ProfileJourney {
  stages: ProfileJourneyStage[];
  confidence: number;
}

interface ProfileOutcome {
  description: string;
  type: string;
  linkedFeatures: string[];
}

interface ProfileOutcomes {
  items: ProfileOutcome[];
  confidence: number;
}

interface ProfileMetric {
  name: string;
  category: string;
  formula?: string | null;
}

interface ProfileMetrics {
  items: ProfileMetric[];
  confidence: number;
}

export interface FormattableProfile {
  url: string;
  identity?: ProfileIdentity | null;
  revenue?: ProfileRevenue | null;
  entities?: ProfileEntities | null;
  journey?: ProfileJourney | null;
  outcomes?: ProfileOutcomes | null;
  metrics?: ProfileMetrics | null;
  completeness: number;
  overallConfidence: number;
}

export function formatProfileSummary(
  profile: FormattableProfile,
  profileId: string,
): string {
  const lines: string[] = [];
  const name = profile.identity?.productName ?? "Product";

  lines.push(`# ${name} Profile`);
  lines.push("");
  lines.push(`**Profile ID:** ${profileId}`);
  lines.push(`**URL:** ${profile.url}`);
  lines.push("");

  // Identity
  if (profile.identity) {
    lines.push("## Identity");
    lines.push(`- **Description:** ${profile.identity.description}`);
    lines.push(`- **Target Customer:** ${profile.identity.targetCustomer}`);
    lines.push(`- **Business Model:** ${profile.identity.businessModel}`);
    if (profile.identity.industry) {
      lines.push(`- **Industry:** ${profile.identity.industry}`);
    }
    if (profile.identity.companyStage) {
      lines.push(`- **Stage:** ${profile.identity.companyStage}`);
    }
    lines.push(`- **Confidence:** ${pct(profile.identity.confidence)}`);
    lines.push("");
  }

  // Revenue
  if (profile.revenue) {
    lines.push("## Revenue");
    lines.push(`- **Model:** ${profile.revenue.model}`);
    lines.push(`- **Free Tier:** ${profile.revenue.hasFreeTier ? "Yes" : "No"}`);
    if (profile.revenue.tiers.length > 0) {
      lines.push(`- **Tiers:** ${profile.revenue.tiers.map((t) => t.name).join(", ")}`);
    }
    lines.push(`- **Confidence:** ${pct(profile.revenue.confidence)}`);
    lines.push("");
  }

  // Entity Model
  if (profile.entities && profile.entities.items.length > 0) {
    lines.push("## Entities");
    for (const entity of profile.entities.items) {
      lines.push(`- **${entity.name}** (${entity.type}): ${entity.properties.join(", ")}`);
    }
    lines.push(`- **Confidence:** ${pct(profile.entities.confidence)}`);
    lines.push("");
  }

  // Journey
  if (profile.journey && profile.journey.stages.length > 0) {
    lines.push("## Journey Stages");
    const sorted = [...profile.journey.stages].sort((a, b) => a.order - b.order);
    for (const stage of sorted) {
      lines.push(`${stage.order}. **${stage.name}** -- ${stage.description}`);
    }
    lines.push(`- **Confidence:** ${pct(profile.journey.confidence)}`);
    lines.push("");
  }

  // Outcomes
  if (profile.outcomes && profile.outcomes.items.length > 0) {
    lines.push("## Outcomes");
    for (const outcome of profile.outcomes.items) {
      lines.push(`- ${outcome.description} (${outcome.type})`);
    }
    lines.push(`- **Confidence:** ${pct(profile.outcomes.confidence)}`);
    lines.push("");
  }

  // Metrics
  if (profile.metrics && profile.metrics.items.length > 0) {
    lines.push("## Key Metrics");
    for (const metric of profile.metrics.items) {
      const formula = metric.formula ? ` = ${metric.formula}` : "";
      lines.push(`- **${metric.name}** (${metric.category})${formula}`);
    }
    lines.push(`- **Confidence:** ${pct(profile.metrics.confidence)}`);
    lines.push("");
  }

  // Completeness
  lines.push("## Completeness");
  lines.push(`- **Score:** ${pct(profile.completeness)}`);
  lines.push(`- **Overall Confidence:** ${pct(profile.overallConfidence)}`);

  return lines.join("\n");
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
```

**Test:** Covered in Step 4.

### Step 2: Create `server/tools/scan.ts` -- tool registration and handler

Create `server/tools/scan.ts`:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatProfileSummary } from "./formatProfile.js";

// ---------------------------------------------------------------------------
// Dependency interfaces (will be replaced by package imports when they land)
// ---------------------------------------------------------------------------

/** Matches Crawler from @basesignal/crawlers (M008-E003-S001) */
export interface CrawledPage {
  url: string;
  pageType: string;
  title?: string;
  content: string;
  metadata?: { description?: string; ogImage?: string };
}

export interface CrawlResult {
  pages: CrawledPage[];
  timing: { startedAt: number; completedAt: number; totalMs: number };
  errors: Array<{ url: string; error: string }>;
}

export interface Crawler {
  name: string;
  crawl(url: string, options?: { maxPages?: number }): Promise<CrawlResult>;
}

/** Matches StorageAdapter from @basesignal/storage (M008-E004-S001) */
export interface StorageAdapter {
  save(profile: Record<string, unknown>): Promise<string>;
  load(id: string): Promise<Record<string, unknown> | null>;
  list(): Promise<Array<{ id: string; name: string; url: string; updatedAt: number }>>;
}

/**
 * The analysis pipeline function signature.
 * Matches M008-E002-S002: accepts crawled pages + LLM provider, returns a profile.
 * The LlmProvider is already injected into the pipeline at construction time,
 * so the scan tool only needs to pass pages.
 */
export type AnalyzePipeline = (
  pages: CrawledPage[],
) => Promise<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Dependencies bundle
// ---------------------------------------------------------------------------

export interface ScanToolDeps {
  crawler: Crawler;
  storage: StorageAdapter;
  analyzePipeline: AnalyzePipeline;
}

// ---------------------------------------------------------------------------
// URL validation (extracted from convex/lib/urlUtils.ts)
// ---------------------------------------------------------------------------

const PRIVATE_IP_RANGES = [
  /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./, /^169\.254\./, /^::1$/, /^fc00:/, /^fe80:/,
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "169.254.169.254",
];

export function validateUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, error: "Only HTTP and HTTPS URLs are supported" };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: "URL points to a blocked hostname" };
  }

  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(hostname)) {
      return { valid: false, error: "URL points to a private/internal IP address" };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function sendLog(
  server: McpServer,
  level: "info" | "warning" | "error",
  message: string,
): void {
  // Fire-and-forget: best-effort progress reporting via MCP logging
  (server as any).server?.sendLoggingMessage?.({
    level,
    logger: "scan_product",
    data: message,
  })?.catch?.(() => {});
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerScanTool(
  server: McpServer,
  deps: ScanToolDeps,
): void {
  server.registerTool(
    "scan_product",
    {
      title: "Scan Product Website",
      description:
        "Crawl a product's website and generate a ProductProfile with identity, " +
        "revenue architecture, entity model, journey stages, and metrics. " +
        "Returns a human-readable summary.",
      inputSchema: {
        type: "object" as const,
        properties: {
          url: {
            type: "string",
            description: "Product website URL (e.g. https://linear.app)",
          },
        },
        required: ["url"],
      },
    },
    async (args: { url: string }) => {
      // Phase 1: Validate
      sendLog(server, "info", "Validating URL...");
      const validation = validateUrl(args.url);
      if (!validation.valid) {
        return errorResult(`Invalid URL: ${validation.error}`);
      }

      // Phase 2: Crawl
      sendLog(server, "info", "Crawling website...");
      let crawlResult: CrawlResult;
      try {
        crawlResult = await deps.crawler.crawl(args.url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return errorResult(`Crawl failed: ${msg}`);
      }

      sendLog(server, "info", `Crawled ${crawlResult.pages.length} pages`);

      if (crawlResult.pages.length === 0) {
        const hint = crawlResult.errors.length > 0
          ? ` Errors: ${crawlResult.errors.map((e) => e.error).join("; ")}`
          : "";
        return errorResult(
          `No pages could be crawled from ${args.url}.${hint} Check that the URL is correct and publicly accessible.`,
        );
      }

      // Phase 3: Analyze
      sendLog(server, "info", "Analyzing content...");
      let profile: Record<string, unknown>;
      try {
        profile = await deps.analyzePipeline(crawlResult.pages);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return errorResult(`Analysis failed: ${msg}`);
      }

      sendLog(server, "info", "Analysis complete");

      // Attach URL to profile
      profile.url = args.url;

      // Phase 4: Save
      sendLog(server, "info", "Saving profile...");
      let profileId: string;
      try {
        profileId = await deps.storage.save(profile);
      } catch (err) {
        // Profile was generated but not saved. Still return the summary.
        const msg = err instanceof Error ? err.message : String(err);
        sendLog(server, "warning", `Failed to save profile: ${msg}`);
        const summary = formatProfileSummary(profile as any, "(unsaved)");
        return {
          content: [{
            type: "text" as const,
            text: summary + `\n\n**Warning:** Profile could not be saved: ${msg}`,
          }],
        };
      }

      // Phase 5: Return summary
      sendLog(server, "info", "Done");
      const summary = formatProfileSummary(profile as any, profileId);
      return {
        content: [{ type: "text" as const, text: summary }],
      };
    },
  );
}
```

**Key decisions in this implementation:**

1. **No `withUser`/`withUserArgs` wrapper** -- per design doc expert review, auth is a server-level concern. The tool handler is a plain `async (args) => ...`.
2. **`AnalyzePipeline` as a single function** -- the scan tool does not know about individual extractors, lenses, or convergence. It passes pages to a pre-configured pipeline function that the server wires up. This keeps the tool simple and the pipeline testable independently.
3. **`validateUrl` duplicated** from `convex/lib/urlUtils.ts` -- the open-source package cannot import from `convex/`. When `@basesignal/core` lands (M008-E001-S005), move `validateUrl` there and import it.
4. **Storage failure is non-fatal** -- if storage fails, the summary is still returned with a warning. The profile was generated; the user can re-save later.
5. **`sendLog` is best-effort** -- accesses the underlying MCP server's logging API. If not available, silently fails.

### Step 3: Update `server/tools/index.ts` -- wire in dependencies

Update `server/tools/index.ts` to accept dependencies and register the scan tool:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from "./ping.js";
import { registerProductTools } from "./products.js";
import { registerScanTool, type ScanToolDeps } from "./scan.js";

export interface ToolDeps {
  scan?: ScanToolDeps;
}

export function registerTools(server: McpServer, deps?: ToolDeps) {
  registerPingTool(server);
  registerProductTools(server);

  // Register the self-hosted scan tool when dependencies are provided
  if (deps?.scan) {
    registerScanTool(server, deps.scan);
  }
}
```

**Why optional:** The existing hosted server (`server/index.ts`) does not have the Crawler/StorageAdapter dependencies yet. Making `deps` optional preserves backward compatibility -- the existing tool registration continues to work, and the self-hosted server passes in its dependencies when available.

**Note:** The existing `scan_product` in `products.ts` (Convex-backed) and the new one in `scan.ts` both register a tool named `"scan_product"`. When `deps.scan` is provided, the new tool replaces the old one (MCP SDK uses the last registration). When `deps.scan` is omitted, the Convex-backed tool remains. This is the transitional strategy; once the open-source package is fully wired, `products.ts` can be cleaned up.

### Step 4: Create `server/tools/scan.test.ts` -- unit tests

Create `server/tools/scan.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerScanTool,
  validateUrl,
  type Crawler,
  type CrawlResult,
  type StorageAdapter,
  type AnalyzePipeline,
  type ScanToolDeps,
} from "./scan.js";
import { formatProfileSummary, type FormattableProfile } from "./formatProfile.js";

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function mockCrawlResult(pages: CrawlResult["pages"] = []): CrawlResult {
  return {
    pages,
    timing: { startedAt: 0, completedAt: 100, totalMs: 100 },
    errors: [],
  };
}

function mockProfile(): Record<string, unknown> {
  return {
    url: "https://example.com",
    identity: {
      productName: "Acme",
      description: "Project management tool",
      targetCustomer: "Engineering teams",
      businessModel: "B2B SaaS",
      confidence: 0.85,
    },
    revenue: {
      model: "subscription",
      hasFreeTier: true,
      tiers: [{ name: "Free", price: "$0", features: ["Basic"] }],
      confidence: 0.8,
    },
    completeness: 0.7,
    overallConfidence: 0.82,
  };
}

function createMockDeps(overrides?: Partial<ScanToolDeps>): ScanToolDeps {
  return {
    crawler: {
      name: "mock-crawler",
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
    },
    storage: {
      save: vi.fn(async () => "profile-123"),
      load: vi.fn(async () => null),
      list: vi.fn(async () => []),
    },
    analyzePipeline: vi.fn(async () => mockProfile()),
    ...overrides,
  };
}

function getRegisteredTool(server: McpServer, name: string) {
  return (server as any)._registeredTools?.[name];
}

async function callScanTool(
  deps: ScanToolDeps,
  args: { url: string },
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerScanTool(server, deps);
  const tool = getRegisteredTool(server, "scan_product");
  // The MCP SDK stores the handler; invoke it directly
  return tool.handler(args, {});
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
});

// ---------------------------------------------------------------------------
// scan_product tool registration tests
// ---------------------------------------------------------------------------

describe("registerScanTool", () => {
  it("registers scan_product tool with correct metadata", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    const deps = createMockDeps();
    registerScanTool(server, deps);

    const tool = getRegisteredTool(server, "scan_product");
    expect(tool).toBeDefined();
    expect(tool.description).toContain("Crawl a product");
  });

  it("accepts url as required input parameter", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerScanTool(server, createMockDeps());

    const tool = getRegisteredTool(server, "scan_product");
    expect(tool.inputSchema.properties).toHaveProperty("url");
    expect(tool.inputSchema.required).toContain("url");
  });
});

// ---------------------------------------------------------------------------
// scan_product handler tests (pipeline orchestration)
// ---------------------------------------------------------------------------

describe("scan_product handler", () => {
  it("returns error for invalid URL", async () => {
    const deps = createMockDeps();
    const result = await callScanTool(deps, { url: "not-a-url" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid URL");
  });

  it("returns error for localhost URL", async () => {
    const deps = createMockDeps();
    const result = await callScanTool(deps, { url: "http://localhost:3000" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("blocked");
  });

  it("orchestrates crawl -> analyze -> save -> summarize", async () => {
    const deps = createMockDeps();
    const result = await callScanTool(deps, { url: "https://example.com" });

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
    const deps = createMockDeps({
      crawler: {
        name: "mock",
        crawl: vi.fn(async () => mockCrawlResult([])),
      },
    });
    const result = await callScanTool(deps, { url: "https://example.com" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No pages could be crawled");
  });

  it("returns error when crawler throws", async () => {
    const deps = createMockDeps({
      crawler: {
        name: "mock",
        crawl: vi.fn(async () => {
          throw new Error("DNS resolution failed");
        }),
      },
    });
    const result = await callScanTool(deps, { url: "https://bad-domain.example" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Crawl failed");
    expect(result.content[0].text).toContain("DNS resolution failed");
  });

  it("returns error when analysis pipeline throws", async () => {
    const deps = createMockDeps({
      analyzePipeline: vi.fn(async () => {
        throw new Error("LLM API key invalid");
      }),
    });
    const result = await callScanTool(deps, { url: "https://example.com" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Analysis failed");
  });

  it("returns summary with warning when storage fails", async () => {
    const deps = createMockDeps({
      storage: {
        save: vi.fn(async () => {
          throw new Error("Disk full");
        }),
        load: vi.fn(async () => null),
        list: vi.fn(async () => []),
      },
    });
    const result = await callScanTool(deps, { url: "https://example.com" });

    // Should NOT be an error -- profile was generated
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("# Acme Profile");
    expect(result.content[0].text).toContain("(unsaved)");
    expect(result.content[0].text).toContain("Disk full");
  });

  it("includes crawl errors in message when zero pages", async () => {
    const deps = createMockDeps({
      crawler: {
        name: "mock",
        crawl: vi.fn(async () => ({
          pages: [],
          timing: { startedAt: 0, completedAt: 0, totalMs: 0 },
          errors: [{ url: "https://example.com", error: "403 Forbidden" }],
        })),
      },
    });
    const result = await callScanTool(deps, { url: "https://example.com" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("403 Forbidden");
  });

  it("returns human-readable markdown, not raw JSON", async () => {
    const deps = createMockDeps();
    const result = await callScanTool(deps, { url: "https://example.com" });

    const text = result.content[0].text;
    // Should contain markdown headings, not JSON brackets
    expect(text).toContain("#");
    expect(text).toContain("**");
    expect(text).not.toMatch(/^\s*\{/); // Not starting with JSON
  });
});
```

**Test structure:**
1. `validateUrl` -- pure function, no mocks needed
2. `formatProfileSummary` -- pure function, test all sections
3. `registerScanTool` -- registration metadata checks
4. Handler pipeline -- mock all three dependencies, test each phase and error case

**Test helper `callScanTool`:** Creates a server, registers the tool, extracts the handler from the SDK internals, and invokes it directly. This matches the pattern in `products.test.ts` and `ping.test.ts` which access `(server as any)._registeredTools`.

### Step 5: Update `products.test.ts` to account for the optional scan tool override

The existing test in `server/tools/products.test.ts` asserts `toolNames.toHaveLength(5)` and includes `scan_product`. When `deps.scan` is provided to `registerTools`, the scan tool gets re-registered. Update the test:

In `server/tools/products.test.ts`, change:

```typescript
  it("registers all expected tools", () => {
    const tools = getRegisteredTools();
    const toolNames = Object.keys(tools);
    expect(toolNames).toEqual(
      expect.arrayContaining([
        "ping",
        "create_product",
        "list_products",
        "scan_product",
        "get_scan_status",
      ])
    );
    expect(toolNames).toHaveLength(5);
  });
```

No actual change needed here -- the Convex-backed `scan_product` is still registered by `registerProductTools`. The new tool only registers when `deps.scan` is passed, which these tests do not do. The existing tests remain valid.

## Verification

After implementation, run:

```bash
npm test -- --run server/tools/scan.test.ts
npm test -- --run server/tools/products.test.ts
npm test -- --run server/tools/ping.test.ts
```

All existing tests must continue to pass. The new `scan.test.ts` covers:

| Acceptance Criterion | Test |
|---------------------|------|
| scan_product tool is registered with MCP SDK | `registerScanTool` > registers scan_product tool |
| Tool accepts { url: string } as input parameter | `registerScanTool` > accepts url as required input |
| Tool orchestrates: crawl -> analyze -> save -> return | handler > orchestrates crawl -> analyze -> save |
| Tool returns human-readable summary | handler > returns human-readable markdown |
| Errors produce helpful error messages | handler > error tests (4 cases) |
| Integration test (end-to-end) | Deferred to M008 integration -- requires real Crawler + LLM |

## Migration Path

This implementation is forward-compatible with the dependency packages:

1. **When `@basesignal/core` lands** (M008-E001-S002): Replace the local `FormattableProfile` interface in `formatProfile.ts` with `import type { ProductProfile } from "@basesignal/core"`. Move `validateUrl` to `@basesignal/core`.

2. **When `@basesignal/crawlers` lands** (M008-E003-S001/S002): Replace local `Crawler`, `CrawlResult`, `CrawledPage` interfaces with `import { ... } from "@basesignal/crawlers"`.

3. **When `@basesignal/storage` lands** (M008-E004-S001): Replace local `StorageAdapter` interface with `import { StorageAdapter } from "@basesignal/storage"`.

4. **When analysis pipeline is extracted** (M008-E002-S002): The `AnalyzePipeline` function type already matches the expected signature. Wire the real pipeline in `server/index.ts` or `packages/mcp-server/src/index.ts`.

5. **When `packages/mcp-server/` exists** (M008-E002-S001): Move `scan.ts` and `formatProfile.ts` to `packages/mcp-server/src/tools/`. The code is designed with no Convex, Clerk, or Express imports.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `server/tools/formatProfile.ts` | Create | Pure function for markdown profile summary |
| `server/tools/scan.ts` | Create | Tool registration, handler, URL validation, dependency interfaces |
| `server/tools/scan.test.ts` | Create | Unit tests for all three files |
| `server/tools/index.ts` | Modify | Accept optional `ToolDeps`, wire `registerScanTool` |
