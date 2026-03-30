// Outcome generation: extract business outcomes from value moments, identity, and ICP profiles.

import type { LlmProvider, ValueMoment, ICPProfile, IdentityResult } from "../types.js";
import type { OutcomeItem } from "@basesignal/core";
import { extractJson } from "@basesignal/core";

// --- System prompt ---

export const OUTCOMES_SYSTEM_PROMPT = `You are a product strategist identifying the concrete situation changes a product creates for its users and their organizations.

## Instructions

You will receive:
1. Value moments discovered in the product (name, description, tier, roles, product_surfaces)
2. Identity information (product name, description, target customer)
3. ICP profiles (persona names, pain points, success metrics)

Generate 3-8 distinct outcomes as a JSON array.

## What makes a good outcome

An outcome describes a **situation change** — what is true after that wasn't true before. It names a specific person or role, describes what they can now do differently, and explains the tangible consequence.

**Pattern:** [Who] can now [do concrete thing they couldn't before], which means [tangible business consequence].

**DO NOT** write outcomes that follow this anti-pattern: [business verb] + [abstract metric] + by [feature list]. That describes an activity, not an outcome.

### Examples

BAD: "Reduce customer acquisition cost by accelerating lead qualification through automated scoring."
GOOD: "SDR team qualifies the same pipeline with 40% fewer hours on manual research, shifting CAC from headcount-heavy to tool-heavy — which scales without linear hiring."

BAD: "Increase revenue pipeline velocity by enabling sales teams to respond to buying signals faster."
GOOD: "AEs act on buying signals the same day they fire — not two weeks later when the prospect has already shortlisted competitors. Pipeline that went cold during handoff now converts at the speed of buyer intent."

BAD: "Improve sales team productivity by eliminating manual prospect research."
GOOD: "An SDR sends 200 genuinely personalized emails per week instead of 40 generic ones — without tab-switching across research tools. The bottleneck shifts from finding prospects to handling the demand created."

BAD: "Accelerate time-to-first-value for new users through AI workflow generation."
GOOD: "A new user describes their workflow in plain language and has it running against live data in their first session — no documentation, no implementation partner, no 'we'll set that up next week.'"

The metric is evidence the outcome happened — it is NOT the outcome itself. Lead with the situation change.

## Outcome Types

Classify each outcome as one of:
- **business**: Changes in how the organization operates economically (cost structure shifts, revenue model changes, competitive position)
- **user**: Changes in how a specific person works day-to-day (what they stop doing, start doing, or do fundamentally differently)
- **product**: Changes in how users relate to the product itself (adoption inflection points, workflow shifts, dependency changes)

Include a mix of all three types.

## Linked Features

For each outcome, list the product surfaces and feature names that contribute to it. Extract these from the value moments' product_surfaces and names.

## Required Fields

Each outcome must include:
- description: A specific situation-change statement (2-3 sentences). Name the role/person, the concrete change, and the consequence.
- type: One of "business", "user", or "product"
- linkedFeatures: Array of product surface or feature names that drive this outcome
- citations: Array of 1-3 source references from the provided source pages. Each citation must include:
  - url: The exact URL from the Source Pages list below
  - excerpt: A brief quote (10-30 words) from that page that supports this outcome
  Only cite URLs that appear in the Source Pages section. If no source page directly supports a claim, omit citations for that outcome.

## Output Format

Return ONLY a valid JSON array of outcome objects. No commentary, no markdown, no explanation.`;

// --- Pure functions ---

