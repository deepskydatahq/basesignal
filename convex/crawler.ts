import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const MAX_DEPTH = 3;
const MAX_PAGES = 50;
const JINA_API_URL = "https://r.jina.ai";

interface CrawlPage {
  url: string;
  html: string;
  title?: string;
  description?: string;
  depth: number;
  fetchedAt: number;
}

interface CrawlState {
  visited: Set<string>;
  queue: Array<{ url: string; depth: number }>;
  pages: CrawlPage[];
  robotsDisallowed: Set<string>;
  domain: string;
}

/**
 * Parse robots.txt and extract disallowed paths
 */
async function parseRobotsTxt(domain: string): Promise<Set<string>> {
  const disallowed = new Set<string>();
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Basesignal-Bot/1.0" }
    });
    if (response.ok) {
      const text = await response.text();
      const lines = text.split("\n");
      let isUserAgentMatch = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("User-agent:")) {
          const userAgent = trimmed.substring("User-agent:".length).trim();
          isUserAgentMatch = userAgent === "*" || userAgent === "Basesignal-Bot";
        }
        if (isUserAgentMatch && trimmed.startsWith("Disallow:")) {
          const path = trimmed.substring("Disallow:".length).trim();
          if (path) disallowed.add(path);
        }
      }
    }
  } catch {
    // If robots.txt fails, we continue without restrictions
  }
  return disallowed;
}

/**
 * Check if a path is disallowed by robots.txt
 */
function isPathDisallowed(path: string, disallowed: Set<string>): boolean {
  for (const disallowPath of disallowed) {
    if (path.startsWith(disallowPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return "";
  }
}

/**
 * Check if URL belongs to same domain
 */
function isSameDomain(url: string, domain: string): boolean {
  const urlDomain = extractDomain(url);
  return urlDomain === domain;
}

/**
 * Normalize URL (remove fragments, standardize)
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.hash = "";
    // Remove trailing slash for consistency
    let normalized = urlObj.toString();
    if (normalized.endsWith("/") && normalized !== urlObj.origin + "/") {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Fetch page content using Jina AI
 */
async function fetchPageWithJina(url: string): Promise<{ html: string; title?: string; description?: string } | null> {
  try {
    const jinaUrl = `${JINA_API_URL}/${url}`;
    const response = await fetch(jinaUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "Accept": "text/html" }
    });
    if (response.ok) {
      const html = await response.text();
      // Extract title from html if available
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : undefined;

      // Extract description from meta tags
      const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
      const description = descMatch ? descMatch[1] : undefined;

      return { html, title, description };
    }
  } catch {
    // If Jina fails, return null
  }
  return null;
}

/**
 * Extract links from HTML content
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  try {
    // Simple regex to extract href attributes
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      let href = match[1];
      // Skip fragments, javascript, data URLs
      if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("data:")) {
        continue;
      }
      // Handle relative URLs
      if (href.startsWith("/")) {
        try {
          const baseUrlObj = new URL(baseUrl);
          href = `${baseUrlObj.origin}${href}`;
        } catch {
          continue;
        }
      } else if (!href.startsWith("http")) {
        // Skip non-absolute URLs that aren't root-relative
        continue;
      }
      try {
        new URL(href); // Validate URL
        links.add(normalizeUrl(href));
      } catch {
        // Skip invalid URLs
      }
    }
  } catch {
    // If parsing fails, return empty set
  }
  return Array.from(links);
}

/**
 * Crawl a website recursively
 */
async function crawlWebsite(initialUrl: string): Promise<CrawlPage[]> {
  const normalizedUrl = normalizeUrl(initialUrl);
  const domain = extractDomain(normalizedUrl);

  if (!domain) {
    throw new Error("Invalid URL provided");
  }

  const state: CrawlState = {
    visited: new Set(),
    queue: [{ url: normalizedUrl, depth: 0 }],
    pages: [],
    robotsDisallowed: await parseRobotsTxt(domain),
    domain,
  };

  while (state.queue.length > 0 && state.pages.length < MAX_PAGES) {
    const { url, depth } = state.queue.shift()!;

    // Skip if already visited
    if (state.visited.has(url)) {
      continue;
    }

    // Skip if max depth reached
    if (depth > MAX_DEPTH) {
      continue;
    }

    // Skip if max pages reached
    if (state.pages.length >= MAX_PAGES) {
      break;
    }

    state.visited.add(url);

    // Check robots.txt
    const path = new URL(url).pathname;
    if (isPathDisallowed(path, state.robotsDisallowed)) {
      continue;
    }

    // Fetch page
    const pageContent = await fetchPageWithJina(url);
    if (!pageContent) {
      continue;
    }

    state.pages.push({
      url,
      html: pageContent.html,
      title: pageContent.title,
      description: pageContent.description,
      depth,
      fetchedAt: Date.now(),
    });

    // Extract and queue links if not at max depth
    if (depth < MAX_DEPTH) {
      const links = extractLinks(pageContent.html, url);
      for (const link of links) {
        if (
          isSameDomain(link, domain) &&
          !state.visited.has(link) &&
          state.pages.length < MAX_PAGES
        ) {
          state.queue.push({ url: link, depth: depth + 1 });
        }
      }
    }
  }

  return state.pages;
}

/**
 * Start a product scan
 */
export const startProductScan = mutation({
  args: { userId: v.id("users"), url: v.string() },
  handler: async (ctx, { userId, url }) => {
    // Create scan record
    const scanId = await ctx.db.insert("productScans", {
      userId,
      url,
      status: "in_progress",
      scannedPages: 0,
      rawHtmlPages: [],
      startedAt: Date.now(),
    });

    try {
      // Perform crawl
      const pages = await crawlWebsite(url);

      // Update scan record
      await ctx.db.patch(scanId, {
        status: "completed",
        scannedPages: pages.length,
        rawHtmlPages: pages,
        completedAt: Date.now(),
      });

      return { scanId, pagesScanned: pages.length };
    } catch (error) {
      // Update scan with error
      await ctx.db.patch(scanId, {
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: Date.now(),
      });
      throw error;
    }
  },
});

/**
 * Get scan results
 */
export const getScan = query({
  args: { scanId: v.id("productScans") },
  handler: async (ctx, { scanId }) => {
    return await ctx.db.get(scanId);
  },
});

/**
 * Get user's scans
 */
export const getUserScans = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("productScans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/**
 * Delete scan
 */
export const deleteScan = mutation({
  args: { scanId: v.id("productScans") },
  handler: async (ctx, { scanId }) => {
    await ctx.db.delete(scanId);
  },
});
