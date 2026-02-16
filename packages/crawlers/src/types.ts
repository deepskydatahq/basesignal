/**
 * Source types that crawlers produce data for.
 * Built-in types cover the core analysis pipeline.
 * Community crawlers can use any string -- this union is advisory, not restrictive.
 */
export type SourceType =
  | "website"
  | "social"
  | "reviews"
  | "docs"
  | "video"
  | "pricing";

/**
 * Options passed to a crawler's crawl() method.
 * All fields optional -- crawlers define sensible defaults.
 */
export interface CrawlOptions {
  /** Maximum number of pages to crawl. */
  maxPages?: number;
  /** Maximum link-follow depth from the root URL. */
  maxDepth?: number;
  /** Timeout in milliseconds for the entire crawl operation. */
  timeout?: number;
  /** User-Agent string for HTTP requests. */
  userAgent?: string;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/**
 * A single crawled page with content and metadata.
 */
export interface CrawledPage {
  /** The URL that was crawled. */
  url: string;
  /** Classified page type (e.g., 'homepage', 'features', 'pricing'). */
  pageType: string;
  /** Page title extracted from HTML <title> or og:title. */
  title?: string;
  /** The main text content (markdown or plain text). */
  content: string;
  /** Optional metadata extracted from the page. */
  metadata?: {
    description?: string;
    ogImage?: string;
    structuredData?: unknown;
  };
}

/**
 * The result of a crawl operation.
 */
export interface CrawlResult {
  /** Pages successfully crawled. */
  pages: CrawledPage[];
  /** Timing information for the crawl. */
  timing: {
    startedAt: number;
    completedAt: number;
    totalMs: number;
  };
  /** Errors encountered during crawling (per-page failures). */
  errors: CrawlError[];
}

/**
 * A per-page error that didn't halt the crawl.
 */
export interface CrawlError {
  url: string;
  error: string;
}

/**
 * The interface every crawler must implement.
 *
 * A crawler is a plain object -- no base class required.
 * Implement these four members and register with CrawlerRegistry.
 */
export interface Crawler {
  /** Human-readable name (e.g., 'website', 'g2-reviews'). */
  readonly name: string;
  /** What kind of data this crawler produces. */
  readonly sourceType: SourceType;
  /** Returns true if this crawler can handle the given URL. */
  canCrawl(url: string): boolean;
  /** Crawl the URL and return structured results. */
  crawl(url: string, options?: CrawlOptions): Promise<CrawlResult>;
}
