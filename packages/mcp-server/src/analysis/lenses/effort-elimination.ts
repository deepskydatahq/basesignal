// Effort Elimination lens extractor.

import type { CrawledPage, LlmProvider, ProductContext } from "../types.js";
import type { LensCandidate, LensResult } from "./lens-types.js";
import {
  filterPages,
  buildPageContext,
  buildProductContextString,
  extractJson,
  normalizeConfidence,
} from "./shared.js";

// --- Page filtering ---

const PAGE_TYPES = ["features", "customers", "homepage", "about", "pricing"];

const PAGE_PRIORITY: Record<string, number> = {
  features: 0,
  customers: 1,
  homepage: 2,
  about: 3,
  pricing: 4,
};

// --- System prompt ---

export const EFFORT_ELIMINATION_SYSTEM_PROMPT = `You are a product analyst identifying value moments through the Effort Elimination lens.

Core question: "What specific steps does a user SKIP entirely because this product handles them?"

Focus on what users no longer need to do. Describe the screen or workflow where something that used to require manual steps now happens without user involvement. The user should be able to point at a screen and say "I used to have to do X here, and now I don't."

For each value moment candidate, identify:
- name: Short descriptive name for the value moment
- description: 1-2 sentences explaining what specific step a user SKIPS and where in the product this happens
- role: Which user role benefits most
- confidence: "high", "medium", or "low"
- source_urls: URLs from the crawled pages that informed this candidate
- effort_eliminated: A specific description of the step(s) the user no longer performs, referencing the screen or workflow where it used to happen

Every candidate must reference a specific screen, UI element, or user action visible in the product.

BANNED WORDS — do not use these marketing terms: automate, streamline, optimize, leverage, enhance, empower. If you catch yourself writing one of these, replace it with a concrete verb describing what the user no longer does.

Anti-patterns (REJECT these):
- Marketing fluff: "streamlines team collaboration" or "optimizes workflows" — says nothing about what a user skips
- Vague savings: "faster task creation" is speed, not elimination
- Soft benefits: "reduces overhead" — overhead of what, on which screen?
- Partial reduction: "less time in meetings" — what specific step is eliminated?

GOOD vs BAD examples:

BAD: "Automates status reporting to streamline communication"
GOOD: "On the Project Dashboard, a live progress bar updates as tasks move to Done — the PM no longer opens a spreadsheet every Friday to manually compile status percentages from each team lead's Slack messages"

BAD: "Leverages integrations to reduce manual data entry"
GOOD: "When an engineer closes a PR in GitHub, the linked task on the Board View moves to 'Done' automatically — the engineer never opens the project tool to drag the card themselves"

BAD: "Enhances onboarding efficiency"
GOOD: "New team members see a pre-populated Project Setup page with roles, permissions, and default views already configured — the admin skips the 15-field setup form they used to fill out for every new hire"

Return a JSON array of 8-20 candidates:
[
  {
    "name": "...",
    "description": "...",
    "role": "...",
    "confidence": "high|medium|low",
    "source_urls": ["..."],
    "effort_eliminated": "specific step(s) the user no longer performs and where"
  }
]

Rules:
- Return ONLY valid JSON array, no commentary
- Each candidate MUST have effort_eliminated as a non-empty string
- Every candidate must name a specific screen, button, page, or user action — no abstract outcomes
- confidence should be "high" if supported by case studies or detailed docs, "medium" if from feature descriptions, "low" if inferred from marketing
- source_urls must reference actual URLs from the provided pages`;

// --- Response parser ---

export function parseEffortEliminationResponse(responseText: string): LensCandidate[] {
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
    if (typeof item.effort_eliminated !== "string" || !item.effort_eliminated) {
      throw new Error(
        `Candidate ${i} missing required lens field: effort_eliminated (must be non-empty string)`,
      );
    }

    return {
      id: crypto.randomUUID(),
      lens: "effort_elimination" as const,
      name: item.name,
      description: item.description,
      role: item.role,
      confidence: normalizeConfidence(item.confidence),
      source_urls: item.source_urls.map(String),
      effort_eliminated: item.effort_eliminated,
    };
  });
}

// --- Extractor ---

export async function extractEffortElimination(
  pages: CrawledPage[],
  llm: LlmProvider,
  productContext?: ProductContext,
): Promise<LensResult> {
  const startTime = Date.now();

  const relevantPages = filterPages(pages, PAGE_TYPES, PAGE_PRIORITY);
  if (relevantPages.length === 0) {
    throw new Error("No effort-relevant pages found");
  }

  const pageContext = buildPageContext(relevantPages);
  const profileContext = buildProductContextString(productContext);

  const userMessage = profileContext
    ? `${profileContext}\n\nAnalyze these pages for effort elimination:\n\n${pageContext}`
    : `Analyze these pages for effort elimination:\n\n${pageContext}`;

  const responseText = await llm.complete(
    [
      { role: "system", content: EFFORT_ELIMINATION_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { temperature: 0.2 },
  );

  const candidates = parseEffortEliminationResponse(responseText);

  return {
    lens: "effort_elimination",
    candidates,
    candidate_count: candidates.length,
    execution_time_ms: Date.now() - startTime,
  };
}
