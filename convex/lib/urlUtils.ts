/**
 * URL utilities for the crawl pipeline.
 * Handles validation, classification, and filtering of URLs.
 */

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "169.254.169.254",
];

/**
 * Validate a URL is safe to crawl (prevents SSRF attacks).
 * Rejects private IPs, localhost, cloud metadata endpoints.
 */
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

/**
 * Classify a URL by its likely page type based on URL path patterns.
 * Uses strict matching for high-value pages to avoid false positives.
 *
 * @param url - The URL to classify
 * @param rootHostname - Optional root hostname for subdomain detection.
 *   When provided, subdomains are classified separately (status, developers, etc.)
 *   When not provided, root paths are treated as homepage regardless of subdomain.
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

  // When rootHostname is provided, check if this is the main domain or a subdomain
  // Subdomains get their own classification (not "homepage")
  const isMainDomain = rootHostname
    ? hostname === rootHostname ||
      hostname === `www.${rootHostname}` ||
      `www.${hostname}` === rootHostname
    : true; // When no rootHostname provided, treat all root paths as homepage

  // Homepage: only root path on main domain
  if ((path === "/" || path === "") && isMainDomain) return "homepage";

  // Skip templates - they're not product pages
  if (path.includes("/templates/") || path.startsWith("/templates")) return "template";

  // Strict matching for key pages (path starts with these segments)
  // Matches /pricing, /pricing/, /pricing/enterprise, etc.
  if (path.match(/^\/(pricing|plans)(\/|$)/)) return "pricing";
  if (path.match(/^\/(features?|product)(\/|$)/)) return "features";
  // Exclude careers/jobs subpaths from about classification
  if (path.match(/^\/(about|company)(\/|$)/) && !path.includes("career") && !path.includes("jobs")) return "about";
  if (path.match(/^\/(customers?|case-studies?|stories|success-stories|testimonials?|results)(\/|$)/)) return "customers";
  if (path.match(/^\/(enterprise)(\/|$)/)) return "enterprise";
  if (path.match(/^\/(integrations?)(\/|$)/)) return "integrations";
  if (path.match(/^\/(security|compliance|trust)(\/|$)/)) return "security";
  if (path.match(/^\/(solutions?|use-cases?)(\/|$)/)) return "solutions";
  if (path.match(/^\/(whiteboard|canvas)(\/|$)/)) return "whiteboard";

  // Subdomain-specific classifications (only when rootHostname provided)
  if (rootHostname) {
    if (hostname.startsWith("status.")) return "status";
    if (hostname.startsWith("developers.") || hostname.startsWith("api.")) return "developers";
    if (hostname.startsWith("trust.")) return "trust";
    if (hostname.startsWith("community.")) return "community";
  }

  return "other";
}

const SKIP_PATTERNS = [
  "/blog/", "/press/", "/careers/", "/jobs/",
  "/legal", "/privacy", "/terms", "/cookie",
  "/login", "/signup", "/register", "/auth/",
  ".pdf", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp",
  ".zip", ".tar", ".gz",
  "/templates/", // Skip template pages (high volume, low value for profiling)
  "sitemap.xml", // Skip sitemaps
  "/demo/", // Skip demo/sandbox pages (e.g., linear.app/demo/*)
  "/changelog/", // Skip changelog pages
];

// Localized path prefixes to skip (we only want English versions)
const LOCALIZED_PREFIXES = [
  "/es/", "/de/", "/fr/", "/it/", "/pt/", "/nl/", "/pl/", "/ru/",
  "/ja/", "/ko/", "/zh/", "/fi/", "/sv/", "/da/", "/no/", "/cs/",
];

/**
 * Determine if a URL should be crawled based on path patterns.
 * Skips blog, legal, auth, asset, template, and localized URLs.
 */
export function shouldCrawl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const path = parsed.pathname.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();

  // Skip help/docs subdomains (they're flagged separately, not crawled for classification)
  if (hostname.startsWith("help.") || hostname.startsWith("support.")) {
    return false;
  }

  // Skip localized versions
  if (LOCALIZED_PREFIXES.some((p) => path.startsWith(p))) {
    return false;
  }

  return !SKIP_PATTERNS.some((p) => path.includes(p));
}

