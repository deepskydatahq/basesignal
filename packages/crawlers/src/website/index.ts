import type {
  Crawler,
  CrawlOptions,
  CrawlResult,
  CrawledPage,
  CrawlError,
} from "../types";
import { classifyPageType, shouldCrawlUrl } from "./classify";
import { extractContent, extractMetadata } from "./extract";
import { discoverLinks } from "./discover";

const DEFAULT_MAX_PAGES = 30;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_TIMEOUT = 60_000; // 60 seconds
const DEFAULT_USER_AGENT = "BasesignalCrawler/1.0";
const MAX_CONTENT_LENGTH = 100_000; // 100KB per page

/**
 * Fetcher function type. Matches the global fetch signature.
 * Injectable for testing -- swap in a fixture-backed fetcher.
 */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export class WebsiteCrawler implements Crawler {
  readonly name = "website";
  readonly sourceType = "website" as const;

  private fetcher: Fetcher;

  constructor(options?: { fetcher?: Fetcher }) {
    this.fetcher = options?.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  canCrawl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
    const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
    const signal = options?.signal ?? AbortSignal.timeout(timeout);

    const startedAt = Date.now();
    const pages: CrawledPage[] = [];
    const errors: CrawlError[] = [];

    // BFS crawl
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [
      { url: normalizeUrl(url), depth: 0 },
    ];
    const rootHostname = getRootHostname(url);

    while (queue.length > 0 && pages.length < maxPages) {
      if (signal.aborted) break;

      const item = queue.shift()!;
      const normalizedUrl = normalizeUrl(item.url);

      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      // Only crawl same-origin URLs
      if (!isSameOrigin(normalizedUrl, rootHostname)) continue;

      try {
        const response = await this.fetcher(normalizedUrl, {
          headers: { "User-Agent": userAgent },
          signal,
        });

        if (!response.ok) {
          errors.push({ url: normalizedUrl, error: `HTTP ${response.status}` });
          continue;
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) continue;

        const html = await response.text();

        // Extract content and metadata
        const content = extractContent(html);
        const metadata = extractMetadata(html);
        const pageType = classifyPageType(normalizedUrl, rootHostname);
        const title = metadata.title;

        // Truncate content
        const truncated =
          content.length > MAX_CONTENT_LENGTH
            ? content.slice(0, MAX_CONTENT_LENGTH)
            : content;

        pages.push({
          url: normalizedUrl,
          pageType,
          title,
          content: truncated,
          metadata: {
            description: metadata.description,
            ogImage: metadata.ogImage,
          },
        });

        // Discover links for BFS (only if we haven't hit depth limit)
        if (item.depth < maxDepth) {
          const links = discoverLinks(html, normalizedUrl);
          for (const link of links) {
            const normalized = normalizeUrl(link);
            if (
              !visited.has(normalized) &&
              shouldCrawlUrl(normalized, rootHostname)
            ) {
              queue.push({ url: normalized, depth: item.depth + 1 });
            }
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        if (signal.aborted) break;
        errors.push({ url: normalizedUrl, error: message });
      }
    }

    const completedAt = Date.now();
    return {
      pages,
      timing: { startedAt, completedAt, totalMs: completedAt - startedAt },
      errors,
    };
  }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    // Remove trailing slash for consistency (except root)
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return url;
  }
}

function getRootHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSameOrigin(url: string, rootHostname: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return hostname === rootHostname || hostname.endsWith(`.${rootHostname}`);
  } catch {
    return false;
  }
}
