import type { Crawler, CrawlResult, CrawlOptions, CrawledPage, SourceType } from "./types";

/**
 * A fixture map: URL -> HTML content string.
 *
 * Example:
 *   {
 *     "https://acme.io/": "<html><head><title>Acme</title></head>...",
 *     "https://acme.io/pricing": "<html>...",
 *   }
 */
export type FixtureMap = Record<string, string>;

export interface FixtureCrawlerOptions {
  /** Name for the fixture crawler. Default: "fixture". */
  name?: string;
  /** Source type. Default: "website". */
  sourceType?: string;
  /**
   * Custom page processor. Given a URL and its HTML fixture content,
   * return a CrawledPage. If not provided, a default processor returns
   * the raw HTML as content with pageType "other".
   */
  processPage?: (url: string, html: string) => CrawledPage;
}

/**
 * Create a Crawler that serves from saved HTML fixtures instead of HTTP.
 *
 * Use this in tests to verify crawler logic without network access:
 *
 *   const crawler = createFixtureCrawler({
 *     "https://acme.io/": homepageHtml,
 *     "https://acme.io/pricing": pricingHtml,
 *   });
 *
 *   const result = await crawler.crawl("https://acme.io/");
 *   expect(result.pages).toHaveLength(2);
 *
 * The fixture crawler:
 * - Returns all fixture pages when crawled (simulates a full-site crawl)
 * - canCrawl() returns true if the URL matches any fixture key's origin
 * - Errors for URLs not in the fixture map are reported in result.errors
 */
export function createFixtureCrawler(
  fixtures: FixtureMap,
  options: FixtureCrawlerOptions = {}
): Crawler {
  const {
    name = "fixture",
    sourceType = "website",
    processPage = defaultProcessPage,
  } = options;

  const fixtureUrls = Object.keys(fixtures);
  const origins = new Set(fixtureUrls.map((url) => new URL(url).origin));

  return {
    name,
    sourceType: sourceType as SourceType,
    canCrawl(url: string): boolean {
      try {
        return origins.has(new URL(url).origin);
      } catch {
        return false;
      }
    },
    async crawl(_url: string, options?: CrawlOptions): Promise<CrawlResult> {
      const startedAt = Date.now();
      const pages: CrawledPage[] = [];
      const errors: Array<{ url: string; error: string }> = [];

      // Determine which fixtures to return
      const maxPages = options?.maxPages ?? fixtureUrls.length;
      const urlsToProcess = fixtureUrls.slice(0, maxPages);

      for (const fixtureUrl of urlsToProcess) {
        try {
          const html = fixtures[fixtureUrl];
          pages.push(processPage(fixtureUrl, html));
        } catch (err) {
          errors.push({
            url: fixtureUrl,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const completedAt = Date.now();

      return {
        pages,
        timing: {
          startedAt,
          completedAt,
          totalMs: completedAt - startedAt,
        },
        errors,
      };
    },
  };
}

function defaultProcessPage(url: string, html: string): CrawledPage {
  // Extract title from <title> tag if present
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  return {
    url,
    pageType: "other",
    title,
    content: html,
  };
}