const DOCS_PATH_PREFIXES = [
  "/docs",
  "/help",
  "/support",
  "/knowledge-base",
  "/developer",
  "/api-docs",
  "/reference",
  "/guides",
  "/learn",
  "/wiki",
];

const DOCS_HOSTNAME_PREFIXES = [
  "docs.",
  "help.",
  "support.",
  "developer.",
  "learn.",
  "wiki.",
];

/**
 * Check if a URL is likely a documentation site.
 * Detects docs subdomains (docs.*, help.*, etc.) and docs paths (/docs, /help, etc.).
 */
export function isDocsSite(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return (
      DOCS_HOSTNAME_PREFIXES.some((prefix) => hostname.startsWith(prefix)) ||
      DOCS_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
    );
  } catch {
    return false;
  }
}

const MAX_PAGES = 30;
const MAX_CUSTOMERS = 3;

// Page types by priority tier
const MUST_CRAWL_TYPES = ["homepage", "pricing", "features", "about", "enterprise", "customers"];
const SHOULD_CRAWL_TYPES = ["integrations", "security", "solutions", "whiteboard"];
const SKIP_TYPES = ["template", "status", "community"]; // Classified but not crawled

/**
 * Filter a list of discovered URLs to high-value pages.
 * Returns URLs sorted by priority (must-crawl first), limited to MAX_PAGES.
 */
export function filterHighValuePages(urls: string[], rootUrl: string): {
  targetUrls: string[];
  docsUrl: string | undefined;
} {
  let rootHostname: string;
  try {
    rootHostname = new URL(rootUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return { targetUrls: [], docsUrl: undefined };
  }

  let docsUrl: string | undefined;

  // Filter to same domain, crawlable URLs
  const filtered = urls.filter((url) => {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      const baseDomain = hostname.replace(/^www\./, "");

      // Must be same base domain (allow subdomains)
      if (!hostname.endsWith(rootHostname) && !rootHostname.endsWith(baseDomain)) {
        // Check for docs subdomain on different domain
        if (isDocsSite(url)) {
          docsUrl = url;
        }
        return false;
      }
      return shouldCrawl(url);
    } catch {
      return false;
    }
  });

  // Check filtered URLs for docs sites
  for (const url of filtered) {
    if (isDocsSite(url) && !docsUrl) {
      docsUrl = url;
    }
  }

  // Classify and prioritize
  const mustCrawl: Array<{ url: string; type: string }> = [];
  const shouldCrawlUrls: Array<{ url: string; type: string }> = [];
  const otherUrls: Array<{ url: string; type: string }> = [];

  for (const url of filtered) {
    const pageType = classifyPageType(url, rootHostname);

    // Skip types we don't want to crawl
    if (SKIP_TYPES.includes(pageType)) continue;

    if (MUST_CRAWL_TYPES.includes(pageType)) {
      mustCrawl.push({ url, type: pageType });
    } else if (SHOULD_CRAWL_TYPES.includes(pageType)) {
      shouldCrawlUrls.push({ url, type: pageType });
    } else {
      otherUrls.push({ url, type: pageType });
    }
  }

  // Deduplicate by type with per-type limits
  // Most types keep 1 page; customers allow up to MAX_CUSTOMERS for diverse case studies
  const typeCounts = new Map<string, number>();
  const deduped: string[] = [];

  function maxForType(type: string): number {
    return type === "customers" ? MAX_CUSTOMERS : 1;
  }

  for (const { url, type } of mustCrawl) {
    const count = typeCounts.get(type) ?? 0;
    if (count >= maxForType(type)) continue;
    typeCounts.set(type, count + 1);
    deduped.push(url);
  }

  for (const { url, type } of shouldCrawlUrls) {
    const count = typeCounts.get(type) ?? 0;
    if (count >= maxForType(type)) continue;
    typeCounts.set(type, count + 1);
    deduped.push(url);
  }

  // Fill remaining slots with "other" pages
  for (const { url } of otherUrls) {
    if (deduped.length >= MAX_PAGES) break;
    deduped.push(url);
  }

  return { targetUrls: deduped.slice(0, MAX_PAGES), docsUrl };
}
