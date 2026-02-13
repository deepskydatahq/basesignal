import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { buildPageContext, callClaude, parseLensResponse } from "./shared";
import type { LensResult } from "./types";

export const PAGE_TYPES = ["features", "solutions", "customers", "homepage"];

const PAGE_PRIORITY: Record<string, number> = {
  features: 0,
  solutions: 1,
  customers: 2,
  homepage: 3,
};

export function filterDecisionEnablementPages(
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

const SYSTEM_PROMPT = `You are a product analyst identifying value moments through the Decision Enablement lens.

Core question: "What specific choice does a user make INSIDE the product?"

A decision enablement is a concrete choice a user makes while using the product — clicking a button, selecting an option, configuring a setting, approving/rejecting something. The decision happens IN the product, not as a downstream business outcome.

For each value moment candidate, identify:
- name: Short descriptive name for the value moment
- description: 1-2 sentences describing the in-product choice and what it affects
- role: Which user role benefits most
- confidence: "high", "medium", or "low"
- source_urls: URLs from the crawled pages that informed this candidate
- decision_enabled: The specific in-product choice the user makes

Anti-patterns (REJECT these):
- Business decisions: "decide whether to expand into new markets" happens outside the product
- Strategic outcomes: "make better hiring decisions" is too abstract and downstream
- Marketing language: "empowers teams to choose wisely" is a tagline, not an in-product action

Good examples:
- BAD: "Enables better resource allocation decisions" (abstract business outcome)
  GOOD: "Manager clicks 'reassign' on overloaded team members in the workload view, moving tasks to engineers with capacity shown in green" (in-product action)
- BAD: "Helps decide which features to build next" (strategic, outside the product)
  GOOD: "PM drags feature cards into 'Next Sprint' column based on the impact/effort scores displayed on each card" (concrete in-product choice)
- BAD: "Improves decision-making around customer retention" (vague improvement)
  GOOD: "Success manager selects 'at-risk' accounts from a filtered list and assigns them to a re-engagement workflow with one click" (specific product interaction)

Return a JSON array of 8-20 candidates:
[
  {
    "name": "...",
    "description": "...",
    "role": "...",
    "confidence": "high|medium|low",
    "source_urls": ["..."],
    "decision_enabled": "the specific in-product choice the user makes"
  }
]

Rules:
- Return ONLY valid JSON array, no commentary
- Each candidate MUST have decision_enabled as a non-empty string
- decision_enabled must describe a choice made INSIDE the product — not a downstream business decision
- confidence should be "high" if supported by case studies or detailed docs, "medium" if from feature descriptions, "low" if inferred from marketing
- source_urls must reference actual URLs from the provided pages`;

export const extractDecisionEnablement = internalAction({
  args: {
    productId: v.id("products"),
    batch1Results: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<LensResult> => {
    const startTime = Date.now();
    const pages = await ctx.runQuery(
      internal.crawledPages.listByProductInternal,
      { productId: args.productId },
    );

    if (pages.length === 0) {
      throw new Error("No crawled pages found for product");
    }

    const filtered = filterDecisionEnablementPages(pages);
    if (filtered.length === 0) {
      throw new Error("No decision-enablement-relevant pages found");
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
    userMessage += `Analyze these pages for decisions the product enables:\n\n${pageContext}`;

    const responseText = await callClaude({
      system: SYSTEM_PROMPT,
      user: userMessage,
    });

    const candidates = parseLensResponse(
      responseText,
      "decision_enablement",
      "decision_enabled",
    );

    return {
      lens: "decision_enablement",
      candidates,
      candidate_count: candidates.length,
      execution_time_ms: Date.now() - startTime,
    };
  },
});
