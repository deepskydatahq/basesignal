// Output Orchestration for M004: Actionable Output Generation
// Runs all output generators in sequence and returns complete OutputGenerationResult

import { action, internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import type {
  OutputGenerationResult,
  ICPProfile,
  ActivationMap,
  MeasurementSpec,
} from "./types";

export interface OrchestrationResult {
  productId: string;
  icp_profiles: ICPProfile[];
  activation_map: ActivationMap | null;
  measurement_spec: MeasurementSpec | null;
  errors?: string[];
  generated_at: string;
  execution_time_ms: number;
}

/**
 * Orchestrates all output generators in sequence:
 * 1. ICP profiles (independent)
 * 2. Activation map (independent)
 * 3. Measurement spec (uses ICP and map)
 *
 * Errors in one generator don't block others - partial results are returned.
 */
export const generateAllOutputs = internalAction({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }): Promise<OrchestrationResult> => {
    const start = Date.now();
    const errors: string[] = [];

    // 1. Generate ICP profiles
    let icp_profiles: ICPProfile[] = [];
    try {
      icp_profiles = await ctx.runAction(
        internal.analysis.outputs.generateICPProfiles.generateICPProfiles,
        { productId },
      );
    } catch (e) {
      errors.push(`ICP generation failed: ${e}`);
    }

    // 2. Generate activation map
    let activation_map: ActivationMap | null = null;
    try {
      activation_map = await ctx.runAction(
        internal.analysis.outputs.generateActivationMap.generateActivationMap,
        { productId },
      );
    } catch (e) {
      errors.push(`Activation map generation failed: ${e}`);
    }

    // 3. Generate measurement spec (uses ICP and map)
    let measurement_spec: MeasurementSpec | null = null;
    try {
      measurement_spec = await ctx.runAction(
        internal.analysis.outputs.generateMeasurementSpec.generateMeasurementSpec,
        { productId },
      );
    } catch (e) {
      errors.push(`Measurement spec generation failed: ${e}`);
    }

    return {
      productId,
      icp_profiles,
      activation_map,
      measurement_spec,
      errors: errors.length > 0 ? errors : undefined,
      generated_at: new Date().toISOString(),
      execution_time_ms: Date.now() - start,
    };
  },
});

/**
 * Public test action for manual triggering via Convex dashboard.
 * Runs the full orchestration and logs summary statistics.
 */
export const testGenerateAllOutputs = action({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const result = await ctx.runAction(
      internal.analysis.outputs.orchestrate.generateAllOutputs,
      { productId },
    );

    console.log(`=== Output Generation Complete ===`);
    console.log(`ICP Profiles: ${result.icp_profiles.length}`);
    console.log(`Activation Map Stages: ${result.activation_map?.stages.length ?? 0}`);
    console.log(`Measurement Events: ${result.measurement_spec?.total_events ?? 0}`);
    console.log(`Time: ${result.execution_time_ms}ms`);
    if (result.errors) {
      console.log(`Errors: ${result.errors.join(", ")}`);
    }

    return result;
  },
});
