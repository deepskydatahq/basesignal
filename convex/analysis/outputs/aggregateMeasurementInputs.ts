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

    if (!profile) {
      throw new Error("Product profile not found");
    }

    return aggregateMeasurementInputsCore(profile);
  },
});
