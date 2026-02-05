import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

interface JourneyStage {
  name: string;
  description: string;
  order: number;
}

interface JourneyResult {
  stages: JourneyStage[];
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

interface DefinitionBase {
  criteria: string[];
  timeWindow?: string;
  reasoning: string;
  confidence: number;
  source: string;
  evidence: Array<{ url: string; excerpt: string }>;
}

interface FirstValueDefinition {
  description: string;
  criteria: string[];
  reasoning: string;
  confidence: number;
  source: string;
  evidence: Array<{ url: string; excerpt: string }>;
}

interface DefinitionsResult {
  activation: DefinitionBase;
  firstValue: FirstValueDefinition;
  active: DefinitionBase;
  atRisk: DefinitionBase;
  churn: DefinitionBase;
}

interface CrawledPage {
  url: string;
  pageType: string;
  title?: string;
  content: string;
}

/**
 * Prepare crawled page content for LLM consumption.
 * Selects homepage, features, about, and pricing pages.
 * Truncates to fit within context limits.
 */
export function prepareCrawledContent(
  pages: CrawledPage[],
): string {
  const priorityTypes = ["homepage", "features", "about", "pricing"];
  const selected: CrawledPage[] = [];

  for (const pageType of priorityTypes) {
    const matches = pages.filter((p) => p.pageType === pageType);
    selected.push(...matches);
  }

  // If no priority pages found, take whatever we have
  if (selected.length === 0) {
    selected.push(...pages.slice(0, 4));
  }

  const MAX_CONTENT_PER_PAGE = 8000;
  const parts: string[] = [];

  for (const page of selected) {
    const content =
      page.content.length > MAX_CONTENT_PER_PAGE
        ? page.content.slice(0, MAX_CONTENT_PER_PAGE) + "\n[... truncated]"
        : page.content;
    parts.push(`--- Page: ${page.title ?? page.url} (${page.pageType}) ---\n${content}`);
  }

  return parts.join("\n\n");
}

/**
 * Build the system prompt for journey stage extraction (Call 1).
 */
export function buildJourneyPrompt(
  crawledContent: string,
  identityContext?: string,
): string {
  return `You are a product analyst. Given the crawled website content below, extract the observable user journey stages for this product.

Each stage should represent a meaningful step in the user lifecycle, from first discovery through ongoing engagement and retention.

Use product-specific naming — not generic labels. For example, instead of "Stage 1", use names like "Visitor", "Free Trial User", "Activated User", "Power User", "Paying Customer", "Retained Customer".

${identityContext ? `\nProduct context:\n${identityContext}\n` : ""}

Crawled website content:
${crawledContent}

Respond with valid JSON only (no markdown fences). Use this exact structure:
{
  "stages": [
    { "name": "string", "description": "string", "order": 1 }
  ],
  "confidence": 0.45,
  "evidence": [
    { "url": "page url", "excerpt": "relevant quote from the page" }
  ]
}

Guidelines:
- Include 4-7 stages covering the full lifecycle
- Order them sequentially (1 = first stage)
- Confidence should be 0.3-0.6 (these are inferences from public content)
- Evidence should reference specific content from the crawled pages
- Be specific to this product, not generic`;
}

/**
 * Build the system prompt for lifecycle definitions extraction (Call 2).
 */
export function buildDefinitionsPrompt(
  crawledContent: string,
  journeyStages: JourneyStage[],
  identityContext?: string,
): string {
  const stagesSummary = journeyStages
    .map((s) => `${s.order}. ${s.name}: ${s.description}`)
    .join("\n");

  return `You are a product analyst. Given the crawled website content and the extracted journey stages below, draft lifecycle definitions for this product.

These are STARTING POINTS that will need user validation. Be conservative and explicit about what you're inferring vs. what's directly stated.

Journey stages:
${stagesSummary}

${identityContext ? `\nProduct context:\n${identityContext}\n` : ""}

Crawled website content:
${crawledContent}

Respond with valid JSON only (no markdown fences). Use this exact structure:
{
  "activation": {
    "criteria": ["criterion 1", "criterion 2"],
    "timeWindow": "e.g. within 7 days of signup",
    "reasoning": "Why these criteria indicate activation",
    "confidence": 0.35,
    "source": "ai-inferred",
    "evidence": [{ "url": "page url", "excerpt": "relevant quote" }]
  },
  "firstValue": {
    "description": "What the user's first meaningful value moment looks like",
    "criteria": ["criterion 1", "criterion 2"],
    "reasoning": "Why this represents first value delivery",
    "confidence": 0.35,
    "source": "ai-inferred",
    "evidence": [{ "url": "page url", "excerpt": "relevant quote" }]
  },
  "active": {
    "criteria": ["criterion 1", "criterion 2"],
    "timeWindow": "e.g. at least 3 sessions per week",
    "reasoning": "Why these criteria define an active user",
    "confidence": 0.3,
    "source": "ai-inferred",
    "evidence": [{ "url": "page url", "excerpt": "relevant quote" }]
  },
  "atRisk": {
    "criteria": ["criterion 1", "criterion 2"],
    "timeWindow": "e.g. no activity for 14 days",
    "reasoning": "Why these criteria signal at-risk status",
    "confidence": 0.3,
    "source": "ai-inferred",
    "evidence": [{ "url": "page url", "excerpt": "relevant quote" }]
  },
  "churn": {
    "criteria": ["criterion 1", "criterion 2"],
    "timeWindow": "e.g. no activity for 30 days",
    "reasoning": "Why these criteria define churn",
    "confidence": 0.3,
    "source": "ai-inferred",
    "evidence": [{ "url": "page url", "excerpt": "relevant quote" }]
  }
}

Guidelines:
- All confidence values should be 0.3-0.5 (these are drafts needing validation)
- source must always be "ai-inferred"
- Be specific to this product based on what you observe
- criteria should be observable/measurable behaviors
- timeWindow is optional but recommended where applicable
- Evidence should reference specific content from the crawled pages`;
}

/**
 * Parse JSON from LLM response, handling potential markdown fences.
 */
export function parseLlmJson<T>(text: string): T {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned) as T;
}