export function buildOutcomesPrompt(
  valueMoments: ValueMoment[],
  identity: IdentityResult | null,
  icpProfiles: ICPProfile[],
  pageUrls?: string[],
): string {
  const parts: string[] = [];

  if (identity) {
    parts.push("## Product Identity");
    parts.push(`- Product: ${identity.productName}`);
    parts.push(`- Description: ${identity.description}`);
    parts.push(`- Target Customer: ${identity.targetCustomer}`);
  }

  if (valueMoments.length > 0) {
    parts.push("\n## Value Moments");
    for (const vm of valueMoments) {
      parts.push(`- [${vm.id}] ${vm.name} (Tier ${vm.tier}): ${vm.description}`);
      if (vm.product_surfaces.length > 0) {
        parts.push(`  Surfaces: ${vm.product_surfaces.join(", ")}`);
      }
      if (vm.roles.length > 0) {
        parts.push(`  Roles: ${vm.roles.join(", ")}`);
      }
    }
  }

  if (icpProfiles.length > 0) {
    parts.push("\n## ICP Profiles");
    for (const profile of icpProfiles) {
      parts.push(`\n### ${profile.name}`);
      parts.push(`Description: ${profile.description}`);
      if (profile.pain_points.length > 0) {
        parts.push(`Pain points: ${profile.pain_points.join("; ")}`);
      }
      if (profile.success_metrics.length > 0) {
        parts.push(`Success metrics: ${profile.success_metrics.join("; ")}`);
      }
    }
  }

  if (pageUrls && pageUrls.length > 0) {
    parts.push("\n## Source Pages");
    for (const url of pageUrls) {
      parts.push(url);
    }
  }

  return parts.join("\n");
}

/**
 * Parse and validate the LLM outcomes response.
 *
 * Expects a JSON array of OutcomeItem objects.
 * Throws on non-array input or entries missing required fields.
 */
export function parseOutcomesResponse(responseText: string): OutcomeItem[] {
  const parsed = extractJson(responseText);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of outcome items");
  }

  if (parsed.length === 0) {
    throw new Error("Expected at least 1 outcome item, got 0");
  }

  const results = parsed.map((entry: unknown, i: number) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Outcome entry ${i} must be an object`);
    }
    const obj = entry as Record<string, unknown>;

    if (typeof obj.description !== "string" || !obj.description) {
      throw new Error(`Outcome entry ${i} missing required field: description (must be non-empty string)`);
    }

    if (typeof obj.type !== "string" || !obj.type) {
      throw new Error(`Outcome entry ${i} missing required field: type (must be non-empty string)`);
    }

    const validTypes = ["business", "user", "product"];
    if (!validTypes.includes(obj.type)) {
      throw new Error(`Outcome entry ${i} has invalid type: "${obj.type}" (must be one of: ${validTypes.join(", ")})`);
    }

    if (!Array.isArray(obj.linkedFeatures)) {
      throw new Error(`Outcome entry ${i} missing required field: linkedFeatures (must be an array)`);
    }

    const linkedFeatures = obj.linkedFeatures.filter(
      (f: unknown) => typeof f === "string",
    ) as string[];

    const citations = Array.isArray(obj.citations)
      ? obj.citations
          .filter((c: unknown) => c && typeof c === "object")
          .map((c: Record<string, unknown>) => ({
            url: String(c.url || ""),
            excerpt: String(c.excerpt || ""),
          }))
          .filter((c) => c.url && c.excerpt)
      : undefined;

    return {
      description: obj.description,
      type: obj.type,
      linkedFeatures,
      ...(citations && citations.length > 0 ? { citations } : {}),
    };
  });

  // Deduplicate by description (enrichment matches by description)
  const seen = new Set<string>();
  const deduped = results.filter((item) => {
    if (seen.has(item.description)) return false;
    seen.add(item.description);
    return true;
  });

  return deduped;
}

// --- Generator ---

/**
 * Generate business outcomes from value moments, identity, and ICP profiles.
 *
 * Makes a single LLM call. Returns OutcomeItem[] or empty array when no value moments.
 */
export async function generateOutcomes(
  valueMoments: ValueMoment[],
  identity: IdentityResult | null,
  icpProfiles: ICPProfile[],
  llm: LlmProvider,
  pageUrls?: string[],
): Promise<OutcomeItem[]> {
  if (valueMoments.length === 0) {
    return [];
  }

  const prompt = buildOutcomesPrompt(valueMoments, identity, icpProfiles, pageUrls);

  const responseText = await llm.complete(
    [
      { role: "system", content: OUTCOMES_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3 },
  );

  return parseOutcomesResponse(responseText);
}
