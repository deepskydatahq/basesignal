import { internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import type {
  ActivationLevel,
  ActivationLevelsResult,
} from "../extractActivationLevels";
import type {
  ValueMoment,
  ValueMomentTier,
  ConvergenceResult,
} from "../convergence/types";

// --- Types ---

export interface SuggestedMapping {
  moment_id: string;
  moment_name: string;
  tier: ValueMomentTier;
  suggested_level: number;
}

export interface ActivationInputData {
  activation_levels: ActivationLevel[];
  value_moments: ValueMoment[];
  suggested_mappings: SuggestedMapping[];
  primary_activation_level: number;
}

// --- Pure functions ---

const TIER_RATIOS: Record<ValueMomentTier, number> = {
  1: 0.75,
  2: 0.5,
  3: 0.25,
};

/**
 * Suggest an activation level for a value moment based on its tier.
 * Uses proportional scaling: T1→75%, T2→50%, T3→25% of maxLevel.
 * Always returns at least 1.
 */
export function suggestLevel(tier: ValueMomentTier, maxLevel: number): number {
  return Math.max(1, Math.ceil(maxLevel * TIER_RATIOS[tier]));
}

/**
 * Aggregate activation levels and value moments into a unified structure
 * for activation map generation. Pre-maps value moments to suggested
 * activation stages using proportional tier-based scaling.
 */
export function aggregateActivationInputs(
  activationResult: ActivationLevelsResult,
  convergenceResult: ConvergenceResult,
): ActivationInputData {
  const maxLevel = activationResult.levels.length;

  const suggested_mappings: SuggestedMapping[] =
    convergenceResult.value_moments.map((moment) => ({
      moment_id: moment.id,
      moment_name: moment.name,
      tier: moment.tier,
      suggested_level: suggestLevel(moment.tier, maxLevel),
    }));

  return {
    activation_levels: activationResult.levels,
    value_moments: convergenceResult.value_moments,
    suggested_mappings,
    primary_activation_level: activationResult.primaryActivation,
  };
}

// --- Convex internalQuery wrapper ---

export const aggregateActivationInputsQuery = internalQuery({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });

    if (!profile) {
      throw new Error("Product profile not found");
    }

    const definitions = profile.definitions as
      | { activation?: ActivationLevelsResult }
      | undefined;
    const convergence = profile.convergence as ConvergenceResult | undefined;

    if (!definitions?.activation) {
      throw new Error("Activation levels not found on product profile");
    }
    if (!convergence) {
      throw new Error("Convergence result not found on product profile");
    }

    return aggregateActivationInputs(definitions.activation, convergence);
  },
});
