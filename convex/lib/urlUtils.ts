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
 */
export function classifyPageType(url: string): string {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return "other";
  }

  if (path === "/" || path === "") return "homepage";
  if (path.includes("pricing") || path.includes("plans")) return "pricing";
  if (path.includes("feature") || path.includes("product")) return "features";
  if (path.includes("about") || path.includes("company")) return "about";
  if (path.includes("customer") || path.includes("case-stud")) return "customers";
  if (path.includes("integrat")) return "integrations";
  if (path.includes("security") || path.includes("compliance")) return "security";
  if (path.includes("solution") || path.includes("use-case")) return "solutions";
  return "other";
}

const SKIP_PATTERNS = [
  "/blog/", "/press/", "/careers/", "/jobs/",
  "/legal", "/privacy", "/terms", "/cookie",
  "/login", "/signup", "/register", "/auth/",
  ".pdf", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp",
  ".zip", ".tar", ".gz",
];

/**
 * Determine if a URL should be crawled based on path patterns.
 * Skips blog, legal, auth, and asset URLs.
 */
export function shouldCrawl(url: string): boolean {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }

  return !SKIP_PATTERNS.some((p) => path.includes(p));
}

/**
 * Check if a URL is likely a documentation site.
 */
export function isDocsSite(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return hostname.startsWith("docs.") || path.startsWith("/docs");
  } catch {
    return false;
  }
}

const MAX_PAGES = 30;

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
    rootHostname = new URL(rootUrl).hostname.toLowerCase();
  } catch {
    return { targetUrls: [], docsUrl: undefined };
  }

  let docsUrl: string | undefined;

  // Filter to same domain, crawlable URLs
  const filtered = urls.filter((url) => {
    try {
      const parsed = new URL(url);
      // Must be same base domain (allow subdomains like www.)
      if (!parsed.hostname.toLowerCase().endsWith(rootHostname.replace(/^www\./, "")) &&
          !rootHostname.replace(/^www\./, "").endsWith(parsed.hostname.toLowerCase().replace(/^www\./, ""))) {
        // Check for docs subdomain
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

  // Also check filtered URLs for docs sites
  for (const url of filtered) {
    if (isDocsSite(url) && !docsUrl) {
      docsUrl = url;
    }
  }

  // Prioritize: homepage and known high-value pages first
  const mustCrawl: string[] = [];
  const shouldCrawlUrls: string[] = [];
  const otherUrls: string[] = [];

  for (const url of filtered) {
    const pageType = classifyPageType(url);
    if (pageType === "homepage" || pageType === "pricing" || pageType === "features" || pageType === "about") {
      mustCrawl.push(url);
    } else if (pageType === "customers" || pageType === "integrations" || pageType === "security" || pageType === "solutions") {
      shouldCrawlUrls.push(url);
    } else {
      otherUrls.push(url);
    }
  }

  const targetUrls = [...mustCrawl, ...shouldCrawlUrls, ...otherUrls].slice(0, MAX_PAGES);

  return { targetUrls, docsUrl };
}
