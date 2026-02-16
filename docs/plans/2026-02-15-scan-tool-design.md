# Design: scan_product MCP Tool Handler

**Story:** M008-E002-S003
**Date:** 2026-02-15
**Status:** brainstorm

---

## Context

The `scan_product` tool is the flagship MCP tool. Today it already exists in `server/tools/products.ts` as a thin proxy: it accepts a `productId`, calls the `mcpProducts.scanProduct` Convex mutation, which schedules a Convex internal action (`scanning.startScan`) that does the real work: Firecrawl map/scrape, page storage, and analysis pipeline orchestration.

The story M008-E002-S003 is about redesigning this tool for the open-source, self-hostable MCP server package (`packages/mcp-server/`). The key shift: instead of delegating to Convex backend actions, the tool handler itself orchestrates the pipeline using injected interfaces (Crawler, LLM provider, Storage adapter).

### Dependencies

- **M008-E002-S002** (Analysis Pipeline Integration): Lens extraction, convergence, and output generation as portable functions that accept `CrawledContent[]` + `LlmProvider`.
- **M008-E003-S002** (Website Crawler): `WebsiteCrawler` implementing the `Crawler` interface.
- **M008-E004-S001** (Storage Interface + SQLite): `StorageAdapter` with `save(profile)`, `load(id)`, `list()`.

These dependencies define the three interfaces this tool composes.

---

## Design

### 1. Tool Input Schema

```typescript
server.registerTool("scan_product", {
  title: "Scan Product Website",
  description:
    "Crawl a product's website and generate a ProductProfile with identity, revenue architecture, activation definitions, entity model, journey stages, ICP profiles, and metrics. Returns a human-readable summary.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Product website URL (e.g. https://linear.app)",
      },
    },
    required: ["url"],
  },
});
```

**Why `url` not `productId`:** The self-hosted server has no concept of a pre-created "product workspace" requiring two steps. One URL in, one profile out. The storage adapter auto-assigns an ID.

**No options object:** Start with the simplest possible surface. No `maxPages`, no `skipAnalysis`, no `force` flag. Add them later if real usage demands it.

### 2. Pipeline Orchestration

The handler is a sequential pipeline with three phases:

```
validate(url) -> crawl(url) -> analyze(pages) -> save(profile) -> summarize(profile)
```

```typescript
withUser(async (user, args: { url: string }, extra) => {
  // Phase 1: Validate
  const validation = validateUrl(args.url);
  if (!validation.valid) {
    return errorResult(`Invalid URL: ${validation.error}`);
  }

  // Phase 2: Crawl
  log(extra, "info", "Crawling website...");
  const pages = await crawler.crawl(args.url);
  log(extra, "info", `Crawled ${pages.length} pages`);

  if (pages.length === 0) {
    return errorResult("No pages could be crawled from this URL.");
  }

  // Phase 3: Analyze
  log(extra, "info", "Analyzing content...");
  const profile = await analyzePipeline(pages, llm);
  log(extra, "info", "Analysis complete");

  // Phase 4: Save
  const profileId = await storage.save(profile);

  // Phase 5: Return summary
  return {
    content: [{
      type: "text",
      text: formatProfileSummary(profile, profileId),
    }],
  };
});
```

**Key decision: synchronous, not async-with-polling.** The current Convex implementation uses `scheduler.runAfter(0, ...)` because Convex actions have execution limits. The self-hosted MCP server has no such constraint. Running synchronously means:
- No `get_scan_status` polling tool needed for the open-source version.
- The AI assistant gets the result in a single tool call.
- Simpler mental model: call scan, get profile.

The tradeoff is that the tool call takes 30-90 seconds. MCP tools are allowed to take time. The client (Claude Desktop, etc.) shows a spinner. This is acceptable for a scan that happens once per product.

### 3. Progress Reporting

Use the MCP SDK's `sendLoggingMessage` for progress updates. This is the standard mechanism -- no experimental APIs needed.

```typescript
function log(
  extra: ToolExtra,
  level: "info" | "warning" | "error",
  message: string
): void {
  // Fire-and-forget: don't await, don't block the pipeline
  server.sendLoggingMessage({
    level,
    logger: "scan_product",
    data: message,
  }).catch(() => {});
}
```

