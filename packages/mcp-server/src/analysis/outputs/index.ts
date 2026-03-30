// Output generation orchestration: ICP profiles, activation map, measurement spec, lifecycle states.

import type { LlmProvider, OnProgress, PipelineError, ConvergenceResult, ICPProfile, IdentityResult, ActivationLevelsResult, MeasurementSpec, LifecycleStatesResult, ValueMoment } from "../types.js";
import type { OutcomeItem } from "@basesignal/core";
import { generateICPProfiles } from "./icp-profiles.js";
import { generateActivationMap, type ActivationMapResult } from "./activation-map.js";
import { generateLifecycleStates } from "./lifecycle-states.js";
import { generateMeasurementSpec, assembleMeasurementInput } from "./measurement-spec.js";
import { reconcileOutputs } from "./reconcile.js";
import { enrichValueMoments } from "./enrich-value-moments.js";
import { enrichOutcomes } from "./enrich-outcomes.js";
import { generateOutcomes } from "./generate-outcomes.js";

// Re-export
export { generateICPProfiles } from "./icp-profiles.js";
export { generateActivationMap } from "./activation-map.js";
export { generateLifecycleStates } from "./lifecycle-states.js";
export { generateMeasurementSpec, assembleMeasurementInput } from "./measurement-spec.js";
export { reconcileOutputs, buildEventVocabulary } from "./reconcile.js";
export { enrichValueMoments } from "./enrich-value-moments.js";
export { enrichOutcomes } from "./enrich-outcomes.js";
export { generateOutcomes } from "./generate-outcomes.js";

export interface OutputsResult {
  icp_profiles: ICPProfile[];
  activation_map: ActivationMapResult | null;
  lifecycle_states: LifecycleStatesResult | null;
  measurement_spec: MeasurementSpec | null;
  value_moments: ValueMoment[];
  enriched_outcomes: OutcomeItem[] | null;
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
  pageUrls?: string[],
): Promise<OutputsResult> {
  const result: OutputsResult = {
    icp_profiles: [],
    activation_map: null,
    lifecycle_states: null,
    measurement_spec: null,
    value_moments: convergence.value_moments,
    enriched_outcomes: null,
  };

  // 1. ICP profiles
  progress?.({ phase: "outputs_icp", status: "started" });
  try {
    result.icp_profiles = await generateICPProfiles(
      convergence.value_moments,
      identity?.targetCustomer ?? "",
      llm,
      pageUrls,
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

  // 3. Lifecycle states (requires activation levels + activation map + identity)
  if (activationLevels && result.activation_map && identity) {
    progress?.({ phase: "outputs_lifecycle_states", status: "started" });
    try {
      result.lifecycle_states = await generateLifecycleStates(
        {
          identity,
          value_moments: convergence.value_moments,
          activation_levels: activationLevels,
          activation_map: result.activation_map,
        },
        llm,
      );
      progress?.({ phase: "outputs_lifecycle_states", status: "completed" });
    } catch (e) {
      progress?.({ phase: "outputs_lifecycle_states", status: "failed", detail: String(e) });
      errors?.push({ phase: "outputs", step: "lifecycle_states", message: String(e) });
    }
  }

  // 4. Measurement spec (uses ICP, activation map, and lifecycle states)
  if (activationLevels) {
    progress?.({ phase: "outputs_measurement_spec", status: "started" });
    try {
      const inputData = assembleMeasurementInput(
        convergence.value_moments,
        activationLevels.levels,
        result.icp_profiles,
        result.activation_map,
        result.lifecycle_states ?? undefined,
        identity ? { description: identity.description, productName: identity.productName } : undefined,
        pageUrls,
      );
      result.measurement_spec = await generateMeasurementSpec(inputData, llm);
      progress?.({ phase: "outputs_measurement_spec", status: "completed" });
    } catch (e) {
      progress?.({ phase: "outputs_measurement_spec", status: "failed", detail: String(e) });
      errors?.push({ phase: "outputs", step: "measurement_spec", message: String(e) });
    }
  }

  // 5. Reconciliation (align trigger events to measurement spec vocabulary)
  if (result.measurement_spec) {
    progress?.({ phase: "outputs_reconciliation", status: "started" });
    try {
      const reconciled = await reconcileOutputs(result, llm);
      result.activation_map = reconciled.activation_map;
      result.lifecycle_states = reconciled.lifecycle_states;
      progress?.({ phase: "outputs_reconciliation", status: "completed" });
    } catch (e) {
      progress?.({ phase: "outputs_reconciliation", status: "failed", detail: String(e) });
      errors?.push({ phase: "outputs", step: "reconciliation", message: String(e) });
    }
  }

  // 6. Value moment enrichment (cross-reference with measurement spec and lifecycle states)
  if (result.measurement_spec) {
    progress?.({ phase: "outputs_enrichment", status: "started" });
    try {
      result.value_moments = await enrichValueMoments(
        convergence.value_moments,
        result.measurement_spec,
        result.lifecycle_states,
        llm,
      );
      progress?.({ phase: "outputs_enrichment", status: "completed" });
    } catch (e) {
      progress?.({ phase: "outputs_enrichment", status: "failed", detail: String(e) });
      errors?.push({ phase: "outputs", step: "enrichment", message: String(e) });
    }
  }

  // 7. Outcome generation (extract business outcomes from value moments, identity, ICP profiles)
  let outcomes: OutcomeItem[] = [];
  if (convergence.value_moments.length > 0) {
    progress?.({ phase: "outputs_outcome_generation", status: "started" });
    try {
      outcomes = await generateOutcomes(
        convergence.value_moments,
        identity,
        result.icp_profiles,
        llm,
        pageUrls,
      );
      progress?.({ phase: "outputs_outcome_generation", status: "completed", detail: `${outcomes.length} outcomes` });
    } catch (e) {
      progress?.({ phase: "outputs_outcome_generation", status: "failed", detail: String(e) });
      errors?.push({ phase: "outputs", step: "outcome_generation", message: String(e) });
    }
  }

  // 8. Outcome enrichment (cross-reference outcomes with measurement spec)
  if (result.measurement_spec && outcomes.length > 0) {
    progress?.({ phase: "outputs_outcome_enrichment", status: "started" });
    try {
      result.enriched_outcomes = await enrichOutcomes(
        outcomes,
        result.measurement_spec,
        llm,
      );
      progress?.({ phase: "outputs_outcome_enrichment", status: "completed" });
    } catch (e) {
      progress?.({ phase: "outputs_outcome_enrichment", status: "failed", detail: String(e) });
      errors?.push({ phase: "outputs", step: "outcome_enrichment", message: String(e) });
    }
  } else if (outcomes.length > 0) {
    // No measurement spec available — store unenriched outcomes
    result.enriched_outcomes = outcomes;
  }

  return result;
}
