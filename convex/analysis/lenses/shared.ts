import Anthropic from "@anthropic-ai/sdk";
import type { LensType, ConfidenceLevel, LensCandidate } from "./types";

export const MAX_CONTENT_PER_PAGE = 15_000;
export const MAX_TOTAL_CONTENT = 40_000;

/**
 * Truncate content to a maximum character length, preserving whole lines.
 */
export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  const lastNewline = content.lastIndexOf("\n", maxLength);
  const cutPoint = lastNewline > 0 ? lastNewline : maxLength;
  return content.slice(0, cutPoint) + "\n\n[Content truncated]";
}

/**
 * Build formatted context string from crawled pages for the LLM prompt.
 */
export function buildPageContext(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>,
  maxPerPage: number = MAX_CONTENT_PER_PAGE,
  maxTotal: number = MAX_TOTAL_CONTENT,
): string {
  let totalLength = 0;
  const sections: string[] = [];

  for (const page of pages) {
    const remaining = maxTotal - totalLength;
    if (remaining <= 0) break;

    const pageMaxLength = Math.min(maxPerPage, remaining);
    const truncated = truncateContent(page.content, pageMaxLength);

    const header = `--- PAGE: ${page.title || page.url} (${page.pageType}) ---\nURL: ${page.url}`;
    sections.push(`${header}\n\n${truncated}`);
    totalLength += truncated.length;
  }

  return sections.join("\n\n");
}

/**
 * Extract JSON from text that may contain markdown code fences or raw JSON.
 */
export function extractJson(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}

const VALID_CONFIDENCE_LEVELS: ConfidenceLevel[] = ["low", "medium", "high"];

function normalizeConfidence(value: unknown): ConfidenceLevel {
  if (typeof value === "string" && VALID_CONFIDENCE_LEVELS.includes(value as ConfidenceLevel)) {
    return value as ConfidenceLevel;
  }
  if (typeof value === "number") {
    if (value >= 0.7) return "high";
    if (value >= 0.4) return "medium";
    return "low";
  }
  return "medium";
}

/**
 * Parse Claude's response into validated LensCandidate array.
 * Validates shared fields and the lens-specific field.
 */
export function parseLensResponse(
  responseText: string,
  lensType: LensType,
  lensField: string,
): LensCandidate[] {
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
    if (item[lensField] === undefined || item[lensField] === null || item[lensField] === "") {
      throw new Error(`Candidate ${i} missing required lens field: ${lensField}`);
    }

    const candidate: LensCandidate = {
      id: crypto.randomUUID(),
      name: item.name,
      description: item.description,
      role: item.role,
      confidence: normalizeConfidence(item.confidence),
      source_urls: item.source_urls.map(String),
    };

    candidate[lensField as keyof LensCandidate] = String(item[lensField]) as never;

    return candidate;
  });
}

/**
 * Call Claude with the given system and user prompts.
 */
export async function callClaude(options: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: options.model ?? "claude-sonnet-4-20250514",
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.2,
    system: options.system,
    messages: [{ role: "user", content: options.user }],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
