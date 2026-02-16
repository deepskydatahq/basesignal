// Activation levels extraction from crawled pages.

import type { CrawledPage, LlmProvider, ProductContext, ActivationLevelsResult } from "./types.js";
import type { ActivationLevel } from "@basesignal/core";
import type { SignalStrength } from "@basesignal/core";
import { buildPageContext } from "./lenses/shared.js";

// --- Page filtering ---

const ACTIVATION_PAGE_TYPES = ["onboarding", "help", "customers", "features", "homepage"];

const ACTIVATION_PAGE_PRIORITY: Record<string, number> = {
  onboarding: 0,
  help: 1,
  customers: 2,
  features: 3,
  homepage: 4,
};

/**
 * Filter crawled pages to those relevant for activation extraction.
 */
export function filterActivationPages(
  pages: CrawledPage[],
): CrawledPage[] {
  const relevant = pages.filter((p) => ACTIVATION_PAGE_TYPES.includes(p.pageType));
  relevant.sort(
    (a, b) =>
      (ACTIVATION_PAGE_PRIORITY[a.pageType] ?? 5) -
      (ACTIVATION_PAGE_PRIORITY[b.pageType] ?? 5),
  );
  return relevant;
}

// --- Response parser ---

const VALID_SIGNAL_STRENGTHS: SignalStrength[] = ["weak", "medium", "strong", "very_strong"];

/**
 * Parse LLM response to extract activation levels JSON.
 * Handles markdown code fences and raw JSON.
 * Validates all required fields, clamps confidences, sorts levels.
 */
export function parseActivationLevelsResponse(responseText: string): ActivationLevelsResult {
  const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();

  const parsed = JSON.parse(jsonStr);

  // Validate top-level fields
  if (!Array.isArray(parsed.levels)) {
    throw new Error("Missing required field: levels (must be array)");
  }
  if (typeof parsed.primaryActivation !== "number") {
    throw new Error("Missing required field: primaryActivation (must be number)");
  }
  if (typeof parsed.overallConfidence !== "number") {
    throw new Error("Missing required field: overallConfidence (must be number)");
  }

  // Validate each level
  for (const level of parsed.levels) {
    if (typeof level.level !== "number") {
      throw new Error("Level missing required field: level (must be number)");
    }
    if (typeof level.name !== "string" || !level.name) {
      throw new Error("Level missing required field: name (must be non-empty string)");
    }
    if (!VALID_SIGNAL_STRENGTHS.includes(level.signalStrength)) {
      throw new Error(
        `Invalid signalStrength: ${level.signalStrength}. Must be one of: ${VALID_SIGNAL_STRENGTHS.join(", ")}`,
      );
    }
    if (!Array.isArray(level.criteria) || level.criteria.length === 0) {
      throw new Error(`Level ${level.level} missing required field: criteria (must be non-empty array)`);
    }
    for (const criterion of level.criteria) {
      if (typeof criterion.action !== "string" || !criterion.action) {
        throw new Error(`Level ${level.level} has criterion with missing action`);
      }
      if (typeof criterion.count !== "number") {
        throw new Error(`Level ${level.level} has criterion with missing count`);
      }
    }
    if (typeof level.confidence !== "number") {
      throw new Error(`Level ${level.level} missing required field: confidence`);
    }
    if (!Array.isArray(level.evidence)) {
      throw new Error(`Level ${level.level} missing required field: evidence (must be array)`);
    }
  }

  // Sort levels by level number ascending
  parsed.levels.sort((a: ActivationLevel, b: ActivationLevel) => a.level - b.level);

  // Clamp confidence values to [0, 1]
  parsed.overallConfidence = Math.max(0, Math.min(1, parsed.overallConfidence));
  for (const level of parsed.levels) {
    level.confidence = Math.max(0, Math.min(1, level.confidence));
  }

  // Validate primaryActivation references an existing level
  if (!parsed.levels.some((l: ActivationLevel) => l.level === parsed.primaryActivation)) {
    throw new Error(
      `primaryActivation ${parsed.primaryActivation} does not match any level number`,
    );
  }

  // Strip evidence to only url and excerpt
  for (const level of parsed.levels) {
    if (Array.isArray(level.evidence)) {
      level.evidence = level.evidence.map((e: { url: string; excerpt: string }) => ({
        url: String(e.url || ""),
        excerpt: String(e.excerpt || ""),
      }));
    }
  }

  return parsed as ActivationLevelsResult;
}

// --- System prompt ---

export const ACTIVATION_SYSTEM_PROMPT = `You are a product analyst identifying user activation progression from website content.

Extract 3-4 activation levels representing a spectrum from initial exploration to deep engagement.

Return a single JSON object matching this structure:

{
  "levels": [
    {
      "level": 1,
      "name": "explorer",
      "signalStrength": "weak",
      "criteria": [{"action": "create_board", "count": 1}],
      "reasoning": "Creating the first board shows initial interest",
      "confidence": 0.7,
      "evidence": [{"url": "https://example.com/features", "excerpt": "Get started by creating your first board"}]
    }
  ],
  "primaryActivation": 2,
  "overallConfidence": 0.6
}

Signal strength mapping:
- weak: Individual exploration (created first item, browsed content, signed up)
- medium: Learning the product (used a template, completed tutorial, customized settings)
- strong: Realized core value (shared work, collaborated, achieved first outcome)
- very_strong: Team/habit adoption (multiple users active, regular usage patterns, integrated into workflow)

Primary activation rules:
- primaryActivation is the level number where the core value proposition is realized
- For collaboration tools (Miro, Figma): sharing + someone else accessing
- For project tools (Linear, Jira): first issue tracked through completion
- For analytics tools: first insight or dashboard created and shared
- This is the "aha moment" - the level that most correlates with retention

Look for behavioral language:
- Onboarding steps and getting started guides
- Success stories mentioning specific user actions
- Feature descriptions with user actions (create, invite, share, collaborate, export)
- Help docs describing workflows and best practices

Confidence scoring:
- 0.7+ if help docs or case studies mention specific behaviors
- 0.5-0.7 if inferred from feature descriptions
- 0.3-0.5 if inferring from marketing copy only

Rules:
- Return ONLY valid JSON, no commentary before or after
- Extract 3-4 levels covering weak through strong/very_strong
- Each level must have at least one criterion with an action and count
- Level numbers must be sequential starting from 1
- Names should be product-specific (not generic like "Level 1")
- Evidence should reference specific content from the crawled pages`;

// --- Extractor ---

export async function extractActivationLevels(
  pages: CrawledPage[],
  llm: LlmProvider,
  productContext?: ProductContext,
): Promise<ActivationLevelsResult> {
  const activationPages = filterActivationPages(pages);
  if (activationPages.length === 0) {
    throw new Error("No activation-relevant pages found");
  }

  const pageContext = buildPageContext(activationPages);

  let identityContext = "";
  if (productContext?.name) {
    identityContext = `Product: ${productContext.name}`;
    if (productContext.description) identityContext += `\nDescription: ${productContext.description}`;
    if (productContext.targetCustomer) identityContext += `\nTarget customer: ${productContext.targetCustomer}`;
  }

  const userMessage = identityContext
    ? `${identityContext}\n\nExtract activation levels from:\n\n${pageContext}`
    : `Extract activation levels from:\n\n${pageContext}`;

  const responseText = await llm.complete(
    [
      { role: "system", content: ACTIVATION_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { model: "haiku", maxTokens: 2048 },
  );

  return parseActivationLevelsResponse(responseText);
}
