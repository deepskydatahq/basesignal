import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { buildPageContext, callClaude, parseLensResponse } from "./shared";
import type { LensResult } from "./types";

export const PAGE_TYPES = ["customers", "features", "onboarding", "help", "homepage"];

const PAGE_PRIORITY: Record<string, number> = {
  customers: 0,
  features: 1,
  onboarding: 2,
  help: 3,
  homepage: 4,
};

export function filterStateTransitionPages(
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

  const journey = profile.journey as {
    stages?: Array<{ name: string; description: string; order: number }>;
  } | null;
  if (journey?.stages?.length) {
    const sorted = [...journey.stages].sort((a, b) => a.order - b.order);
    parts.push(`Journey stages: ${sorted.map((s) => s.name).join(" → ")}`);
  }

  const definitions = profile.definitions as {
    activation?: {
      levels?: Array<{ name: string; signalStrength: string }>;
    };
  } | null;
  if (definitions?.activation?.levels?.length) {
    parts.push(
      `Activation levels: ${definitions.activation.levels.map((l) => `${l.name} (${l.signalStrength})`).join(", ")}`,
    );
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

const SYSTEM_PROMPT = `You are a product analyst identifying user state transitions that a product facilitates.

A state transition is a meaningful change in the user's situation, capability, or status that happens through using the product. The user moves from one state to another.

For each candidate, identify:
- What specific state change occurs (from → to)
- What role/persona experiences this transition
- How confident you are based on the evidence

Return a JSON array of candidates:

[
  {
    "name": "Manual Tracker → Automated Reporter",
    "description": "Product managers transition from manually collecting status updates to having automated progress reports",
    "role": "Product Manager",
    "state_transition": "From: manually tracking project status across tools → To: automatically generated progress reports with real-time data",
    "confidence": "high",
    "source_urls": ["https://example.com/features/reporting"]
  }
]

Confidence levels:
- "high": Direct evidence from help docs, case studies, or feature descriptions
- "medium": Inferred from feature descriptions or marketing copy
- "low": Speculative based on product category

Rules:
- Return ONLY valid JSON array, no commentary
- 8-20 candidates per product
- Each candidate must have: name, description, role, state_transition, confidence, source_urls
- state_transition must describe the From → To state change
- Be product-specific, not generic (no "becomes more productive" or "works faster")
- source_urls must reference actual crawled page URLs`;

export const extractStateTransitions = internalAction({
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

    const filtered = filterStateTransitionPages(pages);
    if (filtered.length === 0) {
      throw new Error("No state-transition-relevant pages found");
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
    userMessage += `Analyze these pages for user state transitions:\n\n${pageContext}`;

    const responseText = await callClaude({
      system: SYSTEM_PROMPT,
      user: userMessage,
    });

    const candidates = parseLensResponse(
      responseText,
      "state_transitions",
      "state_transition",
    );

    return {
      lensType: "state_transitions",
      candidates,
      overallConfidence:
        candidates.length > 0
          ? candidates.filter((c) => c.confidence === "high").length /
            candidates.length
          : 0,
    };
  },
});
