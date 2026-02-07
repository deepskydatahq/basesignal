// Common output types for all 7 analytical lenses

export type LensType =
  | "capability_mapping"
  | "effort_elimination"
  | "info_asymmetry"
  | "decision_enablement"
  | "state_transitions"
  | "time_compression"
  | "artifact_creation";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface LensCandidate {
  // Shared fields (all lenses)
  id: string;
  lens: LensType;
  name: string;
  description: string;
  role: string;
  confidence: ConfidenceLevel;
  source_urls: string[];

  // Lens-specific optional fields
  enabling_features?: string[];
  effort_eliminated?: string;
  information_gained?: string;
  decision_enabled?: string;
  state_transition?: string;
  time_compression?: string;
  artifact_type?: string;
}

export interface LensResult {
  lens: LensType;
  candidates: LensCandidate[];
  candidate_count: number;
  execution_time_ms: number;
}
