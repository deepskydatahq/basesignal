import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import type { LensCandidate, LensResult } from "./types";
import { callClaude, extractJson } from "./shared";

// --- Page filtering ---

const PAGE_TYPES = ["features", "customers", "homepage", "about", "help"];

const PAGE_PRIORITY: Record<string, number> = {
  features: 0,
  customers: 1,
  homepage: 2,
  about: 3,
  help: 4,
};

function filterPages(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>
) {
  return pages
    .filter((p) => PAGE_TYPES.includes(p.pageType))
    .sort(
      (a, b) =>
        (PAGE_PRIORITY[a.pageType] ?? 5) - (PAGE_PRIORITY[b.pageType] ?? 5)
    );
}

// --- Page context ---

const MAX_CONTENT_PER_PAGE = 15_000;
const MAX_TOTAL_CONTENT = 40_000;

function buildPageContext(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>
): string {
  let totalLength = 0;
  const sections: string[] = [];

  for (const page of pages) {
    const remaining = MAX_TOTAL_CONTENT - totalLength;
    if (remaining <= 0) break;

    const maxLen = Math.min(MAX_CONTENT_PER_PAGE, remaining);
    let content = page.content;
    if (content.length > maxLen) {
      const cut = content.lastIndexOf("\n", maxLen);
      content = content.slice(0, cut > 0 ? cut : maxLen) + "\n\n[Content truncated]";
    }

    sections.push(
      `--- PAGE: ${page.title || page.url} (${page.pageType}) ---\nURL: ${page.url}\n\n${content}`
    );
    totalLength += content.length;
  }

  return sections.join("\n\n");
}

// --- Profile context ---

function buildProfileContext(profile: Record<string, unknown> | null): string {
  if (!profile) return "";

  const parts: string[] = [];

  const identity = profile.identity as {
    productName?: string;
    description?: string;
    targetCustomer?: string;
  } | null;
  if (identity) {
    parts.push(`Product: ${identity.productName ?? "Unknown"}`);
    if (identity.description) parts.push(`Description: ${identity.description}`);
    if (identity.targetCustomer) parts.push(`Target: ${identity.targetCustomer}`);
  }

  const entities = profile.entities as {
    items?: Array<{ name: string; type: string }>;
  } | null;
  if (entities?.items?.length) {
    parts.push(
      `Key entities: ${entities.items.map((e) => `${e.name} (${e.type})`).join(", ")}`
    );
  }

  const journey = profile.journey as {
    stages?: Array<{ name: string; description: string }>;
  } | null;
  if (journey?.stages?.length) {
    parts.push(
      `User journey: ${journey.stages.map((s) => s.name).join(" → ")}`
    );
  }

  const outcomes = profile.outcomes as {
    items?: Array<{ description: string; type: string }>;
  } | null;
  if (outcomes?.items?.length) {
    parts.push(
      `Key outcomes: ${outcomes.items.map((o) => o.description).join("; ")}`
    );
  }

  return parts.join("\n");
}

// --- System prompt ---

export const CAPABILITY_MAPPING_SYSTEM_PROMPT = `You are a product analyst identifying value moments through the Capability Mapping lens.

Core question: "What new capacities does this product unlock for users?"

A capability is NOT a feature — it's a new ability the user gains. The user should be able to say "Now I can [capability]" in a way that makes sense without naming the product.

For each value moment candidate, identify:
- name: Short descriptive name for the value moment
- description: 1-2 sentences explaining the new capability gained
- role: Which user role benefits most
- confidence: "high", "medium", or "low"
- source_urls: URLs from the crawled pages that informed this candidate
- enabling_features: Array of product features that enable this capability

Anti-patterns (REJECT these):
- Feature lists: "create tasks" is a feature, not a capability
- Abstract improvements: "better organization" is too vague
- Tool-specific actions: "use the Kanban board" names the tool

Good examples:
- "Orchestrate cross-team dependencies without meetings" (capability, not feature)
- "See bottlenecks before they delay deadlines" (new ability gained)

Return a JSON array of 8-20 candidates:
[
  {
    "name": "...",
    "description": "...",
    "role": "...",
    "confidence": "high|medium|low",
    "source_urls": ["..."],
    "enabling_features": ["feature1", "feature2"]
  }
]

Rules:
- Return ONLY valid JSON array, no commentary
- Each candidate MUST have enabling_features as a non-empty string array
- confidence should be "high" if supported by case studies or detailed docs, "medium" if from feature descriptions, "low" if inferred from marketing
- source_urls must reference actual URLs from the provided pages`;

// --- Response parser ---

export function parseCapabilityMappingResponse(responseText: string): LensCandidate[] {
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
    if (
      !Array.isArray(item.enabling_features) ||
      item.enabling_features.length === 0 ||
      !item.enabling_features.every((f: unknown) => typeof f === "string" && f)
    ) {
      throw new Error(
        `Candidate ${i} missing required lens field: enabling_features (must be non-empty string array)`
      );
    }

    // Normalize confidence
    const validConfidence = ["high", "medium", "low"] as const;
    let confidence: "high" | "medium" | "low" = "medium";
    if (
      typeof item.confidence === "string" &&
      validConfidence.includes(item.confidence as "high" | "medium" | "low")
    ) {
      confidence = item.confidence as "high" | "medium" | "low";
    }

    return {
      id: crypto.randomUUID(),
      lens: "capability_mapping" as const,
      name: item.name,
      description: item.description,
      role: item.role,
      confidence,
      source_urls: item.source_urls.map(String),
      enabling_features: item.enabling_features.map(String),
    };
  });
}

// --- InternalAction ---

export const extractCapabilityMapping = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args): Promise<LensResult> => {
    const startTime = Date.now();

    // 1. Fetch crawled pages
    const pages = await ctx.runQuery(internal.crawledPages.listByProductInternal, {
      productId: args.productId,
    });

    if (pages.length === 0) {
      throw new Error("No crawled pages found for product");
    }

    // 2. Filter to relevant pages
    const relevantPages = filterPages(pages);
    if (relevantPages.length === 0) {
      throw new Error("No capability-relevant pages found");
    }

    // 3. Build page context
    const pageContext = buildPageContext(relevantPages);

    // 4. Get profile for product context
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });
    const profileContext = buildProfileContext(
      profile as Record<string, unknown> | null
    );

    // 5. Call Claude
    const userMessage = profileContext
      ? `${profileContext}\n\nAnalyze these pages for capability mapping:\n\n${pageContext}`
      : `Analyze these pages for capability mapping:\n\n${pageContext}`;

    const responseText = await callClaude({
      system: CAPABILITY_MAPPING_SYSTEM_PROMPT,
      user: userMessage,
    });

    // 6. Parse response
    const candidates = parseCapabilityMappingResponse(responseText);

    return {
      lens: "capability_mapping",
      candidates,
      candidate_count: candidates.length,
      execution_time_ms: Date.now() - startTime,
    };
  },
});
