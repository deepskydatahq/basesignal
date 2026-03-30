// ICP Profile generation.

import type { LlmProvider, ValueMoment, ICPProfile } from "../types.js";
import { extractJson } from "@basesignal/core";

// --- Types ---

export interface RoleInput {
  name: string;
  occurrence_count: number;
  tier_1_count: number;
  tier_2_count: number;
  tier_3_plus_count: number;
  value_moments: Array<{
    id: string;
    name: string;
    description: string;
    tier: number;
  }>;
}

// --- System prompt ---

export const ICP_SYSTEM_PROMPT = `You are a product analyst generating Ideal Customer Profiles (ICPs) from aggregated role and value moment data.

Generate exactly 2-3 distinct ICP profiles as a JSON array. Each profile represents a specific persona type that gets value from this product.

## Naming Guidelines
Use specific, role-based persona names that reflect the user's actual job function:
- GOOD: "Engineering Team Lead", "Growth Product Manager", "Data-Driven VP of Sales"
- BAD: "Power User", "Casual User", "Enterprise Customer"

Each name must contain the role context — a reader should understand the persona's job from the name alone.

## Required Fields
Each profile must include:
- name: Specific, role-based persona name
- description: 2-3 sentences describing this persona's context and goals
- value_moment_priorities: Array of { moment_id, priority (1-3), relevance_reason }. Each persona must prioritize different value moments — the moment_id sets must be distinct across personas.
- activation_triggers: Array of actions that signal this persona is getting value
- pain_points: Array of problems this persona faces without the product
- success_metrics: Array of measurable outcomes indicating success
- value_triggers: Array of specific product actions that indicate this persona is getting value (e.g., "Creates first audience segment with 100+ prospects"). These should be concrete, observable product interactions.
- value_moment_levels: Array of { level: "L1" | "L2", description: string }. L1 = Core daily workflow value. L2 = Enables something at scale or unlocks advanced capability.
- confidence: Number 0-1 reflecting how well-supported this persona is by the data
- citations: Array of 1-3 source references from the provided source pages supporting this profile's existence and characteristics. Each must include url (from Source Pages) and excerpt (10-30 word quote).

## Persona Prioritization
Distinguish between core daily users and evaluators/buyers:
- Core daily users: People who use the product as part of their regular workflow. The primary persona MUST represent who uses the product daily, not who the website promotes or who signs the purchase order.
- Evaluators/buyers: People who assess, purchase, or champion the product but do not use it daily (e.g., VPs evaluating tools, procurement teams, marketing personas featured on the website).

Rank roles by their Tier 1 value moment count. Roles with more Tier 1 moments are stronger candidates for the primary persona — Tier 1 moments represent the highest-value product interactions.

Confidence scores must reflect product-usage evidence, not marketing prominence. A role mentioned heavily on the website but with few Tier 1 value moments should receive lower confidence than a role with strong Tier 1 signal but less marketing visibility.

## Distinctness Requirement
Each persona MUST have distinct value_moment_priorities — they cannot share the same set of moment_ids. Personas should represent genuinely different user types with different needs.

## Output Format
Return ONLY a valid JSON array of 2-3 profile objects. No commentary, no markdown, no explanation.`;

// --- Pure functions ---

