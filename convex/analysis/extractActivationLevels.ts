import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * A single measurable criterion for an activation level.
 * Each criterion should be specific and trackable.
 */
export interface ActivationCriterion {
  action: string; // e.g., "create_board", "invite_member"
  count: number; // e.g., 1, 5
  timeWindow?: string; // e.g., "first_7d", "first_14d"
}

/**
 * Signal strength indicating how strong a signal of product adoption
 * this activation level represents.
 */
export type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

/**
 * A single activation level in the user's journey toward value realization.
 */
export interface ActivationLevel {
  level: number; // 1, 2, 3, 4
  name: string; // e.g., "explorer", "creator", "collaborator"
  signalStrength: SignalStrength;
  criteria: ActivationCriterion[];
  reasoning: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

/**
 * Complete result from activation level extraction.
 */
export interface ActivationLevelsResult {
  levels: ActivationLevel[];
  primaryActivation: number; // Which level is the aha-moment
  overallConfidence: number;
}

// Valid signal strengths for validation
const VALID_SIGNAL_STRENGTHS: SignalStrength[] = [
  "weak",
  "medium",
  "strong",
  "very_strong",
];

// ============================================================================
// System Prompt
// ============================================================================

export const ACTIVATION_SYSTEM_PROMPT = `You are a product analyst identifying user activation progression for SaaS products.

## Your Task
Extract 3-4 activation levels that represent a user's journey from first interaction to full value realization. Each level should represent a distinct milestone in the user's adoption journey.

## Output Format
Return ONLY valid JSON matching this exact structure (no markdown, no explanation):

{
  "levels": [
    {
      "level": 1,
      "name": "explorer",
      "signalStrength": "weak",
      "criteria": [
        {"action": "create_board", "count": 1},
        {"action": "add_item", "count": 1}
      ],
      "reasoning": "First exploration shows initial interest but no commitment",
      "confidence": 0.8,
      "evidence": [{"url": "https://...", "excerpt": "Get started by creating your first board"}]
    }
  ],
  "primaryActivation": 2,
  "overallConfidence": 0.75
}

## Signal Strength Mapping
- **weak**: Individual exploration (created first item, browsed content, signed up)
- **medium**: Learning the product (used template, completed tutorial, configured settings)
- **strong**: Realized core value (shared work, collaborated, achieved first outcome)
- **very_strong**: Team/habit adoption (multiple users active, regular usage pattern, expanded use)

## Primary Activation
The primaryActivation field indicates which level represents the "aha moment" - when the user first experiences the product's core value proposition.

For different product types:
- **Collaboration tools** (Miro, Figma, Notion): Primary is usually when sharing/collaboration happens
- **Productivity tools** (Linear, Asana): Primary is usually completing first workflow
- **Developer tools** (GitHub, Vercel): Primary is usually first deployment or integration
- **Communication tools** (Slack, Discord): Primary is usually first team conversation

## Criteria Requirements
Each criterion MUST have:
1. **action**: Specific verb (create, share, invite, complete, deploy, send)
2. **count**: Concrete number (1, 3, 5, 10)
3. **timeWindow** (optional): Time context (first_7d, first_14d, first_30d)

Good examples:
- {"action": "create_project", "count": 1}
- {"action": "invite_member", "count": 2, "timeWindow": "first_7d"}
- {"action": "complete_workflow", "count": 1}

Bad examples (avoid these):
- {"action": "use_product", "count": 1} - too vague
- {"action": "engage_with_features", "count": 5} - not specific
- {"action": "become_active", "count": 1} - not measurable

## Evidence Guidelines
For each level, include evidence excerpts that support your inference:
- Quote directly from onboarding guides, help docs, or feature descriptions
- Reference specific pages (getting started, tutorials, success stories)
- Higher confidence when evidence comes from help docs or case studies
- Lower confidence when inferring from marketing copy only

## Confidence Scoring
- **0.8-1.0**: Help docs or case studies explicitly describe these activation steps
- **0.6-0.8**: Feature pages and onboarding content support the levels
- **0.4-0.6**: Inferred from product description and general patterns
- **0.2-0.4**: Limited information, mostly based on product type patterns`;

// ============================================================================
// Page Filtering
// ============================================================================

// Page types relevant for activation extraction, in priority order
const ACTIVATION_PAGE_TYPES = [
  "onboarding",
  "help",
  "customers",
  "features",
  "homepage",
];

// Priority order for sorting (lower = higher priority)
const PAGE_PRIORITY: Record<string, number> = {
  onboarding: 0,
  help: 1,
  customers: 2,
  features: 3,
  homepage: 4,
};

// Content limits
const MAX_CONTENT_PER_PAGE = 15_000;
const MAX_TOTAL_CONTENT = 40_000;

/**
 * Filter crawled pages to those relevant for activation extraction.
 * Prioritizes onboarding, help, customers, features, then homepage.
 */
export function filterActivationPages(
  pages: Array<{
    pageType: string;
    content: string;
    url: string;
    title?: string;
  }>
): Array<{ pageType: string; content: string; url: string; title?: string }> {
  // Filter to activation-relevant types
  const relevant = pages.filter((p) =>
    ACTIVATION_PAGE_TYPES.includes(p.pageType)
  );

  // Sort by priority (onboarding first, homepage last)
  relevant.sort((a, b) => {
    const aPriority = PAGE_PRIORITY[a.pageType] ?? 5;
    const bPriority = PAGE_PRIORITY[b.pageType] ?? 5;
    return aPriority - bPriority;
  });

  return relevant;
}

/**
 * Truncate content to a maximum character length, preserving whole lines.
 * Appends a truncation notice if content was shortened.
 */
export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;

