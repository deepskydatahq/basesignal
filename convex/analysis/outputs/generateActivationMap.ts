import { action, internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { callClaude, extractJson } from "../lenses/shared";
import type { ActivationLevel, ActivationLevelsResult } from "../extractActivationLevels";
import type { ValueMoment } from "../convergence/types";

// --- Types ---

export interface ActivationMapStage {
  level: number;
  name: string;
  signal_strength: string;
  trigger_events: string[];
  value_moments_unlocked: string[];
  drop_off_risk: {
    level: string;
    reason: string;
  };
}

export interface ActivationMapTransition {
  from_level: number;
  to_level: number;
  trigger_events: string[];
  typical_timeframe?: string;
}

export interface ActivationMap {
  stages: ActivationMapStage[];
  transitions: ActivationMapTransition[];
  primary_activation_level: number;
  confidence: string;
  sources: string[];
}

// --- System Prompt ---

export const ACTIVATION_MAP_SYSTEM_PROMPT = `You are a product analyst generating an activation map from activation levels and value moments.

An activation map shows how users progress through stages of increasing engagement, what triggers each transition, what value they unlock at each stage, and where they are most likely to drop off.

## Input

You will receive:
1. Activation levels with signal strengths and criteria
2. Value moments with tiers, roles, and descriptions
3. The primary activation level number (the "aha moment")

## Output Requirements

Return a single JSON object with this structure:

{
  "stages": [
    {
      "level": 1,
      "name": "explorer",
      "signal_strength": "weak",
      "trigger_events": ["create_first_board", "browse_templates"],
      "value_moments_unlocked": ["Quick template setup"],
      "drop_off_risk": {
        "level": "medium",
        "reason": "Users may not see enough value before committing time"
      }
    }
  ],
  "transitions": [
    {
      "from_level": 1,
      "to_level": 2,
      "trigger_events": ["complete_tutorial", "customize_workspace"],
      "typical_timeframe": "1-3 days"
    }
  ],
  "primary_activation_level": 2,
  "confidence": "medium",
  "sources": ["activation_levels", "value_moments"]
}

## Rules

1. Create exactly ONE stage per activation level — the stages count must equal the activation levels count
2. Each stage MUST have trigger_events derived from that level's activation criteria actions
3. Distribute value moments across stages by tier:
   - Tier 3 (single-lens, weaker signal) → early stages (weak/medium signal strength)
   - Tier 2 (multi-lens) → middle stages
   - Tier 1 (strongest signal, team outcomes) → later stages (strong/very_strong signal strength)
4. Value moments MUST be distributed across at least 2 different stages — do NOT put all value moments on one stage
5. At least one stage MUST have drop_off_risk.level of "medium" or "high"
6. The transition from individual to team adoption (typically L1→L2 or L2→L3) should have "medium" or "high" drop-off risk
7. Set primary_activation_level to the level number where core value is realized (the "aha moment")
8. Transitions connect consecutive levels with trigger_events describing what actions drive progression
9. Include typical_timeframe for transitions when inferrable from the data
10. Set confidence to "low", "medium", or "high" based on data quality
11. Set sources to describe what data informed the map (e.g., "activation_levels", "value_moments")

## Important

- Return ONLY valid JSON, no commentary before or after
- Stage names should match the activation level names
- Signal strengths should match the activation level signal strengths
- Every stage must have at least one trigger_event
- Every stage must have a drop_off_risk with both level and reason`;

// --- Prompt Builder ---

export function buildActivationMapUserPrompt(
  levels: ActivationLevel[],
  valueMoments: ValueMoment[],
  primaryActivation: number,
): string {
  const parts: string[] = [];

  parts.push("## Activation Levels\n");
  for (const level of levels) {
    parts.push(`### Level ${level.level}: ${level.name}`);
    parts.push(`Signal Strength: ${level.signalStrength}`);
    parts.push(`Confidence: ${level.confidence}`);
    parts.push("Criteria:");
    for (const c of level.criteria) {
      const tw = c.timeWindow ? ` within ${c.timeWindow}` : "";
      parts.push(`  - ${c.action} (count: ${c.count}${tw})`);
    }
    parts.push(`Reasoning: ${level.reasoning}`);
    parts.push("");
  }

  parts.push("## Value Moments\n");
  for (const vm of valueMoments) {
    parts.push(`### ${vm.name} (Tier ${vm.tier})`);
    parts.push(`Description: ${vm.description}`);
    parts.push(`Roles: ${vm.roles.join(", ")}`);
    parts.push(`Lenses: ${vm.lenses.join(", ")}`);
    parts.push(`Product Surfaces: ${vm.product_surfaces.join(", ")}`);
    parts.push("");
  }

  parts.push(`## Primary Activation Level: ${primaryActivation}`);
  parts.push(
    "This is the level where users realize core value (the 'aha moment').",
  );

  return parts.join("\n");
}

// --- Response Parser ---

export function parseActivationMapResponse(responseText: string): ActivationMap {
  const parsed = extractJson(responseText) as Record<string, unknown>;

  // Validate top-level fields
  if (!Array.isArray(parsed.stages)) {
    throw new Error("Missing required field: stages (must be array)");
  }
  if (!Array.isArray(parsed.transitions)) {
    throw new Error("Missing required field: transitions (must be array)");
  }
  if (typeof parsed.primary_activation_level !== "number") {
    throw new Error(
      "Missing required field: primary_activation_level (must be number)",
    );
  }
  if (typeof parsed.confidence !== "string") {
    throw new Error("Missing required field: confidence (must be string)");
  }
  if (!Array.isArray(parsed.sources)) {
    throw new Error("Missing required field: sources (must be array)");
  }

  // Validate each stage
  for (let i = 0; i < parsed.stages.length; i++) {
    const stage = parsed.stages[i] as Record<string, unknown>;

    if (typeof stage.level !== "number") {
      throw new Error(`Stage ${i} missing required field: level (must be number)`);
    }
    if (typeof stage.name !== "string" || !stage.name) {
      throw new Error(
        `Stage ${i} missing required field: name (must be non-empty string)`,
      );
    }
    if (typeof stage.signal_strength !== "string" || !stage.signal_strength) {
      throw new Error(
        `Stage ${i} missing required field: signal_strength (must be non-empty string)`,
      );
    }
    if (!Array.isArray(stage.trigger_events) || stage.trigger_events.length === 0) {
      throw new Error(
        `Stage ${i} missing required field: trigger_events (must be non-empty array)`,
      );
    }
    if (!Array.isArray(stage.value_moments_unlocked)) {
      throw new Error(
        `Stage ${i} missing required field: value_moments_unlocked (must be array)`,
      );
    }

    const dropOff = stage.drop_off_risk as Record<string, unknown> | undefined;
    if (!dropOff || typeof dropOff !== "object") {
      throw new Error(`Stage ${i} missing required field: drop_off_risk (must be object)`);
    }
    if (typeof dropOff.level !== "string" || !dropOff.level) {
      throw new Error(
        `Stage ${i} drop_off_risk missing required field: level (must be non-empty string)`,
      );
    }
    if (typeof dropOff.reason !== "string" || !dropOff.reason) {
      throw new Error(
        `Stage ${i} drop_off_risk missing required field: reason (must be non-empty string)`,
      );
    }
  }

  // Validate each transition
  for (let i = 0; i < parsed.transitions.length; i++) {
    const transition = parsed.transitions[i] as Record<string, unknown>;

    if (typeof transition.from_level !== "number") {
      throw new Error(
        `Transition ${i} missing required field: from_level (must be number)`,
      );
    }
    if (typeof transition.to_level !== "number") {
      throw new Error(
        `Transition ${i} missing required field: to_level (must be number)`,
      );
    }
    if (!Array.isArray(transition.trigger_events)) {
      throw new Error(
        `Transition ${i} missing required field: trigger_events (must be array)`,
      );
    }
  }

  // Sort stages by level ascending
  const stages = (parsed.stages as ActivationMapStage[]).sort(
    (a, b) => a.level - b.level,
  );

  // Validate primary_activation_level references an existing stage
  if (!stages.some((s) => s.level === parsed.primary_activation_level)) {
    throw new Error(
      `primary_activation_level ${parsed.primary_activation_level} does not match any stage level`,
    );
  }

  return {
    stages,
    transitions: parsed.transitions as ActivationMapTransition[],
    primary_activation_level: parsed.primary_activation_level as number,
    confidence: parsed.confidence as string,
    sources: (parsed.sources as unknown[]).map(String),
  };
}

// --- InternalAction ---

export const generateActivationMap = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // 1. Fetch profile
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });

    if (!profile) {
      throw new Error("Product profile not found");
    }

    // 2. Extract activation levels and value moments
    const definitions = profile.definitions as
      | { activation?: ActivationLevelsResult }
      | undefined;
    const convergence = profile.convergence as
      | { value_moments?: ValueMoment[] }
      | undefined;

    const activationData = definitions?.activation;
    if (!activationData || !activationData.levels || activationData.levels.length === 0) {
      throw new Error(
        "Product profile missing activation levels (definitions.activation)",
      );
    }

    const valueMoments = convergence?.value_moments;
    if (!valueMoments || valueMoments.length === 0) {
      throw new Error(
        "Product profile missing value moments (convergence.value_moments)",
      );
    }

    // 3. Build user prompt
    const userPrompt = buildActivationMapUserPrompt(
      activationData.levels,
      valueMoments,
      activationData.primaryActivation,
    );

    // 4. Call Claude Sonnet
    const responseText = await callClaude({
      system: ACTIVATION_MAP_SYSTEM_PROMPT,
      user: userPrompt,
      temperature: 0.2,
    });

    // 5. Parse response
    const activationMap = parseActivationMapResponse(responseText);

    // 6. Store result on profile
    const existingOutputs =
      (profile.outputs as Record<string, unknown>) ?? {};

    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "outputs",
      data: { ...existingOutputs, activationMap },
    });

    return activationMap;
  },
});

// Public test action for manual triggering
export const testGenerateActivationMap = action({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.runAction(
      internal.analysis.outputs.generateActivationMap.generateActivationMap,
      { productId: args.productId },
    );
  },
});
