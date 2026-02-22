import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import type { ToolResult } from "./types.js";
import { text, error } from "./types.js";
import { formatProfileSummary, type FormattableProfile } from "./formatProfile.js";
import type { Crawler, CrawlResult, CrawledPage } from "@basesignal/crawlers";
import type { StorageAdapter, ProductProfile } from "@basesignal/storage";

// Re-export types so tests and wiring code can import from this module
export type { Crawler, CrawlResult, CrawledPage };

// ---------------------------------------------------------------------------
// Analysis pipeline function type
// ---------------------------------------------------------------------------

/**
 * The analysis pipeline function signature.
 * Matches the runAnalysisPipeline from the analysis package, but with the LLM
 * provider already bound at construction time. The scan tool only passes pages.
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
// URL validation
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

function sendLog(
  server: McpServer,
  level: "info" | "warning" | "error",
  message: string,
): void {
  // Fire-and-forget: best-effort progress reporting via MCP logging
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).server?.sendLoggingMessage?.({
    level,
    logger: "scan_product",
    data: message,
  })?.catch?.(() => {});
}

// ---------------------------------------------------------------------------
// Tool metadata and schema
// ---------------------------------------------------------------------------

export const scanProductMeta = {
  title: "Scan Product Website",
  description:
    "Crawl a product's website and generate a ProductProfile with identity, " +
    "revenue architecture, entity model, journey stages, and metrics. " +
    "Returns a human-readable summary.",
};

export const scanProductSchema = {
  url: z
    .string()
    .describe("Product website URL (e.g. https://linear.app)"),
} as const;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export function handleScanProduct(
  server: McpServer,
  deps: ScanToolDeps,
): (args: { url: string }) => Promise<ToolResult> {
  return async (args) => {
    // Phase 1: Validate
    sendLog(server, "info", "Validating URL...");
    const validation = validateUrl(args.url);
    if (!validation.valid) {
      return error(`Invalid URL: ${validation.error}`);
    }

    // Phase 2: Crawl
    sendLog(server, "info", "Crawling website...");
    let crawlResult: CrawlResult;
    try {
      crawlResult = await deps.crawler.crawl(args.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return error(`Crawl failed: ${msg}`);
    }

    sendLog(server, "info", `Crawled ${crawlResult.pages.length} pages`);

    if (crawlResult.pages.length === 0) {
      const hint = crawlResult.errors.length > 0
        ? ` Errors: ${crawlResult.errors.map((e) => e.error).join("; ")}`
        : "";
      return error(
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
      return error(`Analysis failed: ${msg}`);
    }

    sendLog(server, "info", "Analysis complete");

    // Attach URL metadata to profile
    profile.metadata = { ...(profile.metadata as Record<string, unknown> ?? {}), url: args.url };

    // Phase 4: Save
    sendLog(server, "info", "Saving profile...");
    let profileId: string;
    try {
      profileId = await deps.storage.save(profile as ProductProfile);
    } catch (err) {
      // Profile was generated but not saved. Still return the summary.
      const msg = err instanceof Error ? err.message : String(err);
      sendLog(server, "warning", `Failed to save profile: ${msg}`);
      const summary = formatProfileSummary(
        { ...profile, url: args.url } as unknown as FormattableProfile,
        "(unsaved)",
      );
      return text(summary + `\n\n**Warning:** Profile could not be saved: ${msg}`);
    }

    // Phase 5: Return summary
    sendLog(server, "info", "Done");
    const summary = formatProfileSummary(
      { ...profile, url: args.url } as unknown as FormattableProfile,
      profileId,
    );
    return text(summary);
  };
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
    { ...scanProductMeta, inputSchema: scanProductSchema },
    handleScanProduct(server, deps),
  );
}
