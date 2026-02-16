// Artifact Creation lens extractor.

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

const PAGE_TYPES = ["features", "customers", "homepage", "help"];

const PAGE_PRIORITY: Record<string, number> = {
  features: 0,
  customers: 1,
  homepage: 2,
  help: 3,
};

// --- System prompt ---

export const ARTIFACT_CREATION_SYSTEM_PROMPT = `You are a product analyst identifying value moments through the Artifact Creation lens.

Core question: "What specific things does a user BUILD or EXPORT from this product that others use outside of it?"

Focus on what a user physically creates or exports. Describe the screen where they initiate creation, the steps they take, and the tangible output that leaves the product and gets used by others who may never log into the tool.

For each value moment candidate, identify:
- name: Short descriptive name for the value moment
- description: 1-2 sentences explaining what a user BUILDS or EXPORTS (which screen, what action) and who uses the result outside the product
- role: Which user role benefits most
- confidence: "high", "medium", or "low"
- source_urls: URLs from the crawled pages that informed this candidate
- artifact_type: The type/category of artifact created (e.g., "project roadmap", "sprint report", "team wiki")

Every candidate must reference a specific screen, UI element, or user action visible in the product.

BANNED WORDS — do not use these marketing terms: automate, streamline, optimize, leverage, enhance, empower. If you catch yourself writing one of these, replace it with a concrete verb describing what the user builds or exports.

Anti-patterns (REJECT these):
- Marketing fluff: "empowers teams to create better deliverables" — says nothing about what is built
- Tool outputs: "generates reports" is a feature description, not a specific artifact a user creates
- Ephemeral states: "sets a status" has no lasting value outside the tool
- Internal-only data: "stores tasks" stays inside the tool, nobody outside uses it

GOOD vs BAD examples:

BAD: "Leverages reporting tools to enhance stakeholder communication"
GOOD: "PM clicks 'Export Roadmap' on the Roadmap View and gets a PDF with timeline, milestones, and status — this PDF gets attached to board meeting agendas and referenced by executives who never log into the product"

BAD: "Streamlines documentation creation"
GOOD: "After a sprint ends, the Scrum Master opens the Retrospective page, fills in the What Went Well / What Didn't template, and clicks 'Publish' — the resulting document gets linked in the team wiki and referenced in the next quarter's planning sessions"

BAD: "Optimizes data export capabilities"
GOOD: "Analyst opens the Analytics Dashboard, selects date range and metrics, clicks 'Export CSV', and gets a spreadsheet that finance plugs directly into their quarterly revenue model — finance never opens the product itself"

Return a JSON array of 8-20 candidates:
[
  {
    "name": "...",
    "description": "...",
    "role": "...",
    "confidence": "high|medium|low",
    "source_urls": ["..."],
    "artifact_type": "type of artifact created"
  }
]

Rules:
- Return ONLY valid JSON array, no commentary
- Each candidate MUST have artifact_type as a non-empty string
- Every candidate must name a specific screen, button, page, or user action — no abstract outcomes
- confidence should be "high" if supported by case studies or detailed docs, "medium" if from feature descriptions, "low" if inferred from marketing
- source_urls must reference actual URLs from the provided pages`;

// --- Response parser ---

export function parseArtifactCreationResponse(responseText: string): LensCandidate[] {
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
    if (typeof item.artifact_type !== "string" || !item.artifact_type) {
      throw new Error(
        `Candidate ${i} missing required lens field: artifact_type (must be non-empty string)`,
      );
    }

    return {
      id: crypto.randomUUID(),
      lens: "artifact_creation" as const,
      name: item.name,
      description: item.description,
      role: item.role,
      confidence: normalizeConfidence(item.confidence),
      source_urls: item.source_urls.map(String),
      artifact_type: item.artifact_type,
    };
  });
}

// --- Extractor ---

export async function extractArtifactCreation(
  pages: CrawledPage[],
  llm: LlmProvider,
  productContext?: ProductContext,
): Promise<LensResult> {
  const startTime = Date.now();

  const relevantPages = filterPages(pages, PAGE_TYPES, PAGE_PRIORITY);
  if (relevantPages.length === 0) {
    throw new Error("No artifact-relevant pages found");
  }

  const pageContext = buildPageContext(relevantPages);
  const profileContext = buildProductContextString(productContext);

  const userMessage = profileContext
    ? `${profileContext}\n\nAnalyze these pages for artifact creation:\n\n${pageContext}`
    : `Analyze these pages for artifact creation:\n\n${pageContext}`;

  const responseText = await llm.complete(
    [
      { role: "system", content: ARTIFACT_CREATION_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { temperature: 0.2 },
  );

  const candidates = parseArtifactCreationResponse(responseText);

  return {
    lens: "artifact_creation",
    candidates,
    candidate_count: candidates.length,
    execution_time_ms: Date.now() - startTime,
  };
}
