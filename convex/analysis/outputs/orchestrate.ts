import { action, internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import type { OutputGenerationResult } from "./types";

export const GENERATION_STEPS = [
  "icp",
  "activation_map",
  "measurement_spec",
] as const;

export type GenerationStep = (typeof GENERATION_STEPS)[number];

export const generateAllOutputs = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args): Promise<OutputGenerationResult> => {
    const startTime = Date.now();
    const errors: Array<{ step: string; error: string }> = [];

    // Step 1: Generate ICP profiles
    let icp_profiles: OutputGenerationResult["icp_profiles"] = [];
    try {
      const icpResult = await ctx.runAction(
        internal.analysis.outputs.generateICPProfiles.generateICPProfiles,
        { productId: args.productId },
      );
      icp_profiles = icpResult.profiles;
    } catch (e) {
      errors.push({ step: "icp", error: String(e) });
    }

    // Step 2: Generate activation map
    let activation_map: OutputGenerationResult["activation_map"] = null;
    try {
      activation_map = await ctx.runAction(
        internal.analysis.outputs.generateActivationMap.generateActivationMap,
        { productId: args.productId },
      );
    } catch (e) {
      errors.push({ step: "activation_map", error: String(e) });
    }

    // Step 3: Generate measurement spec
    let measurement_spec: OutputGenerationResult["measurement_spec"] = null;
    try {
      measurement_spec = await ctx.runAction(
        internal.analysis.outputs.generateMeasurementSpec
          .generateMeasurementSpec,
        { productId: args.productId },
      );
    } catch (e) {
      errors.push({ step: "measurement_spec", error: String(e) });
    }

    const result: OutputGenerationResult = {
      productId: args.productId,
      icp_profiles,
      activation_map,
      measurement_spec,
      generated_at: new Date().toISOString(),
      execution_time_ms: Date.now() - startTime,
    };

    if (errors.length > 0) {
      result.errors = errors;
    }

    return result;
  },
});

export const testGenerateAllOutputs = action({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runAction(
      internal.analysis.outputs.orchestrate.generateAllOutputs,
      { productId: args.productId },
    );

    console.log(
      `[testGenerateAllOutputs] ICP profiles: ${result.icp_profiles.length}, ` +
        `map stages: ${result.activation_map?.stages?.length ?? 0}, ` +
        `spec events: ${result.measurement_spec?.events?.length ?? 0}, ` +
        `time: ${result.execution_time_ms}ms, ` +
        `errors: ${result.errors?.length ?? 0}`,
    );

    return result;
  },
});
