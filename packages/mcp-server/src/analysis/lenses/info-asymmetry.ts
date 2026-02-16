// Information Asymmetry lens extractor (Batch 2).

import type { CrawledPage, LlmProvider, ProductContext } from "../types.js";
import type { LensResult } from "./lens-types.js";
import type { Batch1Context } from "./lens-types.js";
import { filterPages, buildPageContext, buildProductContextString, parseLensResponse } from "./shared.js";

// --- Page filtering ---

const PAGE_TYPES = ["features", "customers", "help", "homepage", "solutions"];

const PAGE_PRIORITY: Record<string, number> = {
  features: 0,
  customers: 1,
  help: 2,
  homepage: 3,
  solutions: 4,
};

// --- Batch 1 context builder ---

export function buildBatch1Context(
  batch1Results: Batch1Context | undefined,
): string {
  if (!batch1Results) return "";

  const parts: string[] = [];
  for (const [lensType, result] of Object.entries(batch1Results)) {
    if (result?.candidates?.length) {
      parts.push(`\n### ${lensType} findings:`);
      for (const c of result.candidates.slice(0, 5)) {
        parts.push(`- ${c.name}: ${c.description}`);
      }
    }
  }

  return parts.length > 0
    ? "## Batch 1 Analysis Context\n" + parts.join("\n")
    : "";
}

// --- System prompt ---

export const INFO_ASYMMETRY_SYSTEM_PROMPT = `You are a product analyst identifying value moments through the Information Asymmetry lens.

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

// --- Extractor ---

export async function extractInfoAsymmetry(
  pages: CrawledPage[],
  llm: LlmProvider,
  batch1Context?: Batch1Context,
  productContext?: ProductContext,
): Promise<LensResult> {
  const startTime = Date.now();

  const filtered = filterPages(pages, PAGE_TYPES, PAGE_PRIORITY);
  if (filtered.length === 0) {
    throw new Error("No info-asymmetry-relevant pages found");
  }

  const pageContext = buildPageContext(filtered);
  const profileCtx = buildProductContextString(productContext);
  const b1Ctx = buildBatch1Context(batch1Context);

  let userMessage = "";
  if (profileCtx) userMessage += profileCtx + "\n\n";
  if (b1Ctx) userMessage += b1Ctx + "\n\n";
  userMessage += `Analyze these pages for information asymmetries:\n\n${pageContext}`;

  const responseText = await llm.complete(
    [
      { role: "system", content: INFO_ASYMMETRY_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { temperature: 0.2 },
  );

  const candidates = parseLensResponse(responseText, "info_asymmetry", "information_gained");

  return {
    lens: "info_asymmetry",
    candidates,
    candidate_count: candidates.length,
    execution_time_ms: Date.now() - startTime,
  };
}
