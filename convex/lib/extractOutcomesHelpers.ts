/**
 * Pure helper functions for the extractOutcomes action.
 * Extracted for testability — no Convex runtime dependencies.
 */

const MAX_PAGE_CONTENT_LENGTH = 25_000; // ~25KB per page

export interface CrawledPageInput {
  url: string;
  pageType: string;
  content: string;
}

export interface OutcomeItem {
  description: string;
  type: string; // "primary" | "secondary" | "tertiary"
  linkedFeatures: string[];
}

export interface OutcomesResult {
  items: OutcomeItem[];
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

const SYSTEM_PROMPT = `You are a product analyst extracting product outcomes and jobs-to-be-done from marketing website content.

Analyze the provided website pages and identify the outcomes/jobs-to-be-done the product delivers.

## Outcome Type Classification (by positioning hierarchy)
- **primary**: The main job-to-be-done from hero messaging — what the product fundamentally does
- **secondary**: Supporting outcomes from value propositions — benefits that reinforce the primary outcome
- **tertiary**: Outcomes mentioned only in testimonials or minor sections — real but not central to positioning

## Rules
- Extract 3-8 outcomes total
- There should be exactly 1 primary outcome (the hero message job-to-be-done)
- Link outcomes to specific features mentioned on the site where possible
- Feature names should match the marketing copy (e.g., "Whiteboard", not "whiteboarding tool")
- Evidence excerpts should be short (1-2 sentences) and directly support the outcome
- Confidence should reflect how clearly the site communicates its outcomes (0.0-1.0)

## Output Format
Respond with ONLY valid JSON (no markdown, no explanation):
{
  "items": [
    {
      "description": "string — the outcome/job-to-be-done",
      "type": "primary|secondary|tertiary",
      "linkedFeatures": ["Feature A", "Feature B"]
    }
  ],
  "confidence": 0.0-1.0,
  "evidence": [
    {
      "url": "https://example.com",
      "excerpt": "Short excerpt from the page supporting this extraction"
    }
  ]
}`;

/**
 * Build the user prompt from crawled pages, labeling each by page type.
 * Truncates individual pages to MAX_PAGE_CONTENT_LENGTH.
 */
export function buildOutcomesPrompt(pages: CrawledPageInput[]): string {
  const sections = pages.map((page) => {
    const content =
      page.content.length > MAX_PAGE_CONTENT_LENGTH
        ? page.content.slice(0, MAX_PAGE_CONTENT_LENGTH) + "\n[truncated]"
        : page.content;
    return `--- [${page.pageType}] ${page.url} ---\n${content}`;
  });

  return `Analyze these website pages and extract the product outcomes/jobs-to-be-done:\n\n${sections.join("\n\n")}`;
}

/**
 * Parse the LLM response into a validated OutcomesResult.
 * Handles JSON wrapped in markdown code blocks.
 * Defaults missing fields and clamps confidence.
 */
export function parseOutcomesResponse(raw: string): OutcomesResult {
  // Strip markdown code blocks if present
  let jsonStr = raw.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);

  // Validate and default items
  const items: OutcomeItem[] = (parsed.items ?? []).map(
    (item: Partial<OutcomeItem>) => ({
      description: item.description ?? "",
      type: item.type ?? "secondary",
      linkedFeatures: Array.isArray(item.linkedFeatures)
        ? item.linkedFeatures
        : [],
    }),
  );

  // Clamp confidence between 0 and 1
  const confidence = Math.min(1, Math.max(0, parsed.confidence ?? 0.5));

  // Validate evidence
  const evidence: OutcomesResult["evidence"] = (parsed.evidence ?? []).map(
    (e: { url?: string; excerpt?: string }) => ({
      url: e.url ?? "",
      excerpt: e.excerpt ?? "",
    }),
  );

  return { items, confidence, evidence };
}

/**
 * The system prompt for the extraction call.
 */
export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}
