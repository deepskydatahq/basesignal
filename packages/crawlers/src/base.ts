import type { Crawler, CrawlOptions, CrawlResult, SourceType } from "./types";
import { parseRobotsTxt, isPathAllowed, type RobotsTxtRules } from "./robots";

export interface BaseCrawlerOptions {
  /** Delay between requests to the same domain, in milliseconds. Default: 1000. */
  delayMs?: number;
  /** Maximum content size per page in bytes. Default: 102400 (100KB). */
  maxContentBytes?: number;
  /** User-Agent string for HTTP requests and robots.txt matching. */
  userAgent?: string;
  /** Custom fetch implementation (for testing). Defaults to global fetch. */
  fetchFn?: typeof fetch;
}

const DEFAULT_DELAY_MS = 1000;
const DEFAULT_MAX_CONTENT_BYTES = 102_400; // 100KB
const DEFAULT_USER_AGENT = "BasesignalBot/1.0";

/**
 * Abstract base class providing rate limiting, robots.txt compliance,
 * and content truncation for crawlers.
 *
 * Extend this class and implement `doCrawl()` for the simplest path
 * to a working crawler. Or implement the `Crawler` interface directly
 * if you don't need these features.
 *
 * Usage:
 *   class MyCrawler extends BaseCrawler {
 *     name = "my-crawler";
 *     sourceType = "website" as const;
 *     canCrawl(url: string) { return url.includes("mysite.com"); }
 *     protected async doCrawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
 *       const html = await this.fetchWithRateLimit(url);
 *       // ... parse and return
 *     }
 *   }
 */
export abstract class BaseCrawler implements Crawler {
  abstract readonly name: string;
  abstract readonly sourceType: SourceType;
  abstract canCrawl(url: string): boolean;

  protected abstract doCrawl(
    url: string,
    options?: CrawlOptions
  ): Promise<CrawlResult>;

  private readonly delayMs: number;
  private readonly maxContentBytes: number;
  protected readonly userAgent: string;
  private readonly fetchFn: typeof fetch;

  /**
   * Per-domain timestamp of last request. Used to enforce rate limiting.
   * Keyed by hostname (e.g., "example.com").
   */
  private lastRequestTime = new Map<string, number>();

  /**
   * Per-domain robots.txt rules cache. Fetched once per domain per crawl session.
   * `null` means we tried to fetch but it failed (treat as "allow all").
   */
  private robotsCache = new Map<string, RobotsTxtRules | null>();

  constructor(options: BaseCrawlerOptions = {}) {
    this.delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
    this.maxContentBytes = options.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Public crawl method. Checks robots.txt before delegating to doCrawl().
   */
  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const allowed = await this.checkRobotsTxt(url);
    if (!allowed) {
      return {
        pages: [],
        timing: { startedAt: Date.now(), completedAt: Date.now(), totalMs: 0 },
        errors: [{ url, error: "Blocked by robots.txt" }],
      };
    }
    return this.doCrawl(url, options);
  }

  /**
   * Fetch a URL with rate limiting applied.
   * Waits until enough time has passed since the last request to the same domain.
   * Returns the Response object for the subclass to handle.
   */
  protected async fetchWithRateLimit(
    url: string,
    init?: RequestInit
  ): Promise<Response> {
    const hostname = new URL(url).hostname;
    const lastTime = this.lastRequestTime.get(hostname) ?? 0;
    const elapsed = Date.now() - lastTime;

    if (elapsed < this.delayMs) {
      await delay(this.delayMs - elapsed);
    }

    this.lastRequestTime.set(hostname, Date.now());

    return this.fetchFn(url, {
      ...init,
      headers: {
        "User-Agent": this.userAgent,
        ...init?.headers,
      },
    });
  }

  /**
   * Check if a URL is allowed by the domain's robots.txt.
   * Fetches and caches robots.txt per domain. Network errors = allow.
   */
  protected async checkRobotsTxt(url: string): Promise<boolean> {
    const parsed = new URL(url);
    const origin = parsed.origin;
    const hostname = parsed.hostname;

    if (!this.robotsCache.has(hostname)) {
      try {
        // Robots.txt fetch bypasses rate limiting (it's metadata, not content)
        const robotsUrl = `${origin}/robots.txt`;
        const response = await this.fetchFn(robotsUrl, {
          headers: { "User-Agent": this.userAgent },
        });

        if (response.ok) {
          const text = await response.text();
          const rules = parseRobotsTxt(text, this.userAgent);
          this.robotsCache.set(hostname, rules);
        } else {
          // 404 or other error = no robots.txt = allow everything
          this.robotsCache.set(hostname, null);
        }
      } catch {
        // Network error fetching robots.txt = allow everything
        this.robotsCache.set(hostname, null);
      }
    }

    const rules = this.robotsCache.get(hostname);
    if (!rules) return true; // No robots.txt or fetch failed

    return isPathAllowed(parsed.pathname, rules);
  }

  /**
   * Truncate content to the configured max byte size.
   * Truncates at a word boundary when possible to avoid cutting mid-word.
   */
  protected truncateContent(content: string, maxBytes?: number): string {
    const limit = maxBytes ?? this.maxContentBytes;
    if (content.length <= limit) return content;

    // Try to truncate at a whitespace boundary
    const truncated = content.slice(0, limit);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > limit * 0.8) {
      return truncated.slice(0, lastSpace);
    }
    return truncated;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
