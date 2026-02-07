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
  id: string;
  lens: LensType;
  name: string;
  description: string;
  role: string;
  confidence: ConfidenceLevel;
  source_urls: string[];

  // Lens-specific fields (only one populated per candidate)
  enabling_features?: string[]; // Lens 1: Capability Mapping
  effort_eliminated?: string; // Lens 2: Effort Elimination
  information_gained?: string; // Lens 3: Info Asymmetry
  decision_enabled?: string; // Lens 4: Decision Enablement
  state_transition?: string; // Lens 5: State Transitions
  time_compression?: string; // Lens 6: Time Compression
  artifact_type?: string; // Lens 7: Artifact Creation
}

export interface LensResult {
  lens: LensType;
  candidates: LensCandidate[];
  total_candidates: number;
  execution_time_ms: number;
}
