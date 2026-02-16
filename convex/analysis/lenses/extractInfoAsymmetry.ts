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

const SYSTEM_PROMPT = `You are a product analyst identifying value moments through the Information Asymmetry lens.

Core question: "What does a user SEE on a screen that they couldn't see before?"

An information asymmetry is something a user can now SEE — a dashboard, a notification, a chart, a status indicator — that was previously invisible to them. Describe the actual screen, view, or UI element where this information appears.

For each value moment candidate, identify:
- name: Short descriptive name for the value moment
- description: 1-2 sentences describing what the user sees on screen and why it matters
- role: Which user role benefits most
- confidence: "high", "medium", or "low"
- source_urls: URLs from the crawled pages that informed this candidate
- information_gained: What specifically appears on screen that was previously invisible

Anti-patterns (REJECT these):
- Abstract knowledge: "gains insight into performance" — what do they literally see?
- Marketing language: "unlocks visibility" or "empowers with data" is a tagline, not an experience
- Business outcomes: "reduces churn" describes a metric, not something a user sees on screen

Good examples:
- BAD: "Gains visibility into pipeline health" (abstract, marketing-speak)
  GOOD: "Sales dashboard shows a red/yellow/green risk score next to each deal, calculated from buyer email response times" (concrete screen element)
- BAD: "Understands team performance better" (vague improvement)
  GOOD: "Manager sees a heatmap on the team page showing each engineer's PR review turnaround by day of week" (specific UI element)
- BAD: "Gets real-time data about customer engagement" (generic data claim)
  GOOD: "Account page displays a timeline of every customer touchpoint — support tickets, feature usage spikes, billing changes — in chronological order" (tangible view)

Return a JSON array of 8-20 candidates:
[
  {
    "name": "...",
    "description": "...",
    "role": "...",
    "confidence": "high|medium|low",
    "source_urls": ["..."],
    "information_gained": "what the user sees on screen that was previously invisible"
  }
]

Rules:
- Return ONLY valid JSON array, no commentary
- Each candidate MUST have information_gained as a non-empty string
- information_gained must describe something visible on a screen/dashboard/notification — not an abstract "insight"
- confidence should be "high" if supported by case studies or detailed docs, "medium" if from feature descriptions, "low" if inferred from marketing
- source_urls must reference actual URLs from the provided pages`;

export const extractInfoAsymmetry = internalAction({
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
      lens: "info_asymmetry",
      candidates,
      candidate_count: candidates.length,
      execution_time_ms: Date.now() - startTime,
    };
  },
});