  // Find the last newline before the limit
  const lastNewline = content.lastIndexOf("\n", maxLength);
  const cutPoint = lastNewline > 0 ? lastNewline : maxLength;
  return content.slice(0, cutPoint) + "\n\n[Content truncated]";
}

/**
 * Build the context string from crawled pages for the LLM prompt.
 * Each page is formatted with its URL, type, and truncated content.
 */
export function buildPageContext(
  pages: Array<{
    pageType: string;
    content: string;
    url: string;
    title?: string;
  }>
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

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse Claude's response text to extract the JSON activation levels result.
 * Handles responses with markdown code fences or raw JSON.
 * Validates all required fields and clamps confidence values.
 */
export function parseActivationLevelsResponse(
  responseText: string
): ActivationLevelsResult {
  // Try to extract JSON from code fences first
  const fenceMatch = responseText.match(
    /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/
  );
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();

  const parsed = JSON.parse(jsonStr);

  // Validate top-level fields
  if (!Array.isArray(parsed.levels)) {
    throw new Error("Missing required field: levels (must be array)");
  }
  if (typeof parsed.primaryActivation !== "number") {
    throw new Error(
      "Missing required field: primaryActivation (must be number)"
    );
  }
  if (typeof parsed.overallConfidence !== "number") {
    throw new Error(
      "Missing required field: overallConfidence (must be number)"
    );
  }

  // Validate each level
  for (let i = 0; i < parsed.levels.length; i++) {
    const level = parsed.levels[i];
    if (typeof level.level !== "number") {
      throw new Error(`Level ${i}: missing level number`);
    }
    if (typeof level.name !== "string") {
      throw new Error(`Level ${i}: missing name`);
    }
    if (!VALID_SIGNAL_STRENGTHS.includes(level.signalStrength)) {
      throw new Error(
        `Level ${i}: invalid signalStrength "${level.signalStrength}". Must be one of: ${VALID_SIGNAL_STRENGTHS.join(", ")}`
      );
    }
    if (!Array.isArray(level.criteria)) {
      throw new Error(`Level ${i}: criteria must be array`);
    }
    if (typeof level.confidence !== "number") {
      throw new Error(`Level ${i}: missing confidence`);
    }

    // Validate criteria
    for (let j = 0; j < level.criteria.length; j++) {
      const criterion = level.criteria[j];
      if (typeof criterion.action !== "string") {
        throw new Error(`Level ${i}, criterion ${j}: missing action`);
      }
      if (typeof criterion.count !== "number") {
        throw new Error(`Level ${i}, criterion ${j}: missing count`);
      }
    }
  }

  // Sort levels by level number
  parsed.levels.sort(
    (a: { level: number }, b: { level: number }) => a.level - b.level
  );

  // Clamp overall confidence
  parsed.overallConfidence = Math.max(
    0,
    Math.min(1, parsed.overallConfidence)
  );

  // Clamp each level's confidence and clean up evidence
  for (const level of parsed.levels) {
    level.confidence = Math.max(0, Math.min(1, level.confidence));

    // Ensure evidence array exists and clean it up
    if (!Array.isArray(level.evidence)) {
      level.evidence = [];
    } else {
      level.evidence = level.evidence.map(
        (e: { url?: string; excerpt?: string }) => ({
          url: String(e.url || ""),
          excerpt: String(e.excerpt || ""),
        })
      );
    }

    // Ensure criteria have optional timeWindow cleaned up
    level.criteria = level.criteria.map(
      (c: { action: string; count: number; timeWindow?: string }) => {
        const criterion: ActivationCriterion = {
          action: c.action,
          count: c.count,
        };
        if (c.timeWindow) {
          criterion.timeWindow = c.timeWindow;
        }
        return criterion;
      }
    );
  }

  // Validate primaryActivation references an existing level
  const levelNumbers = parsed.levels.map((l: { level: number }) => l.level);
  if (!levelNumbers.includes(parsed.primaryActivation)) {
    throw new Error(
      `primaryActivation ${parsed.primaryActivation} does not match any level number. Available levels: ${levelNumbers.join(", ")}`
    );
  }

  return parsed as ActivationLevelsResult;
}

// ============================================================================
// Internal Action
// ============================================================================

/**
 * Extract multi-level activation from crawled pages using Claude Haiku.
 *
 * Flow:
 * 1. Fetch crawled pages for the product
 * 2. Filter to activation-relevant pages (onboarding, help, customers, features)
 * 3. Get product identity for context (helps with value prop identification)
 * 4. Build prompt with page content
 * 5. Call Claude Haiku for structured extraction
 * 6. Parse response and store on product profile under definitions.activation
 */
export const extractActivationLevels = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // 1. Fetch crawled pages
    const pages = await ctx.runQuery(
      internal.crawledPages.listByProductInternal,
      {
        productId: args.productId,
      }
    );

    if (pages.length === 0) {
      throw new Error("No crawled pages found for product");
    }

    // 2. Filter to activation-relevant pages
    const activationPages = filterActivationPages(pages);

    if (activationPages.length === 0) {
      throw new Error(
        "No activation-relevant pages found (need onboarding, help, customers, features, or homepage)"
      );
    }

    // 3. Build page context
    const pageContext = buildPageContext(activationPages);

    // 4. Get product identity for context
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });

    let identityContext = "";
    if (profile?.identity) {
      identityContext = `Product: ${profile.identity.productName}
Description: ${profile.identity.description}
Target Customer: ${profile.identity.targetCustomer}
Business Model: ${profile.identity.businessModel}

`;
    }

    // 5. Call Claude Haiku
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 2048,
      system: ACTIVATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${identityContext}Extract activation levels from these website pages:\n\n${pageContext}`,
        },
      ],
    });

    // 6. Parse response
    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const activationResult = parseActivationLevelsResponse(textContent);

    // 7. Convert to the schema format for definitions.activation
    // The schema expects: criteria (array of strings), timeWindow, reasoning, confidence, source, evidence
    const primaryLevel = activationResult.levels.find(
      (l) => l.level === activationResult.primaryActivation
    );

    const activationData = {
      // Convert criteria to string array format for schema compatibility
      criteria: primaryLevel
        ? primaryLevel.criteria.map((c) =>
            c.timeWindow
              ? `${c.action} >= ${c.count} (${c.timeWindow})`
              : `${c.action} >= ${c.count}`
          )
        : [],
      timeWindow: primaryLevel?.criteria.find((c) => c.timeWindow)?.timeWindow,
      reasoning: primaryLevel?.reasoning || "Extracted from product content",
      confidence: activationResult.overallConfidence,
      source: "extraction",
      evidence: primaryLevel?.evidence || [],
      // Also store the full multi-level data for future use
      levels: activationResult.levels.map((level) => ({
        level: level.level,
        name: level.name,
        signalStrength: level.signalStrength,
        criteria: level.criteria,
        reasoning: level.reasoning,
        confidence: level.confidence,
        evidence: level.evidence,
      })),
      primaryActivation: activationResult.primaryActivation,
    };

    // 8. Ensure product profile exists
    await ctx.runMutation(internal.productProfiles.createInternal, {
      productId: args.productId,
    });

    // 9. Get current definitions to merge
    const currentProfile = await ctx.runQuery(
      internal.productProfiles.getInternal,
      {
        productId: args.productId,
      }
    );

    const currentDefinitions = currentProfile?.definitions || {};

    // 10. Store on profile under definitions.activation
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "definitions",
      data: {
        ...currentDefinitions,
        activation: activationData,
      },
    });

    return activationResult;
  },
});