/**
 * Validate journey result has required structure.
 */
export function validateJourneyResult(data: unknown): JourneyResult {
  const result = data as JourneyResult;
  if (!result || !Array.isArray(result.stages) || result.stages.length === 0) {
    throw new Error("Invalid journey result: stages array is required and must be non-empty");
  }
  for (const stage of result.stages) {
    if (!stage.name || !stage.description || typeof stage.order !== "number") {
      throw new Error(`Invalid stage: ${JSON.stringify(stage)}`);
    }
  }
  if (typeof result.confidence !== "number") {
    throw new Error("Invalid journey result: confidence is required");
  }
  if (!Array.isArray(result.evidence)) {
    throw new Error("Invalid journey result: evidence array is required");
  }
  return result;
}

/**
 * Validate definitions result has required structure.
 */
export function validateDefinitionsResult(data: unknown): DefinitionsResult {
  const result = data as DefinitionsResult;
  const keys = ["activation", "firstValue", "active", "atRisk", "churn"] as const;

  for (const key of keys) {
    const def = result[key];
    if (!def) {
      throw new Error(`Missing definition: ${key}`);
    }
    if (!Array.isArray(def.criteria) || def.criteria.length === 0) {
      throw new Error(`Invalid ${key}: criteria array is required and must be non-empty`);
    }
    if (typeof def.reasoning !== "string" || !def.reasoning) {
      throw new Error(`Invalid ${key}: reasoning is required`);
    }
    if (typeof def.confidence !== "number") {
      throw new Error(`Invalid ${key}: confidence is required`);
    }
    if (def.source !== "ai-inferred") {
      throw new Error(`Invalid ${key}: source must be 'ai-inferred'`);
    }
    if (!Array.isArray(def.evidence)) {
      throw new Error(`Invalid ${key}: evidence array is required`);
    }
  }

  // firstValue must also have description
  if (typeof result.firstValue.description !== "string" || !result.firstValue.description) {
    throw new Error("Invalid firstValue: description is required");
  }

  return result;
}

/**
 * Extract journey stages and lifecycle definitions from crawled product pages.
 *
 * Two sequential Claude Haiku calls:
 *   Call 1: Extract observable journey stages (higher confidence, 0.3-0.6)
 *   Call 2: Infer lifecycle definitions with source='ai-inferred' (lower confidence, 0.3-0.5)
 *
 * Journey is persisted before definitions call for partial success safety.
 */
export const extractJourney = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // 1. Fetch crawled pages
    const pages = await ctx.runQuery(internal.crawledPages.listByProductInternal, {
      productId: args.productId,
    });

    if (pages.length === 0) {
      throw new Error("No crawled pages found for product");
    }

    // 2. Get existing identity for context (if available)
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });

    let identityContext: string | undefined;
    if (profile?.identity) {
      const id = profile.identity;
      identityContext = `Product: ${id.productName}\nDescription: ${id.description}\nTarget customer: ${id.targetCustomer}\nBusiness model: ${id.businessModel}`;
    }

    // 3. Prepare content
    const crawledContent = prepareCrawledContent(pages);

    // 4. Initialize Anthropic client
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    const client = new Anthropic({ apiKey });

    // === Call 1: Extract journey stages ===
    const journeyPrompt = buildJourneyPrompt(crawledContent, identityContext);

    const journeyResponse = await client.messages.create({
      model: "claude-haiku-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: journeyPrompt }],
    });

    const journeyText =
      journeyResponse.content[0].type === "text"
        ? journeyResponse.content[0].text
        : "";
    const journeyData = parseLlmJson<JourneyResult>(journeyText);
    const validatedJourney = validateJourneyResult(journeyData);

    // 5. Persist journey immediately (partial success safety)
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "journey",
      data: validatedJourney,
    });

    // === Call 2: Infer lifecycle definitions ===
    const definitionsPrompt = buildDefinitionsPrompt(
      crawledContent,
      validatedJourney.stages,
      identityContext,
    );

    const definitionsResponse = await client.messages.create({
      model: "claude-haiku-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: definitionsPrompt }],
    });

    const definitionsText =
      definitionsResponse.content[0].type === "text"
        ? definitionsResponse.content[0].text
        : "";
    const definitionsData = parseLlmJson<DefinitionsResult>(definitionsText);
    const validatedDefinitions = validateDefinitionsResult(definitionsData);

    // 6. Persist definitions
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "definitions",
      data: validatedDefinitions,
    });

    return {
      journey: validatedJourney,
      definitions: validatedDefinitions,
    };
  },
});
