import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import type { ICPProfile } from "./types";
import type { ConvergenceResult, ValueMoment } from "../convergence/types";
import { extractJson, callClaude } from "../lenses/shared";

// --- Types for buildICPPrompt input ---

export interface RoleInput {
  name: string;
  occurrence_count: number;
  tier_1_count: number;
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
- confidence: Number 0-1 reflecting how well-supported this persona is by the data

## Distinctness Requirement
Each persona MUST have distinct value_moment_priorities — they cannot share the same set of moment_ids. Personas should represent genuinely different user types with different needs.

## Output Format
Return ONLY a valid JSON array of 2-3 profile objects. No commentary, no markdown, no explanation.`;

// --- Pure functions ---

export function buildICPPrompt(
  roles: RoleInput[],
  targetCustomer: string,
): string {
  const parts: string[] = [];

  if (targetCustomer) {
    parts.push(`Target customer: ${targetCustomer}`);
  }

  if (roles.length > 0) {
    parts.push("\n## Roles Summary");
    for (const role of roles) {
      parts.push(
        `- ${role.name}: ${role.occurrence_count} occurrences, ${role.tier_1_count} Tier 1 value moments`,
      );
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
        activation_triggers: (item.activation_triggers as unknown[]).map(
          String,
        ),
        pain_points: (item.pain_points as unknown[]).map(String),
        success_metrics: (item.success_metrics as unknown[]).map(String),
        confidence,
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

// --- InternalAction ---

// TODO: Replace inline role aggregation with aggregateICPInputs when S001 (basesignal-uri) lands
function aggregateRoles(valueMoments: ValueMoment[]): RoleInput[] {
  const roleMap = new Map<string, RoleInput>();

  for (const vm of valueMoments) {
    for (const role of vm.roles) {
      if (!roleMap.has(role)) {
        roleMap.set(role, {
          name: role,
          occurrence_count: 0,
          tier_1_count: 0,
          value_moments: [],
        });
      }
      const entry = roleMap.get(role)!;
      entry.occurrence_count++;
      if (vm.tier === 1) entry.tier_1_count++;
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

export const generateICPProfiles = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ profiles: ICPProfile[]; execution_time_ms: number }> => {
    const startTime = Date.now();

    // 1. Fetch product profile
    const profile = await ctx.runQuery(
      internal.productProfiles.getInternal,
      { productId: args.productId },
    );
    if (!profile) {
      throw new Error("No product profile found");
    }

    // 2. Extract convergence value moments
    const convergence = (profile as Record<string, unknown>).convergence as
      | ConvergenceResult
      | undefined;
    const valueMoments = convergence?.value_moments ?? [];

    // 3. Extract target customer
    const identity = (profile as Record<string, unknown>).identity as
      | { targetCustomer?: string }
      | undefined;
    const targetCustomer = identity?.targetCustomer ?? "";

    // 4. Aggregate roles from value moments
    const roles = aggregateRoles(valueMoments);

    // 5. Build prompt
    const prompt = buildICPPrompt(roles, targetCustomer);

    // 6. Call Claude
    const responseText = await callClaude({
      system: ICP_SYSTEM_PROMPT,
      user: prompt,
      temperature: 0.3,
    });

    // 7. Parse response
    const profiles = parseICPProfiles(responseText);

    return {
      profiles,
      execution_time_ms: Date.now() - startTime,
    };
  },
});
