<<<<<<< HEAD
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import type { MeasurementInputData } from "./types";

/**
 * Pure core function that extracts the four required sections from a product profile
 * and assembles them into MeasurementInputData.
 *
 * Validates that all required sections exist and throws a single error listing
 * any missing dependencies.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aggregateMeasurementInputsCore(profile: Record<string, any>): MeasurementInputData {
  const missing: string[] = [];

  if (!Array.isArray(profile.convergence?.value_moments)) {
    missing.push("convergence.value_moments");
  }
  if (!Array.isArray(profile.definitions?.activation?.levels)) {
    missing.push("definitions.activation");
  }
  if (!Array.isArray(profile.icpProfiles)) {
    missing.push("icpProfiles");
  }
  if (!profile.activationMap?.stages) {
    missing.push("activationMap");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required profile sections: ${missing.join(", ")}`);
  }

  return {
    value_moments: profile.convergence.value_moments,
    activation_levels: profile.definitions.activation.levels,
    icp_profiles: profile.icpProfiles,
    activation_map: profile.activationMap,
  };
}

/**
 * Convex internalAction wrapper.
 * Fetches the product profile via getInternal and delegates to the pure core function.
 */
export const aggregateMeasurementInputs = internalAction({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });
=======
// Stub: Aggregate measurement inputs from product profile
// Full implementation tracked in M004-E004-S001

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import type {
  MeasurementInputData,
  ValueMoment,
  ActivationLevel,
  ICPProfile,
  ActivationMap,
} from "./types";

/**
 * Convert an action string like "create_first_issue" to entity_action format "issue_created".
 * Basic heuristic — the LLM will refine these suggestions.
 */
function suggestEventName(action: string): string {
  const cleaned = action
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, "")
    .trim();
  const words = cleaned.split(/[\s_]+/).filter(Boolean);
  if (words.length < 2) return cleaned || "unknown_action";
  return words.join("_");
}

export const aggregateMeasurementInputs = internalAction({
  args: { productId: v.id("products") },
  handler: async (ctx, args): Promise<MeasurementInputData> => {
    const profile = await ctx.runQuery(
      internal.productProfiles.getInternal,
      { productId: args.productId },
    );
>>>>>>> 18422f3 (feat: implement LLM-powered measurement spec generator)

    if (!profile) {
      throw new Error("Product profile not found");
    }

<<<<<<< HEAD
    return aggregateMeasurementInputsCore(profile);
=======
    // Extract value moments from convergence results
    const convergence = profile.convergence as
      | { value_moments?: ValueMoment[] }
      | undefined;
    const valueMoments: ValueMoment[] = convergence?.value_moments ?? [];

    // Extract activation levels from definitions
    const definitions = profile.definitions as
      | { activation?: { levels?: ActivationLevel[] } }
      | undefined;
    const activationLevels: ActivationLevel[] =
      definitions?.activation?.levels ?? [];

    // Extract ICP profiles (if generated)
    const outputs = profile.outputs as
      | { icp_profiles?: ICPProfile[]; activation_map?: ActivationMap }
      | undefined;
    const icpProfiles: ICPProfile[] = outputs?.icp_profiles ?? [];
    const activationMap: ActivationMap | null =
      outputs?.activation_map ?? null;

    // Build event templates from activation criteria
    const activationEventTemplates = activationLevels.map((al) => ({
      level: al.level,
      criteria: al.criteria,
      suggested_event_name: al.criteria[0]
        ? suggestEventName(al.criteria[0].action)
        : `level_${al.level}_reached`,
    }));

    // Build event templates from value moments
    const valueEventTemplates = valueMoments.map((vm) => ({
      moment_id: vm.id,
      moment_name: vm.name,
      tier: vm.tier,
      surfaces: vm.product_surfaces,
      suggested_event_name: suggestEventName(vm.name),
    }));

    return {
      value_moments: valueMoments,
      activation_levels: activationLevels,
      icp_profiles: icpProfiles,
      activation_map: activationMap,
      activation_event_templates: activationEventTemplates,
      value_event_templates: valueEventTemplates,
    };
>>>>>>> 18422f3 (feat: implement LLM-powered measurement spec generator)
  },
});
