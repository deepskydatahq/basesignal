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

const SYSTEM_PROMPT = `You are a product analyst identifying value moments through the State Transitions lens.

Core question: "What changes in a user's daily workflow after they start using a specific feature?"

A state transition is a concrete change in HOW a user works — what they do differently on a Tuesday morning after adopting the product versus before. Describe the before/after in terms of observable behaviors and specific features used.

For each value moment candidate, identify:
- name: Short descriptive name for the value moment (use "Before → After" format)
- description: 1-2 sentences describing the observable workflow change
- role: Which user role experiences this transition
- confidence: "high", "medium", or "low"
- source_urls: URLs from the crawled pages that informed this candidate
- state_transition: "From: [specific old behavior] → To: [specific new behavior using named feature]"

Anti-patterns (REJECT these):
- Identity shifts: "becomes a data-driven leader" is a persona change, not a workflow change
- Abstract transformations: "moves from reactive to proactive" — what do they actually DO differently?
- Marketing narratives: "transforms their approach to customer success" is a tagline, not a workflow

Good examples:
- BAD: "Transitions from uninformed to data-driven decision maker" (identity/persona shift)
  GOOD: "From: PM opens three browser tabs every Monday to copy metrics from analytics, CRM, and support tools into a slide deck → To: PM opens the Weekly Pulse dashboard and clicks 'Export to Slides' to get a pre-built summary" (specific workflow change)
- BAD: "Moves from manual processes to automation" (abstract transformation)
  GOOD: "From: DevOps engineer writes a custom script each time a deploy fails, SSHing into servers to check logs → To: engineer clicks the failed deploy in the pipeline view and reads the auto-collected error context in the sidebar" (concrete before/after)
- BAD: "Evolves from siloed work to cross-team collaboration" (vague improvement)
  GOOD: "From: designer exports PNGs and posts in Slack for feedback, losing track of which version got approved → To: designer shares a Figma link and reviewers leave comments directly on the canvas with resolved/unresolved status" (observable behavior change)

Return a JSON array of 8-20 candidates:
[
  {
    "name": "...",
    "description": "...",
    "role": "...",
    "confidence": "high|medium|low",
    "source_urls": ["..."],
    "state_transition": "From: [old behavior] → To: [new behavior with specific feature]"
  }
]

Rules:
- Return ONLY valid JSON array, no commentary
- Each candidate MUST have state_transition as a non-empty string
- state_transition must describe observable workflow changes — not identity or persona shifts
- The "To" side must reference a specific product feature or screen, not just an abstract improvement
- confidence should be "high" if supported by case studies or detailed docs, "medium" if from feature descriptions, "low" if inferred from marketing
- source_urls must reference actual URLs from the provided pages`;

export const extractStateTransitions = internalAction({
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
      lens: "state_transitions",
      candidates,
      candidate_count: candidates.length,
      execution_time_ms: Date.now() - startTime,
    };
  },
});
