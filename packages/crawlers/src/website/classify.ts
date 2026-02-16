/**
 * Classify a URL by page type based on URL path patterns.
 * Adapted from convex/lib/urlUtils.ts for standalone use in @basesignal/crawlers.
 */
export function classifyPageType(url: string, rootHostname?: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "other";
  }

  const hostname = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  const isMainDomain = rootHostname
    ? hostname === rootHostname ||
      hostname === `www.${rootHostname}` ||
      `www.${hostname}` === rootHostname
    : true;

  if ((path === "/" || path === "") && isMainDomain) return "homepage";
  if (path.match(/^\/(pricing|plans)(\/|$)/)) return "pricing";
  if (path.match(/^\/(features?|product)(\/|$)/)) return "features";
  if (
    path.match(/^\/(about|company)(\/|$)/) &&
    !path.includes("career") &&
    !path.includes("jobs")
  )
    return "about";
  if (path.match(/^\/(customers?|case-studies?|stories|success-stories)(\/|$)/))
    return "customers";
  if (path.match(/^\/(enterprise)(\/|$)/)) return "enterprise";
  if (path.match(/^\/(integrations?)(\/|$)/)) return "integrations";
  if (path.match(/^\/(security|compliance|trust)(\/|$)/)) return "security";
  if (path.match(/^\/(solutions?|use-cases?)(\/|$)/)) return "solutions";
  if (path.match(/^\/(docs|help|support|getting-started)(\/|$)/)) return "docs";

  // Subdomain classifications
  if (rootHostname) {
    if (hostname.startsWith("help.")) return "help";
    if (hostname.startsWith("docs.")) return "docs";
    if (hostname.startsWith("support.")) return "support";
  }

  return "other";
}

/**
 * URL path patterns to skip during crawl (low-value for product analysis).
 */
const SKIP_PATTERNS = [
  /^\/(blog|press|careers|jobs)(\/|$)/,
  /^\/(legal|privacy|terms|cookie)/,
  /^\/(login|signup|register|auth)\b/,
  /\.(pdf|png|jpg|jpeg|svg|gif|webp|zip|tar|gz)$/,
  /^\/(templates)\//,
  /^\/sitemap\.xml$/,
  /^\/(demo|changelog)(\/|$)/,
];

const LOCALIZED_PREFIXES = [
  /^\/(es|de|fr|it|pt|nl|pl|ru|ja|ko|zh|fi|sv|da|no|cs)\//,
];

/**
 * Whether a URL should be included in the crawl.
 * Rejects off-domain, docs subdomains, localized, and low-value paths.
 */
export function shouldCrawlUrl(url: string, rootHostname: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    // Same origin only
    const baseDomain = hostname.replace(/^www\./, "");
    if (baseDomain !== rootHostname && !hostname.endsWith(`.${rootHostname}`)) {
      return false;
    }

    // Skip help/docs subdomains (handled by separate docs crawler)
    if (
      hostname.startsWith("help.") ||
      hostname.startsWith("support.") ||
      hostname.startsWith("docs.")
    ) {
      return false;
    }

    // Skip localized
    if (LOCALIZED_PREFIXES.some((p) => p.test(path))) return false;

    // Skip low-value patterns
    if (SKIP_PATTERNS.some((p) => p.test(path))) return false;

    return true;
  } catch {
    return false;
  }
}
