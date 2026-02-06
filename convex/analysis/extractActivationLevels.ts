import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

// --- Types (S001) ---

export type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

export interface ActivationCriterion {
  action: string;
  count: number;
  timeWindow?: string;
}

export interface ActivationLevel {
  level: number;
  name: string;
  signalStrength: SignalStrength;
  criteria: ActivationCriterion[];
  reasoning: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

export interface ActivationLevelsResult {
  levels: ActivationLevel[];
  primaryActivation: number;
  overallConfidence: number;
}

// --- Page filtering (S003) ---

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
 * Includes onboarding, help, customers, features, and homepage pages.
 * Sorted by priority: onboarding first, homepage last.
 */
export function filterActivationPages(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>
): Array<{ pageType: string; content: string; url: string; title?: string }> {
  const relevant = pages.filter((p) => ACTIVATION_PAGE_TYPES.includes(p.pageType));

  relevant.sort(
    (a, b) =>
      (ACTIVATION_PAGE_PRIORITY[a.pageType] ?? 5) -
      (ACTIVATION_PAGE_PRIORITY[b.pageType] ?? 5)
  );

  return relevant;
}

// --- Page context builder ---

const MAX_CONTENT_PER_PAGE = 15_000;
const MAX_TOTAL_CONTENT = 40_000;

/**
 * Truncate content to a maximum character length, preserving whole lines.
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  const lastNewline = content.lastIndexOf("\n", maxLength);
  const cutPoint = lastNewline > 0 ? lastNewline : maxLength;
  return content.slice(0, cutPoint) + "\n\n[Content truncated]";
}

/**
 * Build formatted context string from crawled pages for the LLM prompt.
 */
export function buildActivationPageContext(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>
): string {
  let totalLength = 0;
  const sections: string[] = [];

  for (const page of pages) {
    const remaining = MAX_TOTAL_CONTENT - totalLength;
    if (remaining <= 0) break;

    const pageMaxLength = Math.min(MAX_CONTENT_PER_PAGE, remaining);
    const truncated = truncateContent(page.content, pageMaxLength);

    const header = `--- PAGE: ${page.title || page.url} (${page.pageType}) ---\nURL: ${page.url}`;
    sections.push(`${header}\n\n${truncated}`);
    totalLength += truncated.length;
  }

  return sections.join("\n\n");
}

// --- Prompt (S002) ---

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

// --- Response parser (S005) ---

const VALID_SIGNAL_STRENGTHS: SignalStrength[] = ["weak", "medium", "strong", "very_strong"];

/**
 * Parse Claude's response to extract the activation levels JSON.
 * Handles markdown code fences and raw JSON.
 * Validates all required fields, clamps confidences, sorts levels.
 */
export function parseActivationLevelsResponse(responseText: string): ActivationLevelsResult {
  // Extract JSON from code fences first
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
        `Invalid signalStrength: ${level.signalStrength}. Must be one of: ${VALID_SIGNAL_STRENGTHS.join(", ")}`
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
      `primaryActivation ${parsed.primaryActivation} does not match any level number`
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

// --- InternalAction (S004) ---

/**
 * Extract multi-level activation from crawled pages using Claude Haiku.
 *
 * Flow:
 * 1. Fetch crawled pages for the product
 * 2. Filter to activation-relevant pages (onboarding, help, features, etc.)
 * 3. Build page context with identity context if available
 * 4. Call Claude Haiku with ACTIVATION_SYSTEM_PROMPT
 * 5. Parse and validate response
 * 6. Store on product profile under definitions.activation
 */
export const extractActivationLevels = internalAction({
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

    // 2. Filter to activation-relevant pages
    const activationPages = filterActivationPages(pages);

    if (activationPages.length === 0) {
      throw new Error("No activation-relevant pages found");
    }

    // 3. Build page context
    const pageContext = buildActivationPageContext(activationPages);

    // 4. Get identity for product context (helps with value prop identification)
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });

    let identityContext = "";
    if (profile?.identity) {
      const id = profile.identity as {
        productName: string;
        description: string;
        targetCustomer?: string;
      };
      identityContext = `Product: ${id.productName}\nDescription: ${id.description}`;
      if (id.targetCustomer) {
        identityContext += `\nTarget customer: ${id.targetCustomer}`;
      }
    }

    // 5. Call Claude Haiku
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }

    const client = new Anthropic({ apiKey });

    const userMessage = identityContext
      ? `${identityContext}\n\nExtract activation levels from:\n\n${pageContext}`
      : `Extract activation levels from:\n\n${pageContext}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 2048,
      system: ACTIVATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    // 6. Parse response
    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const activation = parseActivationLevelsResponse(textContent);

    // 7. Ensure product profile exists
    await ctx.runMutation(internal.productProfiles.createInternal, {
      productId: args.productId,
    });

    // 8. Store on profile - updates definitions.activation
    // Fetch current definitions to merge (preserve other definition fields)
    const currentProfile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });

    const existingDefinitions =
      (currentProfile?.definitions as Record<string, unknown>) ?? {};

    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "definitions",
      data: { ...existingDefinitions, activation },
    });

    return activation;
  },
});
