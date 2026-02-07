// TODO: replace with S001 types when merged

export type LensType =
  | "info_asymmetry"
  | "decision_enablement"
  | "state_transitions"
  | "capability_map"
  | "effort_value"
  | "activation_levels"
  | "outcome_chain";

export type ConfidenceLevel = "low" | "medium" | "high";

export interface LensCandidate {
  id: string;
  name: string;
  description: string;
  role: string;
  confidence: ConfidenceLevel;
  source_urls: string[];
  // Lens-specific fields (one per lens type)
  information_gained?: string;
  decision_enabled?: string;
  state_transition?: string;
  capability?: string;
  effort_level?: string;
  outcome?: string;
}

export interface LensResult {
  lensType: LensType;
  candidates: LensCandidate[];
  overallConfidence: number;
}
