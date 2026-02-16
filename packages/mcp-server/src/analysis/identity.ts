// Identity extraction from crawled pages.

import type { CrawledPage, LlmProvider, IdentityResult } from "./types.js";
import { buildPageContext } from "./lenses/shared.js";

// --- Page filtering ---

const IDENTITY_PAGE_TYPES = ["homepage", "about", "features"];

/**
 * Filter crawled pages to those relevant for identity extraction.
 */
export function filterIdentityPages(
  pages: CrawledPage[],
): CrawledPage[] {
  return pages.filter((p) => IDENTITY_PAGE_TYPES.includes(p.pageType));
}

// --- Response parser ---

/**
 * Parse LLM response text to extract the JSON identity object.
 * Handles responses with markdown code fences or raw JSON.
 */
export function parseIdentityResponse(responseText: string): IdentityResult {
  const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();

  const parsed = JSON.parse(jsonStr);

  // Validate required fields
  const required = ["productName", "description", "targetCustomer", "businessModel", "confidence", "evidence"];
  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Clamp confidence to [0, 1]
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

  // Strip evidence to only url and excerpt
  if (Array.isArray(parsed.evidence)) {
    parsed.evidence = parsed.evidence.map((e: { url: string; excerpt: string }) => ({
      url: String(e.url || ""),
      excerpt: String(e.excerpt || ""),
    }));
  }

  return parsed as IdentityResult;
}

// --- System prompt ---

const SYSTEM_PROMPT = `You are a product analyst. Extract the core identity of a SaaS/software product from its website content.

Return a single JSON object with these fields:

{
  "productName": "The product name",
  "description": "One-paragraph description of what the product does",
  "targetCustomer": "Who the product is built for (role, company size, industry)",
  "businessModel": "How the product makes money (e.g., B2B SaaS, B2C freemium, usage-based)",
  "industry": "The industry or vertical (optional, omit if unclear)",
  "companyStage": "Startup, growth, enterprise, etc. (optional, omit if unclear)",
  "confidence": 0.0 to 1.0,
  "evidence": [{"url": "page URL", "excerpt": "relevant quote from the page"}]
}

Rules:
- Return ONLY valid JSON, no commentary before or after
- confidence: 0.9+ if homepage clearly states what the product does, 0.5-0.8 if inferred, <0.5 if very uncertain
- evidence: include 1-3 short excerpts that support your extraction, with the source URL
- description should be factual, not marketing copy
- targetCustomer should be specific (not just "businesses")
- businessModel should reflect the actual pricing/business approach`;

// --- Extractor ---

export async function extractIdentity(
  pages: CrawledPage[],
  llm: LlmProvider,
): Promise<IdentityResult> {
  const identityPages = filterIdentityPages(pages);
  if (identityPages.length === 0) {
    throw new Error("No homepage, about, or features pages found");
  }

  const pageContext = buildPageContext(identityPages);

  const responseText = await llm.complete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Extract the core identity from these website pages:\n\n${pageContext}` },
    ],
    { model: "haiku", maxTokens: 1024 },
  );

  return parseIdentityResponse(responseText);
}
