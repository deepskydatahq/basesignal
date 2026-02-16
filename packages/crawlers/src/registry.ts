import type { Crawler } from "./types";

/**
 * Registry for discovering crawlers at runtime.
 *
 * Usage:
 *   const registry = new CrawlerRegistry();
 *   registry.register(websiteCrawler);
 *   registry.register(pricingCrawler);
 *
 *   const crawlers = registry.getCrawlersFor("https://linear.app");
 *   // Returns all registered crawlers where canCrawl() returns true
 */
export class CrawlerRegistry {
  private crawlers: Map<string, Crawler> = new Map();

  /**
   * Register a crawler. Throws if a crawler with the same name is already registered.
   */
  register(crawler: Crawler): void {
    if (this.crawlers.has(crawler.name)) {
      throw new Error(
        `Crawler "${crawler.name}" is already registered. ` +
        `Each crawler must have a unique name.`
      );
    }
    this.crawlers.set(crawler.name, crawler);
  }

  /**
   * Get all registered crawlers that can handle the given URL.
   * Returns crawlers in registration order.
   */
  getCrawlersFor(url: string): Crawler[] {
    const matches: Crawler[] = [];
    for (const crawler of this.crawlers.values()) {
      if (crawler.canCrawl(url)) {
        matches.push(crawler);
      }
    }
    return matches;
  }

  /**
   * Get all registered crawlers.
   */
  getAll(): Crawler[] {
    return Array.from(this.crawlers.values());
  }
}
