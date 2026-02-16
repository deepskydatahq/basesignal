// Output generation orchestration: ICP profiles, activation map, measurement spec.

import type { LlmProvider, OnProgress, PipelineError, ConvergenceResult, ICPProfile, IdentityResult, ActivationLevelsResult, MeasurementSpec } from "../types.js";
import { generateICPProfiles } from "./icp-profiles.js";
import { generateActivationMap, type ActivationMapResult } from "./activation-map.js";
import { generateMeasurementSpec, assembleMeasurementInput } from "./measurement-spec.js";

// Re-export
export { generateICPProfiles } from "./icp-profiles.js";
export { generateActivationMap } from "./activation-map.js";
export { generateMeasurementSpec, assembleMeasurementInput } from "./measurement-spec.js";

export interface OutputsResult {
  icp_profiles: ICPProfile[];
  activation_map: ActivationMapResult | null;
  measurement_spec: MeasurementSpec | null;
}

/**
 * Generate all output artifacts from convergence + activation data.
 */
export async function generateAllOutputs(
  convergence: ConvergenceResult,
  activationLevels: ActivationLevelsResult | null,
  identity: IdentityResult | null,
  llm: LlmProvider,
  progress?: OnProgress,
  errors?: PipelineError[],
): Promise<OutputsResult> {
  const result: OutputsResult = {
    icp_profiles: [],
    activation_map: null,
    measurement_spec: null,
  };

  // 1. ICP profiles
  progress?.({ phase: "outputs_icp", status: "started" });
  try {
    result.icp_profiles = await generateICPProfiles(
      convergence.value_moments,
      identity?.targetCustomer ?? "",
      llm,
    );
    progress?.({ phase: "outputs_icp", status: "completed", detail: `${result.icp_profiles.length} profiles` });
  } catch (e) {
    progress?.({ phase: "outputs_icp", status: "failed", detail: String(e) });
    errors?.push({ phase: "outputs", step: "icp_profiles", message: String(e) });
  }

  // 2. Activation map (requires activation levels)
  if (activationLevels) {
    progress?.({ phase: "outputs_activation_map", status: "started" });
    try {
      result.activation_map = await generateActivationMap(
        activationLevels.levels,
        convergence.value_moments,
        activationLevels.primaryActivation,
        llm,
      );
      progress?.({ phase: "outputs_activation_map", status: "completed" });
    } catch (e) {
      progress?.({ phase: "outputs_activation_map", status: "failed", detail: String(e) });
      errors?.push({ phase: "outputs", step: "activation_map", message: String(e) });
    }
  }

  // 3. Measurement spec (uses ICP and activation map)
  if (activationLevels) {
    progress?.({ phase: "outputs_measurement_spec", status: "started" });
    try {
      const inputData = assembleMeasurementInput(
        convergence.value_moments,
        activationLevels.levels,
        result.icp_profiles,
        result.activation_map,
      );
      result.measurement_spec = await generateMeasurementSpec(inputData, llm);
      progress?.({ phase: "outputs_measurement_spec", status: "completed" });
    } catch (e) {
      progress?.({ phase: "outputs_measurement_spec", status: "failed", detail: String(e) });
      errors?.push({ phase: "outputs", step: "measurement_spec", message: String(e) });
    }
  }

  return result;
}
