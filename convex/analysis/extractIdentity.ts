import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

// Page types relevant for identity extraction
const IDENTITY_PAGE_TYPES = ["homepage", "about", "features"];

// Maximum characters of page content to send to Claude
const MAX_CONTENT_PER_PAGE = 15_000;
const MAX_TOTAL_CONTENT = 40_000;

/**
 * Filter crawled pages to those relevant for identity extraction.
 * Returns pages of type homepage, about, or features.
 */
export function filterIdentityPages(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>
): Array<{ pageType: string; content: string; url: string; title?: string }> {
  return pages.filter((p) => IDENTITY_PAGE_TYPES.includes(p.pageType));
}

/**
 * Truncate content to a maximum character length, preserving whole lines.
 * Appends a truncation notice if content was shortened.
 */
export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;

  // Find the last newline before the limit
  const lastNewline = content.lastIndexOf("\n", maxLength);
  const cutPoint = lastNewline > 0 ? lastNewline : maxLength;
  return content.slice(0, cutPoint) + "\n\n[Content truncated]";
}

/**
 * Build the context string from crawled pages for the LLM prompt.
 * Each page is formatted with its URL, type, and truncated content.
 */
export function buildPageContext(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>
): string {
  let totalLength = 0;
  const sections: string[] = [];

  for (const page of pages) {
    const remaining = MAX_TOTAL_CONTENT - totalLength;
    if (remaining <= 0) break;

    const pageMaxLength = Math.min(MAX_CONTENT_PER_PAGE, remaining);
    const truncated = truncateContent(page.content, pageMaxLength);

    const header = `--- PAGE: ${page.title || page.url} (${page.pageType}) ---\nURL: ${page.url}`;
    sections.push(`${header}\n\n${truncated}`);
    totalLength += truncated.length;
  }

  return sections.join("\n\n");
}

/**
 * The expected JSON structure from Claude's extraction response.
 */
interface IdentityExtraction {
  productName: string;
  description: string;
  targetCustomer: string;
  businessModel: string;
  industry?: string;
  companyStage?: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

/**
 * Parse Claude's response text to extract the JSON identity object.
 * Handles responses with markdown code fences or raw JSON.
 */
export function parseIdentityResponse(responseText: string): IdentityExtraction {
  // Try to extract JSON from code fences first
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

  return parsed as IdentityExtraction;
}

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

/**
 * Extract core identity from crawled pages using Claude Haiku.
 *
 * Flow:
 * 1. Fetch crawled pages for the product
 * 2. Filter to homepage/about/features pages
 * 3. Build prompt with page content
 * 4. Call Claude Haiku for structured extraction
 * 5. Parse response and store on product profile
 */
export const extractIdentity = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // 1. Fetch crawled pages
    const pages = await ctx.runQuery(internal.crawledPages.listByProductInternal, {
      productId: args.productId,
    });

    if (pages.length === 0) {
      throw new Error("No crawled pages found for product");
    }

    // 2. Filter to identity-relevant pages
    const identityPages = filterIdentityPages(pages);

    if (identityPages.length === 0) {
      throw new Error("No homepage, about, or features pages found");
    }

    // 3. Build prompt context
    const pageContext = buildPageContext(identityPages);

    // 4. Call Claude Haiku
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Extract the core identity from these website pages:\n\n${pageContext}`,
        },
      ],
    });

    // 5. Parse response
    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const identity = parseIdentityResponse(textContent);

    // 6. Ensure product profile exists
    await ctx.runMutation(internal.productProfiles.createInternal, {
      productId: args.productId,
    });

    // 7. Store identity on profile
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "identity",
      data: identity,
    });

    return identity;
  },
});