Progress phases reported:
1. `"Validating URL..."` (immediate)
2. `"Discovering pages..."` (Firecrawl map / link discovery)
3. `"Crawling N pages..."` (batch scrape in progress)
4. `"Crawled N/M pages"` (per-page progress if crawler supports it)
5. `"Analyzing content (identity, revenue, entities)..."` (Phase 1 extractors)
6. `"Analyzing content (journey, metrics, activation)..."` (Phase 2 extractors)
7. `"Saving profile..."` (storage write)
8. `"Done"` (complete)

Not all MCP clients display logging notifications. That's fine -- the progress messages are best-effort. The tool result itself is always sufficient.

### 4. Result Format

The tool returns a human-readable markdown summary, not raw JSON. AI assistants relay this to users directly.

```typescript
function formatProfileSummary(
  profile: ProductProfile,
  profileId: string
): string {
  const lines: string[] = [];

  lines.push(`# ${profile.identity?.productName ?? "Product"} Profile`);
  lines.push("");
  lines.push(`**Profile ID:** ${profileId}`);
  lines.push(`**URL:** ${profile.url}`);
  lines.push("");

  if (profile.identity) {
    lines.push(`## Identity`);
    lines.push(`- **Description:** ${profile.identity.description}`);
    lines.push(`- **Target Customer:** ${profile.identity.targetCustomer}`);
    lines.push(`- **Business Model:** ${profile.identity.businessModel}`);
    lines.push("");
  }

  if (profile.revenue) {
    lines.push(`## Revenue`);
    lines.push(`- **Model:** ${profile.revenue.model}`);
    lines.push(`- **Free Tier:** ${profile.revenue.hasFreeTier ? "Yes" : "No"}`);
    lines.push(`- **Tiers:** ${profile.revenue.tiers.map(t => t.name).join(", ")}`);
    lines.push("");
  }

  // ... (journey, entities, activation, metrics sections)

  lines.push(`## Completeness`);
  lines.push(`- **Score:** ${Math.round(profile.completeness * 100)}%`);
  lines.push(`- **Overall Confidence:** ${Math.round(profile.overallConfidence * 100)}%`);

  return lines.join("\n");
}
```

### 5. Error Handling

Errors fall into three categories with different handling:

| Error Type | Example | Handling |
|-----------|---------|----------|
| **Input validation** | Invalid URL, private IP, non-HTTP protocol | Return `isError: true` with helpful message. No retries. |
| **Crawl failures** | DNS failure, timeout, 403/404 | Return `isError: true` with the specific HTTP error. Suggest checking URL. |
| **Partial crawl** | Some pages fail, others succeed | Continue with available pages. Note in result summary. |
| **LLM errors** | Rate limit, API key invalid, parse failure | Per-extractor: skip failed sections, continue with others. Note in result summary. |
| **Storage errors** | Disk full, permission denied | Return `isError: true`. Profile was generated but not saved. |

```typescript
// Error result helper
function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
```

**Partial failure strategy:** The analysis pipeline runs 6+ extractors. If identity extraction fails but revenue succeeds, we still save and return a partial profile. The `completeness` score reflects what was extracted. The summary lists which sections succeeded and which failed.

```typescript
// In the analysis phase:
const results = await Promise.allSettled([
  extractAndStore("identity", pages, llm),
  extractAndStore("revenue", pages, llm),
  extractAndStore("entities", pages, llm),
  extractAndStore("outcomes", pages, llm),
]);

const succeeded = results.filter(r => r.status === "fulfilled").length;
const failed = results.filter(r => r.status === "rejected").length;

if (succeeded === 0) {
  return errorResult("Analysis failed for all sections. Check your LLM API key.");
}

