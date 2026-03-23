// Outcome generation: extract business outcomes from value moments, identity, and ICP profiles.

import type { LlmProvider, ValueMoment, ICPProfile, IdentityResult } from "../types.js";
import type { OutcomeItem } from "@basesignal/core";
import { extractJson } from "@basesignal/core";

// --- System prompt ---

export const OUTCOMES_SYSTEM_PROMPT = `You are a product analyst identifying business outcomes from product analysis data.

## Instructions

You will receive:
1. Value moments discovered in the product (name, description, tier, roles, product_surfaces)
2. Identity information (product name, description, target customer)
3. ICP profiles (persona names, pain points, success metrics)

Generate 3-8 distinct business outcomes as a JSON array. Each outcome represents a measurable result that the product delivers.

## Outcome Types

Classify each outcome as one of:
- **business**: Revenue, retention, or growth outcomes (e.g., "Reduce customer churn by improving onboarding")
- **user**: End-user productivity or satisfaction outcomes (e.g., "Faster time-to-first-value for new users")
- **product**: Product adoption or engagement outcomes (e.g., "Increase feature discovery through guided workflows")

Include a mix of all three types.

## Linked Features

For each outcome, list the product surfaces and feature names that contribute to it. Extract these from the value moments' product_surfaces and names.

## Required Fields

Each outcome must include:
- description: A clear, specific outcome statement (1-2 sentences)
- type: One of "business", "user", or "product"
- linkedFeatures: Array of product surface or feature names that drive this outcome

## Output Format

Return ONLY a valid JSON array of outcome objects. No commentary, no markdown, no explanation.`;

// --- Pure functions ---

export function buildOutcomesPrompt(
  valueMoments: ValueMoment[],
  identity: IdentityResult | null,
  icpProfiles: ICPProfile[],
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

    return {
      description: obj.description,
      type: obj.type,
      linkedFeatures,
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
): Promise<OutcomeItem[]> {
  if (valueMoments.length === 0) {
    return [];
  }

  const prompt = buildOutcomesPrompt(valueMoments, identity, icpProfiles);

  const responseText = await llm.complete(
    [
      { role: "system", content: OUTCOMES_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3 },
  );

  return parseOutcomesResponse(responseText);
}
