import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Extract revenue architecture from crawled pricing/feature pages.
 *
 * Two-tier page selection:
 *   1. Prefer pricing pages
 *   2. Fallback to homepage + features pages if no pricing page found
 *
 * Uses Claude Haiku for structured extraction, stores result via
 * productProfiles.updateSectionInternal.
 */
export const extractRevenue = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // Step 1: Fetch all crawled pages for this product
    const pages = await ctx.runQuery(
      internal.crawledPages.listByProductInternal,
      { productId: args.productId }
    );

    if (pages.length === 0) {
      throw new Error("No crawled pages found for product");
    }

    // Step 2: Select pages using two-tier strategy
    const { selectedPages, confidence: pageConfidence } = selectPages(pages);

    if (selectedPages.length === 0) {
      throw new Error("No suitable pages found for revenue extraction");
    }

    // Step 3: Build context from selected pages
    const context = buildPageContext(selectedPages);

    // Step 4: Call Claude Haiku for extraction
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze the following website content and extract the revenue architecture.\n\n${context}`,
        },
      ],
    });

    // Step 5: Parse the structured response
    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const revenueData = parseExtractionResponse(textContent, selectedPages, pageConfidence);

    // Step 6: Store the result
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "revenue",
      data: revenueData,
    });

    return revenueData;
  },
});

interface CrawledPage {
  url: string;
  pageType: string;
  title?: string;
  content: string;
  contentLength: number;
}

interface SelectedPages {
  selectedPages: CrawledPage[];
  confidence: "high" | "medium" | "low";
}

/**
 * Two-tier page selection:
 * 1. If pricing pages exist, use them (high confidence)
 * 2. Otherwise, fall back to homepage + features pages (medium confidence)
 * 3. If nothing matches, use whatever is available (low confidence)
 */
export function selectPages(pages: CrawledPage[]): SelectedPages {
  const pricingPages = pages.filter((p) => p.pageType === "pricing");
  if (pricingPages.length > 0) {
    return { selectedPages: pricingPages, confidence: "high" };
  }

  const fallbackPages = pages.filter(
    (p) => p.pageType === "homepage" || p.pageType === "features"
  );
  if (fallbackPages.length > 0) {
    return { selectedPages: fallbackPages, confidence: "medium" };
  }

  // Last resort: use all available pages
  return { selectedPages: pages, confidence: "low" };
}

/**
 * Build a context string from selected pages, truncating each to avoid
 * exceeding token limits.
 */
export function buildPageContext(pages: CrawledPage[]): string {
  const MAX_CONTENT_PER_PAGE = 15_000;
  const sections: string[] = [];

  for (const page of pages) {
    const content = page.content.length > MAX_CONTENT_PER_PAGE
      ? page.content.slice(0, MAX_CONTENT_PER_PAGE) + "\n[...truncated]"
      : page.content;

    sections.push(
      `--- PAGE: ${page.url} (type: ${page.pageType}) ---\n${page.title ? `Title: ${page.title}\n` : ""}${content}`
    );
  }

  return sections.join("\n\n");
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert SaaS pricing analyst. Extract the revenue architecture from website content.

Respond ONLY with valid JSON matching this exact schema (no markdown, no explanation):

{
  "model": "<string: primary pricing model, e.g. 'subscription', 'usage-based', 'freemium', 'one-time', 'hybrid', 'marketplace'>",
  "billingUnit": "<string or null: what the customer pays per, e.g. 'seat', 'request', 'GB', 'project'>",
  "hasFreeTier": <boolean: whether a free plan exists>,
  "tiers": [
    {
      "name": "<string: tier name>",
      "price": "<string: price as displayed, e.g. '$29/month', 'Custom', 'Free'>",
      "features": ["<string: key differentiating features>"]
    }
  ],
  "expansionPaths": ["<string: ways customers scale up spending, e.g. 'add seats', 'upgrade tier', 'increase usage'>"],
  "contractionRisks": ["<string: reasons customers might downgrade or churn, e.g. 'seat reduction', 'downgrade to free', 'usage decrease'>"],
  "confidence": <number 0.0-1.0: how confident you are in this extraction>
}

CONFIDENCE GUIDANCE:
- 0.9-1.0: Explicit pricing page with clear tiers and prices
- 0.7-0.8: Pricing visible but some details unclear or inferred
- 0.5-0.6: Partial information, some aspects inferred from context
- 0.3-0.4: Mostly inferred, limited pricing information available
- 0.1-0.2: Very little pricing info, heavy inference

RULES:
- If no pricing information is found at all, still return your best inference with low confidence
- For "Custom" or "Contact Sales" pricing, include the tier with price "Custom"
- Include ALL visible tiers, including free tiers
- Expansion paths should reflect the actual pricing structure (e.g., if per-seat, then "add seats" is an expansion path)
- Contraction risks are the inverse of expansion paths plus general risks like churn`;

interface RevenueData {
  model: string;
  billingUnit?: string;
  hasFreeTier: boolean;
  tiers: Array<{ name: string; price: string; features: string[] }>;
  expansionPaths: string[];
  contractionRisks: string[];
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

/**
 * Parse Claude's JSON response into the revenue data structure.
 * Adjusts confidence based on page selection tier.
 */
export function parseExtractionResponse(
  text: string,
  selectedPages: CrawledPage[],
  pageConfidence: "high" | "medium" | "low"
): RevenueData {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from Claude response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate required fields
  if (typeof parsed.model !== "string") {
    throw new Error("Missing or invalid 'model' field in extraction response");
  }
  if (typeof parsed.hasFreeTier !== "boolean") {
    throw new Error("Missing or invalid 'hasFreeTier' field in extraction response");
  }
  if (typeof parsed.confidence !== "number") {
    throw new Error("Missing or invalid 'confidence' field in extraction response");
  }

  // Apply confidence penalty based on page selection tier
  const confidenceMultiplier =
    pageConfidence === "high" ? 1.0 :
    pageConfidence === "medium" ? 0.8 :
    0.6;

  const adjustedConfidence = Math.round(
    parsed.confidence * confidenceMultiplier * 100
  ) / 100;

  // Build evidence from the pages that were analyzed
  const evidence = selectedPages.map((page) => ({
    url: page.url,
    excerpt: page.title
      ? `Analyzed: ${page.title} (${page.pageType} page)`
      : `Analyzed: ${page.pageType} page`,
  }));

  return {
    model: parsed.model,
    billingUnit: parsed.billingUnit ?? undefined,
    hasFreeTier: parsed.hasFreeTier,
    tiers: Array.isArray(parsed.tiers)
      ? parsed.tiers.map((t: { name?: string; price?: string; features?: string[] }) => ({
          name: String(t.name ?? "Unknown"),
          price: String(t.price ?? "Unknown"),
          features: Array.isArray(t.features) ? t.features.map(String) : [],
        }))
      : [],
    expansionPaths: Array.isArray(parsed.expansionPaths)
      ? parsed.expansionPaths.map(String)
      : [],
    contractionRisks: Array.isArray(parsed.contractionRisks)
      ? parsed.contractionRisks.map(String)
      : [],
    confidence: adjustedConfidence,
    evidence,
  };
}
