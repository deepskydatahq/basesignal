// State Transitions lens extractor (Batch 2).

import type { CrawledPage, LlmProvider, ProductContext } from "../types.js";
import type { LensResult } from "./lens-types.js";
import type { Batch1Context } from "./lens-types.js";
import { filterPages, buildPageContext, buildProductContextString, parseLensResponse } from "./shared.js";

// --- Page filtering ---

const PAGE_TYPES = ["customers", "features", "onboarding", "help", "homepage"];

const PAGE_PRIORITY: Record<string, number> = {
  customers: 0,
  features: 1,
  onboarding: 2,
  help: 3,
  homepage: 4,
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

export const STATE_TRANSITIONS_SYSTEM_PROMPT = `You are a product analyst identifying value moments through the State Transitions lens.

Core question: "What changes in a user's daily workflow after they start using a specific feature?"

A state transition is a concrete change in HOW a user works — what they do differently on a Tuesday morning after adopting the product versus before. Describe the before/after in terms of observable behaviors and specific features used.

For each value moment candidate, identify:
- name: Short descriptive name for the value moment (use "Before > After" format)
- description: 1-2 sentences describing the observable workflow change
- role: Which user role experiences this transition
- confidence: "high", "medium", or "low"
- source_urls: URLs from the crawled pages that informed this candidate
- state_transition: "From: [specific old behavior] > To: [specific new behavior using named feature]"

Anti-patterns (REJECT these):
- Identity shifts: "becomes a data-driven leader" is a persona change, not a workflow change
- Abstract transformations: "moves from reactive to proactive" — what do they actually DO differently?
- Marketing narratives: "transforms their approach to customer success" is a tagline, not a workflow

Good examples:
- BAD: "Transitions from uninformed to data-driven decision maker" (identity/persona shift)
  GOOD: "From: PM opens three browser tabs every Monday to copy metrics from analytics, CRM, and support tools into a slide deck > To: PM opens the Weekly Pulse dashboard and clicks 'Export to Slides' to get a pre-built summary" (specific workflow change)
- BAD: "Moves from manual processes to automation" (abstract transformation)
  GOOD: "From: DevOps engineer writes a custom script each time a deploy fails, SSHing into servers to check logs > To: engineer clicks the failed deploy in the pipeline view and reads the auto-collected error context in the sidebar" (concrete before/after)
- BAD: "Evolves from siloed work to cross-team collaboration" (vague improvement)
  GOOD: "From: designer exports PNGs and posts in Slack for feedback, losing track of which version got approved > To: designer shares a Figma link and reviewers leave comments directly on the canvas with resolved/unresolved status" (observable behavior change)

Return a JSON array of 8-20 candidates:
[
  {
    "name": "...",
    "description": "...",
    "role": "...",
    "confidence": "high|medium|low",
    "source_urls": ["..."],
    "state_transition": "From: [old behavior] > To: [new behavior with specific feature]"
  }
]

Rules:
- Return ONLY valid JSON array, no commentary
- Each candidate MUST have state_transition as a non-empty string
- state_transition must describe observable workflow changes — not identity or persona shifts
- The "To" side must reference a specific product feature or screen, not just an abstract improvement
- confidence should be "high" if supported by case studies or detailed docs, "medium" if from feature descriptions, "low" if inferred from marketing
- source_urls must reference actual URLs from the provided pages`;

// --- Extractor ---

export async function extractStateTransitions(
  pages: CrawledPage[],
  llm: LlmProvider,
  batch1Context?: Batch1Context,
  productContext?: ProductContext,
): Promise<LensResult> {
  const startTime = Date.now();

  const filtered = filterPages(pages, PAGE_TYPES, PAGE_PRIORITY);
  if (filtered.length === 0) {
    throw new Error("No state-transition-relevant pages found");
  }

  const pageContext = buildPageContext(filtered);
  const profileCtx = buildProductContextString(productContext);
  const b1Ctx = buildBatch1Context(batch1Context);

  let userMessage = "";
  if (profileCtx) userMessage += profileCtx + "\n\n";
  if (b1Ctx) userMessage += b1Ctx + "\n\n";
  userMessage += `Analyze these pages for user state transitions:\n\n${pageContext}`;

  const responseText = await llm.complete(
    [
      { role: "system", content: STATE_TRANSITIONS_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { temperature: 0.2 },
  );

  const candidates = parseLensResponse(responseText, "state_transitions", "state_transition");

  return {
    lens: "state_transitions",
    candidates,
    candidate_count: candidates.length,
    execution_time_ms: Date.now() - startTime,
  };
}
