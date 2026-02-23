// Completeness scoring for pipeline outputs.

export interface CompletenessInput {
  identity?: unknown;
  activation_levels?: unknown;
  icp_profiles?: unknown[];
  activation_map?: unknown;
  lifecycle_states?: unknown;
  measurement_spec?: unknown;
}

export interface CompletenessResult {
  completeness: number;
  sections: { name: string; present: boolean }[];
}

export const PIPELINE_SECTIONS = [
  "identity",
  "activation_levels",
  "icp_profiles",
  "activation_map",
  "lifecycle_states",
  "measurement_spec",
] as const;

export type PipelineSection = (typeof PIPELINE_SECTIONS)[number];

/**
 * Compute completeness score from pipeline outputs.
 * Returns a score between 0 and 1 (present sections / total sections).
 */
export function computeCompleteness(input: CompletenessInput): CompletenessResult {
  const sections: { name: string; present: boolean }[] = [
    { name: "identity", present: !!input.identity },
    { name: "activation_levels", present: !!input.activation_levels },
    { name: "icp_profiles", present: Array.isArray(input.icp_profiles) && input.icp_profiles.length > 0 },
    { name: "activation_map", present: !!input.activation_map },
    { name: "lifecycle_states", present: !!input.lifecycle_states },
    { name: "measurement_spec", present: !!input.measurement_spec },
  ];

  const present = sections.filter((s) => s.present).length;

  return {
    completeness: sections.length > 0 ? present / sections.length : 0,
    sections,
  };
}