export function buildICPPrompt(
  roles: RoleInput[],
  targetCustomer: string,
  pageUrls?: string[],
): string {
  const parts: string[] = [];

  if (targetCustomer) {
    parts.push(`Target customer: ${targetCustomer}`);
  }

  if (roles.length > 0) {
    parts.push("\n## Roles Summary");
    for (const role of roles) {
      parts.push(
        `- ${role.name}: ${role.occurrence_count} occurrences (${role.tier_1_count} T1, ${role.tier_2_count} T2, ${role.tier_3_plus_count} T3+)`,
      );
    }

    // Prioritization Guidance: top roles by Tier 1 count
    const topRoles = [...roles]
      .sort((a, b) => b.tier_1_count - a.tier_1_count)
      .slice(0, 3);
    if (topRoles.length > 0) {
      parts.push("\n## Prioritization Guidance");
      parts.push(
        "Top roles by Tier 1 value moment count (strongest daily-user signal):",
      );
      for (const role of topRoles) {
        parts.push(`- ${role.name}: ${role.tier_1_count} Tier 1 moments`);
      }
    }

    parts.push("\n## Value Moments by Role");
    for (const role of roles) {
      parts.push(`\n### ${role.name}`);
      for (const vm of role.value_moments) {
        parts.push(
          `- [${vm.id}] ${vm.name} (Tier ${vm.tier}): ${vm.description}`,
        );
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

export function parseICPProfiles(responseText: string): ICPProfile[] {
  const parsed = extractJson(responseText);

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array of profiles, got ${typeof parsed}`);
  }

  if (parsed.length < 2 || parsed.length > 3) {
    throw new Error(
      `Expected 2-3 profiles, got ${parsed.length}`,
    );
  }

  const profiles: ICPProfile[] = parsed.map(
    (item: Record<string, unknown>, i: number) => {
      if (typeof item.name !== "string" || !item.name) {
        throw new Error(`Profile ${i} missing required field: name`);
      }
      if (typeof item.description !== "string" || !item.description) {
        throw new Error(`Profile ${i} missing required field: description`);
      }
      if (
        !Array.isArray(item.value_moment_priorities) ||
        item.value_moment_priorities.length === 0
      ) {
        throw new Error(
          `Profile ${i} missing required field: value_moment_priorities`,
        );
      }
      if (!Array.isArray(item.activation_triggers)) {
        throw new Error(
          `Profile ${i} missing required field: activation_triggers`,
        );
      }
      if (!Array.isArray(item.pain_points)) {
        throw new Error(`Profile ${i} missing required field: pain_points`);
      }
      if (!Array.isArray(item.success_metrics)) {
        throw new Error(`Profile ${i} missing required field: success_metrics`);
      }

      let confidence =
        typeof item.confidence === "number" ? item.confidence : 0.5;
      confidence = Math.max(0, Math.min(1, confidence));

      return {
        id: crypto.randomUUID(),
        name: item.name,
        description: item.description,
        value_moment_priorities: (
          item.value_moment_priorities as Array<Record<string, unknown>>
        ).map((vmp) => ({
          moment_id: String(vmp.moment_id ?? ""),
          priority: (typeof vmp.priority === "number"
            ? vmp.priority
            : 1) as 1 | 2 | 3,
          relevance_reason: String(vmp.relevance_reason ?? ""),
        })),
        activation_triggers: (item.activation_triggers as unknown[]).map(String),
        pain_points: (item.pain_points as unknown[]).map(String),
        success_metrics: (item.success_metrics as unknown[]).map(String),
        confidence,
        ...(Array.isArray(item.value_triggers) && {
          value_triggers: (item.value_triggers as unknown[]).map(String),
        }),
        ...(Array.isArray(item.value_moment_levels) && {
          value_moment_levels: (
            item.value_moment_levels as Array<Record<string, unknown>>
          ).map((vml) => ({
            level: String(vml.level ?? ""),
            description: String(vml.description ?? ""),
          })),
        }),
        ...(Array.isArray(item.citations) && {
          citations: (item.citations as Array<Record<string, unknown>>)
            .filter((c) => c && typeof c === "object")
            .map((c) => ({
              url: String(c.url || ""),
              excerpt: String(c.excerpt || ""),
            }))
            .filter((c) => c.url && c.excerpt),
        }),
        sources: [],
      };
    },
  );

  // Validate distinctness: no two profiles should have identical moment_id sets
  const momentIdSets = profiles.map((p) =>
    p.value_moment_priorities
      .map((vmp) => vmp.moment_id)
      .sort()
      .join(","),
  );
  for (let i = 0; i < momentIdSets.length; i++) {
    for (let j = i + 1; j < momentIdSets.length; j++) {
      if (momentIdSets[i] === momentIdSets[j]) {
        throw new Error(
          `Profiles ${i} and ${j} have identical value_moment_priorities — each persona must have distinct moment priorities`,
        );
      }
    }
  }

  return profiles;
}

/**
 * Aggregate roles from value moments for ICP prompt construction.
 */
export function aggregateRoles(valueMoments: ValueMoment[]): RoleInput[] {
  const roleMap = new Map<string, RoleInput>();

  for (const vm of valueMoments) {
    for (const role of vm.roles) {
      if (!roleMap.has(role)) {
        roleMap.set(role, {
          name: role,
          occurrence_count: 0,
          tier_1_count: 0,
          tier_2_count: 0,
          tier_3_plus_count: 0,
          value_moments: [],
        });
      }
      const entry = roleMap.get(role)!;
      entry.occurrence_count++;
      if (vm.tier === 1) entry.tier_1_count++;
      else if (vm.tier === 2) entry.tier_2_count++;
      else entry.tier_3_plus_count++;
      entry.value_moments.push({
        id: vm.id,
        name: vm.name,
        description: vm.description,
        tier: vm.tier,
      });
    }
  }

  return Array.from(roleMap.values());
}

// --- Generator ---

export async function generateICPProfiles(
  valueMoments: ValueMoment[],
  targetCustomer: string,
  llm: LlmProvider,
  pageUrls?: string[],
): Promise<ICPProfile[]> {
  const roles = aggregateRoles(valueMoments);
  const prompt = buildICPPrompt(roles, targetCustomer, pageUrls);

  const responseText = await llm.complete(
    [
      { role: "system", content: ICP_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3 },
  );

  return parseICPProfiles(responseText);
}
