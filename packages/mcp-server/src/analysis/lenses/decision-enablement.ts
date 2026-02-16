// Decision Enablement lens extractor (Batch 2).

import type { CrawledPage, LlmProvider, ProductContext } from "../types.js";
import type { LensResult } from "./lens-types.js";
import type { Batch1Context } from "./lens-types.js";
import { filterPages, buildPageContext, buildProductContextString, parseLensResponse } from "./shared.js";

// --- Page filtering ---

const PAGE_TYPES = ["features", "solutions", "customers", "homepage"];

const PAGE_PRIORITY: Record<string, number> = {
  features: 0,
  solutions: 1,
  customers: 2,
  homepage: 3,
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

export const DECISION_ENABLEMENT_SYSTEM_PROMPT = `You are a product analyst identifying value moments through the Decision Enablement lens.

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

// --- Extractor ---

export async function extractDecisionEnablement(
  pages: CrawledPage[],
  llm: LlmProvider,
  batch1Context?: Batch1Context,
  productContext?: ProductContext,
): Promise<LensResult> {
  const startTime = Date.now();

  const filtered = filterPages(pages, PAGE_TYPES, PAGE_PRIORITY);
  if (filtered.length === 0) {
    throw new Error("No decision-enablement-relevant pages found");
  }

  const pageContext = buildPageContext(filtered);
  const profileCtx = buildProductContextString(productContext);
  const b1Ctx = buildBatch1Context(batch1Context);

  let userMessage = "";
  if (profileCtx) userMessage += profileCtx + "\n\n";
  if (b1Ctx) userMessage += b1Ctx + "\n\n";
  userMessage += `Analyze these pages for decisions the product enables:\n\n${pageContext}`;

  const responseText = await llm.complete(
    [
      { role: "system", content: DECISION_ENABLEMENT_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { temperature: 0.2 },
  );

  const candidates = parseLensResponse(responseText, "decision_enablement", "decision_enabled");

  return {
    lens: "decision_enablement",
    candidates,
    candidate_count: candidates.length,
    execution_time_ms: Date.now() - startTime,
  };
}
