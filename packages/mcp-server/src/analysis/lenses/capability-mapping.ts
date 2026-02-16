// Capability Mapping lens extractor.

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

const PAGE_TYPES = ["features", "customers", "homepage", "about", "help"];

const PAGE_PRIORITY: Record<string, number> = {
  features: 0,
  customers: 1,
  homepage: 2,
  about: 3,
  help: 4,
};

// --- System prompt ---

export const CAPABILITY_MAPPING_SYSTEM_PROMPT = `You are a product analyst identifying value moments through the Capability Mapping lens.

Core question: "What specific actions can a user take in this product that they could not do before?"

Focus on what a user physically DOES inside the product. Describe the screen they navigate to, the action they perform, and the result they see — then explain what this lets them accomplish that was previously impossible or impractical.

For each value moment candidate, identify:
- name: Short descriptive name for the value moment
- description: 1-2 sentences explaining what a user DOES in the product (which screen, what action) and what new ability this gives them
- role: Which user role benefits most
- confidence: "high", "medium", or "low"
- source_urls: URLs from the crawled pages that informed this candidate
- enabling_features: Array of specific product features (screens, tools, views) that make this action possible

Every candidate must reference a specific screen, UI element, or user action visible in the product.

BANNED WORDS — do not use these marketing terms: automate, streamline, optimize, leverage, enhance, empower. If you catch yourself writing one of these, replace it with a concrete verb describing what the user does.

Anti-patterns (REJECT these):
- Marketing fluff: "empowers teams to collaborate better" — says nothing about what a user does
- Feature lists: "create tasks" is a feature, not a new capability
- Abstract improvements: "better organization" — better how, on which screen?
- Tool-specific jargon: "use the Kanban board" names the tool, not the capability gained

GOOD vs BAD examples:

BAD: "Leverages analytics to optimize team performance"
GOOD: "Manager opens the Dependency Graph view, sees which blocked tasks are holding up three other teams, and reassigns work before the sprint ends — previously this required asking each team lead in standup and piecing together the picture manually"

BAD: "Enhances project visibility across the organization"
GOOD: "Executive opens the Portfolio View, filters by quarter, and sees every project's health status color-coded on one screen — previously required opening 12 separate project spreadsheets and comparing dates by hand"

BAD: "Streamlines workflow automation"
GOOD: "User opens the Rules Editor, sets 'when PR merged, move task to Done', and from that point forward every merged PR updates the board — the team never had a way to connect code events to project status before"

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
- Every candidate must name a specific screen, button, page, or user action — no abstract outcomes
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
        `Candidate ${i} missing required lens field: enabling_features (must be non-empty string array)`,
      );
    }

    return {
      id: crypto.randomUUID(),
      lens: "capability_mapping" as const,
      name: item.name,
      description: item.description,
      role: item.role,
      confidence: normalizeConfidence(item.confidence),
      source_urls: item.source_urls.map(String),
      enabling_features: item.enabling_features.map(String),
    };
  });
}

// --- Extractor ---

export async function extractCapabilityMapping(
  pages: CrawledPage[],
  llm: LlmProvider,
  productContext?: ProductContext,
): Promise<LensResult> {
  const startTime = Date.now();

  const relevantPages = filterPages(pages, PAGE_TYPES, PAGE_PRIORITY);
  if (relevantPages.length === 0) {
    throw new Error("No capability-relevant pages found");
  }

  const pageContext = buildPageContext(relevantPages);
  const profileContext = buildProductContextString(productContext);

  const userMessage = profileContext
    ? `${profileContext}\n\nAnalyze these pages for capability mapping:\n\n${pageContext}`
    : `Analyze these pages for capability mapping:\n\n${pageContext}`;

  const responseText = await llm.complete(
    [
      { role: "system", content: CAPABILITY_MAPPING_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { temperature: 0.2 },
  );

  const candidates = parseCapabilityMappingResponse(responseText);

  return {
    lens: "capability_mapping",
    candidates,
    candidate_count: candidates.length,
    execution_time_ms: Date.now() - startTime,
  };
}
