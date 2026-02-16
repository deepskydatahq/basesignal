import type { Crawler, CrawlResult, CrawlOptions, CrawledPage } from "../types";
import { parsePricingContent } from "./parser";
import { htmlToText, extractMetaDescription, extractTitle } from "./html-utils";
import type { PricingMetadata } from "./types";

export type { PricingMetadata, PricingTier } from "./types";
export { parsePricingContent } from "./parser";
export { htmlToText } from "./html-utils";

/**
 * Pricing-specific URL patterns.
 * Matches /pricing, /plans, /price at the start of the URL path.
 */
const PRICING_URL_PATTERNS = [
  /\/pricing(\/|$)/i,
  /\/plans(\/|$)/i,
  /\/price(\/|$)/i,
];

const DEFAULT_USER_AGENT =
  "Basesignal/1.0 (https://basesignal.io; product analysis)";

/**
 * A crawler specialized for pricing pages.
 *
 * Unlike the WebsiteCrawler which discovers and crawls multiple pages,
 * the PricingCrawler targets a single pricing page URL, fetches it,
 * and returns both raw content and structured pricing metadata.
 *
 * canCrawl() returns true for URLs containing /pricing, /plans, or /price.
 */
export const pricingCrawler: Crawler = {
  name: "pricing",
  sourceType: "pricing",

  canCrawl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();
      return PRICING_URL_PATTERNS.some((pattern) => pattern.test(path));
    } catch {
      return false;
    }
  },

  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const startedAt = Date.now();
    const errors: Array<{ url: string; error: string }> = [];
    const pages: CrawledPage[] = [];

    try {
      // Check for cancellation
      options?.signal?.throwIfAborted();

      const response = await fetch(url, {
        headers: {
          "User-Agent": options?.userAgent ?? DEFAULT_USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        signal: options?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Convert HTML to markdown-like text for content field
      const content = htmlToText(html);

      // Extract structured pricing metadata
      const pricing: PricingMetadata = parsePricingContent(content);

      // Extract page title and meta description
      const title = extractTitle(html);
      const description = extractMetaDescription(html);

      pages.push({
        url,
        pageType: "pricing",
        title,
        content,
        metadata: {
          description,
          structuredData: { pricing },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ url, error: message });
    }

    const completedAt = Date.now();
    return {
      pages,
      timing: { startedAt, completedAt, totalMs: completedAt - startedAt },
      errors,
    };
  },
};
