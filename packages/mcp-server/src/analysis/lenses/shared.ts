// Shared lens utilities for page filtering, prompt building, and response parsing.
// These are pure functions with no external runtime dependencies.

import type { CrawledPage, ProductContext } from "../types.js";
import type { LensType, ConfidenceLevel, LensCandidate } from "./lens-types.js";
import { extractJson } from "@basesignal/core";

// Re-export extractJson for convenience
export { extractJson };

// --- Constants ---

export const MAX_CONTENT_PER_PAGE = 15_000;
export const MAX_TOTAL_CONTENT = 40_000;

// --- Content utilities ---

/**
 * Truncate content to a maximum character length, preserving whole lines.
 */
export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  const lastNewline = content.lastIndexOf("\n", maxLength);
  const cutPoint = lastNewline > 0 ? lastNewline : maxLength;
  return content.slice(0, cutPoint) + "\n\n[Content truncated]";
}

/**
 * Build formatted context string from crawled pages for the LLM prompt.
 */
export function buildPageContext(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>,
  maxPerPage: number = MAX_CONTENT_PER_PAGE,
  maxTotal: number = MAX_TOTAL_CONTENT,
): string {
  let totalLength = 0;
  const sections: string[] = [];

  for (const page of pages) {
    const remaining = maxTotal - totalLength;
    if (remaining <= 0) break;

    const pageMaxLength = Math.min(maxPerPage, remaining);
    const truncated = truncateContent(page.content, pageMaxLength);

    const header = `--- PAGE: ${page.title || page.url} (${page.pageType}) ---\nURL: ${page.url}`;
    sections.push(`${header}\n\n${truncated}`);
    totalLength += truncated.length;
  }

  return sections.join("\n\n");
}

// --- Page filtering ---

/**
 * Filter and sort pages by type and priority.
 */
export function filterPages(
  pages: CrawledPage[],
  allowedTypes: string[],
  priority: Record<string, number>,
): CrawledPage[] {
  return pages
    .filter((p) => allowedTypes.includes(p.pageType))
    .sort((a, b) => (priority[a.pageType] ?? 99) - (priority[b.pageType] ?? 99));
}

// --- Product context ---

/**
 * Build a product context string from a simplified ProductContext.
 */
export function buildProductContextString(ctx?: ProductContext): string {
  if (!ctx) return "";
  const parts: string[] = [];
  if (ctx.name) parts.push(`Product: ${ctx.name}`);
  if (ctx.description) parts.push(`Description: ${ctx.description}`);
  if (ctx.targetCustomer) parts.push(`Target: ${ctx.targetCustomer}`);
  return parts.join("\n");
}

// --- Confidence normalization ---

const VALID_CONFIDENCE_LEVELS: ConfidenceLevel[] = ["low", "medium", "high"];

export function normalizeConfidence(value: unknown): ConfidenceLevel {
  if (typeof value === "string" && VALID_CONFIDENCE_LEVELS.includes(value as ConfidenceLevel)) {
    return value as ConfidenceLevel;
  }
  if (typeof value === "number") {
    if (value >= 0.7) return "high";
    if (value >= 0.4) return "medium";
    return "low";
  }
  return "medium";
}

// --- Generic lens response parser ---

/**
 * Parse LLM response into validated LensCandidate array.
 * Validates shared fields and the lens-specific field.
 */
export function parseLensResponse(
  responseText: string,
  lensType: LensType,
  lensField: string,
): LensCandidate[] {
  const parsed = extractJson(responseText);

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array of candidates, got ${typeof parsed}`);
  }

  return parsed.map((item: Record<string, unknown>, i: number) => {
    if (typeof item.name !== "string" || !item.name) {
      throw new Error(`Candidate ${i} missing required field: name`);
    }
    if (typeof item.description !== "string" || !item.description) {
      throw new Error(`Candidate ${i} missing required field: description`);
    }
    if (typeof item.role !== "string" || !item.role) {
      throw new Error(`Candidate ${i} missing required field: role`);
    }
    if (!Array.isArray(item.source_urls)) {
      throw new Error(`Candidate ${i} missing required field: source_urls`);
    }
    if (item[lensField] === undefined || item[lensField] === null || item[lensField] === "") {
      throw new Error(`Candidate ${i} missing required lens field: ${lensField}`);
    }

    const candidate: LensCandidate = {
      id: crypto.randomUUID(),
      lens: lensType,
      name: item.name,
      description: item.description,
      role: item.role,
      confidence: normalizeConfidence(item.confidence),
      source_urls: item.source_urls.map(String),
    };

    candidate[lensField as keyof LensCandidate] = String(item[lensField]) as never;

    return candidate;
  });
}
