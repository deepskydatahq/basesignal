import * as cheerio from "cheerio";

/**
 * Discover links from an HTML page.
 * Returns absolute URLs, deduped. Does NOT filter by domain --
 * the caller (WebsiteCrawler BFS loop) handles same-origin filtering.
 */
export function discoverLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    // Skip fragment-only, javascript:, mailto:, tel:
    if (
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      return;
    }

    try {
      const resolved = new URL(href, baseUrl);
      // Strip fragment and trailing slash for dedup
      resolved.hash = "";
      const normalized = resolved.href.replace(/\/$/, "") || resolved.href;
      links.add(normalized);
    } catch {
      // Skip invalid URLs
    }
  });

  return Array.from(links);
}
