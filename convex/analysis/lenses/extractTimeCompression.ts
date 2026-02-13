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

export const TIME_COMPRESSION_SYSTEM_PROMPT = `You are a product analyst identifying value moments through the Time Compression lens.

Core question: "What specific user actions became instant or near-instant inside this product?"

Focus on what users physically DO in the product. Describe the screen they are on, the button they click, or the action they take that used to be slow and is now fast enough to change how often they do it.

For each value moment candidate, identify:
- name: Short descriptive name for the value moment
- description: 1-2 sentences explaining what a user DOES in the product and how the speed change alters their behavior
- role: Which user role benefits most
- confidence: "high", "medium", or "low"
- source_urls: URLs from the crawled pages that informed this candidate
- time_compression: Description of the specific action and time change (e.g., "User clicks 'Auto-assign' on the sprint board and the entire sprint is populated in seconds instead of a 2-hour planning meeting")

Every candidate must reference a specific screen, UI element, or user action visible in the product.

BANNED WORDS — do not use these marketing terms: automate, streamline, optimize, leverage, enhance, empower. If you catch yourself writing one of these, replace it with a concrete verb describing what the user does.

Anti-patterns (REJECT these):
- Marketing fluff: "streamlines workflows" or "optimizes processes" — says nothing about what a user does
- Abstract velocity: "moves faster" — faster at what, on which screen?
- Feature names as value: "quick search" names a feature, not a behavioral shift
- Minor speed bumps: "saves a click" is trivial, not behavior-changing

GOOD vs BAD examples:

BAD: "Automates sprint planning to streamline team velocity"
GOOD: "User opens the Sprint Board, clicks 'Auto-plan sprint', and the backlog is prioritized and assigned in 10 seconds — teams now plan sprints weekly instead of biweekly because it takes seconds instead of a 2-hour meeting"

BAD: "Enhances bug triage efficiency"
GOOD: "Engineer opens the Triage Inbox, sees each bug pre-classified by severity and auto-linked to the relevant code commit — triage drops from 30 minutes to 2 minutes per bug, so engineers triage same-day instead of batching weekly"

BAD: "Leverages AI to optimize report generation"
GOOD: "Manager clicks 'Generate Report' on the Dashboard, and a formatted progress report appears in 5 seconds — managers now share daily updates instead of spending Friday afternoons compiling weekly reports"

Return a JSON array of 8-20 candidates:
[
  {
    "name": "...",
    "description": "...",
    "role": "...",
    "confidence": "high|medium|low",
    "source_urls": ["..."],
    "time_compression": "description of specific user action and time change"
  }
]

Rules:
- Return ONLY valid JSON array, no commentary
- Each candidate MUST have time_compression as a non-empty string
- Every candidate must name a specific screen, button, page, or user action — no abstract outcomes
- confidence should be "high" if supported by case studies or detailed docs, "medium" if from feature descriptions, "low" if inferred from marketing
- source_urls must reference actual URLs from the provided pages`;

// --- Response parser ---

export function parseTimeCompressionResponse(responseText: string): LensCandidate[] {
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
    if (typeof item.time_compression !== "string" || !item.time_compression) {
      throw new Error(
        `Candidate ${i} missing required lens field: time_compression (must be non-empty string)`
      );
    }

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
      lens: "time_compression" as const,
      name: item.name,
      description: item.description,
      role: item.role,
      confidence,
      source_urls: item.source_urls.map(String),
      time_compression: item.time_compression,
    };
  });
}

// --- InternalAction ---

export const extractTimeCompression = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args): Promise<LensResult> => {
    const startTime = Date.now();

    const pages = await ctx.runQuery(internal.crawledPages.listByProductInternal, {
      productId: args.productId,
    });

    if (pages.length === 0) {
      throw new Error("No crawled pages found for product");
    }

    const relevantPages = filterPages(pages);
    if (relevantPages.length === 0) {
      throw new Error("No time-compression-relevant pages found");
    }

    const pageContext = buildPageContext(relevantPages);

    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });
    const profileContext = buildProfileContext(
      profile as Record<string, unknown> | null
    );

    const userMessage = profileContext
      ? `${profileContext}\n\nAnalyze these pages for time compression:\n\n${pageContext}`
      : `Analyze these pages for time compression:\n\n${pageContext}`;

    const responseText = await callClaude({
      system: TIME_COMPRESSION_SYSTEM_PROMPT,
      user: userMessage,
    });

    const candidates = parseTimeCompressionResponse(responseText);

    return {
      lens: "time_compression",
      candidates,
      candidate_count: candidates.length,
      execution_time_ms: Date.now() - startTime,
    };
  },
});