// Continue with partial profile...
```

### 6. Idempotency (Re-scanning Same URL)

**Design: always re-scan, store as new version.**

No deduplication or caching. Reasons:
- Products change their websites. A scan from last week may be stale.
- The user explicitly asked to scan -- honor that intent.
- Storage is cheap (a profile is ~50KB JSON).

The storage adapter's `list()` returns all profiles. If the same URL was scanned before, both profiles appear. The user can delete old ones via a separate tool (`delete_profile`).

**Future consideration:** If re-scanning becomes noisy, add an optional `force` parameter that defaults to `true`. When `false`, return the existing profile if one exists and was scanned within the last 24 hours. But don't build this until there's a real need.

### 7. Module Structure

```
server/tools/scan.ts          -- tool registration + handler
server/tools/scan.test.ts     -- unit tests
server/tools/formatProfile.ts -- summary formatting (pure function)
```

The handler function composes the injected dependencies:

```typescript
export function registerScanTool(
  server: McpServer,
  deps: {
    crawler: Crawler;
    llm: LlmProvider;
    storage: StorageAdapter;
  }
) {
  server.registerTool("scan_product", { ... },
    withUserArgs(async (user, args: { url: string }, extra) => {
      // ... pipeline using deps.crawler, deps.llm, deps.storage
    })
  );
}
```

**Dependency injection at registration time**, not per-request. The server process creates one crawler, one LLM provider, one storage adapter, and passes them to all tool registrations. Simple, testable, no service locator pattern.

For tests, inject mock implementations:

```typescript
const mockCrawler: Crawler = {
  crawl: async (url) => [
    { url, pageType: "homepage", content: "...", title: "Acme" },
  ],
};
const mockLlm: LlmProvider = { /* returns canned responses */ };
const mockStorage: StorageAdapter = { /* in-memory map */ };
```

---

## Expert Review

### Technical Architect Assessment

The design follows the principle of composition over configuration. Three interfaces (Crawler, LlmProvider, StorageAdapter) compose into one pipeline. The API surface is minimal: one input (`url`), one output (markdown summary). No options, no modes, no configuration flags.

The synchronous execution decision is correct for this context. Convex needed async polling because of platform constraints. The self-hosted server has no such constraint. Removing the polling tool (`get_scan_status`) cuts the API surface by 20%.

One concern: the `withUser` wrapper assumes Clerk authentication. The open-source server needs to work without Clerk. The tool registration should accept either authenticated or anonymous usage, controlled by server configuration.

### Simplification Reviewer Assessment

**Verdict: APPROVED with one cut.**

What to remove:
- The `withUser` auth wrapper should not be in the scan tool. Authentication is a server-level concern, not a tool-level concern. If the server requires auth, it handles it at the transport layer. Tool handlers should receive a context object that may or may not include a user. Don't force auth on every tool.

What feels right:
- Single `url` input, no options object. Correct.
- Synchronous pipeline. Correct. The async polling pattern was platform-imposed complexity.
- Human-readable markdown output. Correct. Raw JSON is for machines, and the consumer is an AI assistant relaying to a human.
- No idempotency logic. Correct. Simplest thing that works.

What to watch:
- The `formatProfileSummary` function will grow. Keep it a pure function in its own file so it can be tested independently.
- The logging progress messages are best-effort, which is correct. Don't let them complicate the happy path.

---

## Implementation Plan

1. **Create `server/tools/scan.ts`** with the tool registration function
2. **Create `server/tools/formatProfile.ts`** for the markdown summary formatter
3. **Update `server/tools/index.ts`** to wire in dependencies and call `registerScanTool`
4. **Update the existing `scan_product` tool** in `products.ts` -- the current tool delegates to Convex. Either:
   - (a) Replace it with the new implementation, or
   - (b) Keep both and let the server configuration choose (Convex-backed vs self-hosted)

   Recommendation: (a) for the open-source package, (b) for the hosted SaaS. The story is about the open-source package, so (a).
5. **Write tests** covering: registration, URL validation, crawl-then-analyze pipeline with mocks, error cases, partial failures, summary formatting

---

## Open Questions

1. **Auth story for open-source:** The current `withUser` wrapper ties to Clerk. The open-source server likely runs locally without auth. Should the scan tool handler accept an optional user context? Or should auth be a server-level middleware that's entirely absent in local mode?

2. **Where does `analyzePipeline` live?** The story depends on M008-E002-S002 (analysis pipeline integration). If that package exports a single `analyze(pages, llm)` function, the scan tool just calls it. If the pipeline is multiple steps, the scan tool orchestrates them. Need to align on the interface boundary.

3. **Crawler interface for Firecrawl vs built-in:** The current scanning.ts uses Firecrawl directly. The M008-E003-S002 story defines a `Crawler` interface. The scan tool should be agnostic -- but during the transition, it may need to support both. Consider: default to built-in crawler, allow Firecrawl via environment variable.
