import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

/** Page types relevant for entity model extraction */
const RELEVANT_PAGE_TYPES = ["features", "pricing", "homepage", "about"];

const MAX_EVIDENCE_ITEMS = 10;

const SYSTEM_PROMPT = `You are an expert product analyst. Given website content from a SaaS product, extract the core entity model.

ENTITY TYPES:
- "actor": A user or account that performs actions (e.g., User, Admin, Team)
- "object": A thing that actors create or interact with (e.g., Project, Task, Document)
- "event": A measurable occurrence (e.g., Payment, Notification, Invitation)

RELATIONSHIP TYPES:
- Use verb phrases: "creates", "owns", "contains", "assigns", "manages", "subscribes_to", etc.
- Relationships go from actor/object to object (from → to)

RULES:
1. Extract 2-8 entities - focus on core product entities, not generic ones
2. Every entity must have at least one property
3. Properties should be inferred from the product context (not generic database fields like "id" or "created_at")
4. Relationships must reference entities by exact name
5. Confidence should reflect how clearly the content describes the entity model (0.0-1.0)
6. Evidence should cite specific page excerpts that support the extraction

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "items": [
    { "name": "string", "type": "actor|object|event", "properties": ["string"] }
  ],
  "relationships": [
    { "from": "entity_name", "to": "entity_name", "type": "verb_phrase" }
  ],
  "confidence": 0.0-1.0,
  "evidence": [
    { "url": "page_url", "excerpt": "relevant quote from page" }
  ]
}`;

/**
 * Extract text content from a Claude response.
 */
function extractText(response: { content: Array<{ type: string; text?: string }> }): string {
  return response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Parse JSON from LLM output, handling code block wrapping.
 */
function parseJsonResponse(text: string): unknown {
  // Strip code block wrappers if present
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }
  return JSON.parse(cleaned);
}

interface EntityItem {
  name: string;
  type: string;
  properties: string[];
}

interface EntityRelationship {
  from: string;
  to: string;
  type: string;
}

interface EvidenceItem {
  url: string;
  excerpt: string;
}

interface EntityExtractionResult {
  items: EntityItem[];
  relationships: EntityRelationship[];
  confidence: number;
  evidence: EvidenceItem[];
}

/**
 * Validate and normalize the LLM extraction result.
 */
function validateResult(raw: unknown): EntityExtractionResult {
  const result = raw as EntityExtractionResult;

  // Ensure arrays exist
  const items = Array.isArray(result.items) ? result.items : [];
  const relationships = Array.isArray(result.relationships) ? result.relationships : [];
  const evidence = Array.isArray(result.evidence) ? result.evidence : [];

  // Normalize items
  const normalizedItems = items.map((item) => ({
    name: String(item.name || ""),
    type: String(item.type || "object"),
    properties: Array.isArray(item.properties) ? item.properties.map(String) : [],
  }));

  // Filter relationships to only reference existing entities
  const entityNames = new Set(normalizedItems.map((i) => i.name));
  const normalizedRelationships = relationships
    .filter((r) => entityNames.has(r.from) && entityNames.has(r.to))
    .map((r) => ({
      from: String(r.from),
      to: String(r.to),
      type: String(r.type || "relates_to"),
    }));

  // Normalize confidence
  const confidence = typeof result.confidence === "number"
    ? Math.max(0, Math.min(1, result.confidence))
    : 0.5;

  // Cap evidence
  const normalizedEvidence = evidence.slice(0, MAX_EVIDENCE_ITEMS).map((e) => ({
    url: String(e.url || ""),
    excerpt: String(e.excerpt || ""),
  }));

  return {
    items: normalizedItems,
    relationships: normalizedRelationships,
    confidence,
    evidence: normalizedEvidence,
  };
}

/**
 * Build the user message from crawled pages.
 */
function buildPageSections(
  pages: Array<{ url: string; pageType: string; content: string }>
): string {
  return pages
    .map((page) => `=== ${page.pageType.toUpperCase()} (${page.url}) ===\n${page.content}`)
    .join("\n\n");
}

/**
 * Extract entity model from crawled product pages using Claude.
 *
 * Fetches crawled pages (features, pricing, homepage, about), sends them to
 * Claude Haiku for entity extraction, and stores the result in the product profile.
 */
export const extractEntities = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // Verify profile exists
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });
    if (!profile) {
      throw new Error("Profile not found");
    }

    // Fetch crawled pages
    const allPages = await ctx.runQuery(internal.crawledPages.listByProductInternal, {
      productId: args.productId,
    });

    // Filter to relevant page types
    const relevantPages = allPages.filter((page) =>
      RELEVANT_PAGE_TYPES.includes(page.pageType)
    );

    // If no pages, store empty entities
    if (relevantPages.length === 0) {
      await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
        productId: args.productId,
        section: "entities",
        data: {
          items: [],
          relationships: [],
          confidence: 0,
          evidence: [],
        },
      });
      return;
    }

    // Build prompt from pages
    const pageSections = buildPageSections(relevantPages);
    const userMessage = `Analyze the following product website content and extract the entity model:\n\n${pageSections}`;

    // Call Claude
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Parse and validate response
    const text = extractText(response);
    const raw = parseJsonResponse(text);
    const result = validateResult(raw);

    // Store in profile
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "entities",
      data: result,
    });
  },
});
