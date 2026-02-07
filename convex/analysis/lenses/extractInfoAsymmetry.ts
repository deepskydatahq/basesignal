import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { buildPageContext, callClaude, parseLensResponse } from "./shared";
import type { LensResult } from "./types";

export const PAGE_TYPES = ["features", "customers", "help", "homepage", "solutions"];

const PAGE_PRIORITY: Record<string, number> = {
  features: 0,
  customers: 1,
  help: 2,
  homepage: 3,
  solutions: 4,
};

export function filterInfoAsymmetryPages(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>,
): Array<{ pageType: string; content: string; url: string; title?: string }> {
  return pages
    .filter((p) => PAGE_TYPES.includes(p.pageType))
    .sort(
      (a, b) =>
        (PAGE_PRIORITY[a.pageType] ?? 5) - (PAGE_PRIORITY[b.pageType] ?? 5),
    );
}

export function buildKnowledgeContext(
  profile: Record<string, unknown> | null,
): string {
  if (!profile) return "";

  const parts: string[] = [];

  const identity = profile.identity as {
    productName?: string;
    description?: string;
    targetCustomer?: string;
  } | null;
  if (identity) {
    parts.push(`Product: ${identity.productName || "Unknown"}`);
    if (identity.description) parts.push(`Description: ${identity.description}`);
    if (identity.targetCustomer) parts.push(`Target customer: ${identity.targetCustomer}`);
  }

  const entities = profile.entities as {
    items?: Array<{ name: string; type: string }>;
  } | null;
  if (entities?.items?.length) {
    parts.push(`Key entities: ${entities.items.map((e) => `${e.name} (${e.type})`).join(", ")}`);
  }

  const revenue = profile.revenue as {
    model?: string;
    hasFreeTier?: boolean;
    tiers?: Array<{ name: string }>;
  } | null;
  if (revenue) {
    parts.push(`Revenue model: ${revenue.model || "Unknown"}`);
    if (revenue.hasFreeTier !== undefined) parts.push(`Free tier: ${revenue.hasFreeTier ? "Yes" : "No"}`);
    if (revenue.tiers?.length) parts.push(`Tiers: ${revenue.tiers.map((t) => t.name).join(", ")}`);
  }

  return parts.length > 0 ? parts.join("\n") : "";
}

export function buildBatch1Context(
  batch1Results: Record<string, unknown> | undefined,
): string {
  if (!batch1Results) return "";

  const parts: string[] = [];
  for (const [lensType, result] of Object.entries(batch1Results)) {
    const r = result as { candidates?: Array<{ name: string; description: string }> };
    if (r?.candidates?.length) {
      parts.push(`\n### ${lensType} findings:`);
      for (const c of r.candidates.slice(0, 5)) {
        parts.push(`- ${c.name}: ${c.description}`);
      }
    }
  }

  return parts.length > 0
    ? "## Batch 1 Analysis Context\n" + parts.join("\n")
    : "";
}

const SYSTEM_PROMPT = `You are a product analyst identifying information asymmetries that a product resolves.

An information asymmetry is a gap where users lack knowledge that the product uniquely provides. Before using the product, they couldn't know this. After using it, they can.

For each candidate, identify:
- What specific information the user gains
- What role/persona benefits most
- How confident you are based on the evidence

Return a JSON array of candidates:

[
  {
    "name": "Pipeline Health Visibility",
    "description": "Sales managers can see which deals are at risk before they stall, based on engagement patterns",
    "role": "Sales Manager",
    "information_gained": "Real-time deal risk signals based on buyer engagement patterns that were previously invisible",
    "confidence": "high",
    "source_urls": ["https://example.com/features"]
  }
]

Confidence levels:
- "high": Direct evidence from help docs, case studies, or feature descriptions
- "medium": Inferred from feature descriptions or marketing copy
- "low": Speculative based on product category

Rules:
- Return ONLY valid JSON array, no commentary
- 8-20 candidates per product
- Each candidate must have: name, description, role, information_gained, confidence, source_urls
- information_gained must describe the specific knowledge gap filled
- Be product-specific, not generic (no "saves time" or "improves efficiency")
- source_urls must reference actual crawled page URLs`;

export const extractInfoAsymmetry = internalAction({
  args: {
    productId: v.id("products"),
    batch1Results: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<LensResult> => {
    const pages = await ctx.runQuery(
      internal.crawledPages.listByProductInternal,
      { productId: args.productId },
    );

    if (pages.length === 0) {
      throw new Error("No crawled pages found for product");
    }

    const filtered = filterInfoAsymmetryPages(pages);
    if (filtered.length === 0) {
      throw new Error("No info-asymmetry-relevant pages found");
    }

    const pageContext = buildPageContext(filtered);

    const profile = await ctx.runQuery(
      internal.productProfiles.getInternal,
      { productId: args.productId },
    );

    const knowledgeContext = buildKnowledgeContext(
      profile as Record<string, unknown> | null,
    );
    const batch1Context = buildBatch1Context(args.batch1Results);

    let userMessage = "";
    if (knowledgeContext) userMessage += knowledgeContext + "\n\n";
    if (batch1Context) userMessage += batch1Context + "\n\n";
    userMessage += `Analyze these pages for information asymmetries:\n\n${pageContext}`;

    const responseText = await callClaude({
      system: SYSTEM_PROMPT,
      user: userMessage,
    });

    const candidates = parseLensResponse(
      responseText,
      "info_asymmetry",
      "information_gained",
    );

    return {
      lensType: "info_asymmetry",
      candidates,
      overallConfidence:
        candidates.length > 0
          ? candidates.filter((c) => c.confidence === "high").length /
            candidates.length
          : 0,
    };
  },
});
