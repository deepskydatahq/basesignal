import type { ConfidenceLevel } from "./common";

/** Analytical lens type — the 7 value-extraction lenses. */
export type AnalyticalLensType =
  | "capability_mapping"
  | "effort_elimination"
  | "info_asymmetry"
  | "decision_enablement"
  | "state_transitions"
  | "time_compression"
  | "artifact_creation";

/** A single value-moment candidate discovered by an analytical lens. */
export interface LensCandidate {
  /** Unique identifier for this candidate. */
  id: string;
  /** Which lens discovered this candidate. */
  lens: AnalyticalLensType;
  /** Short name for the value moment. */
  name: string;
  /** Longer description of the value delivered. */
  description: string;
  /** Target user role. */
  role: string;
  /** Confidence level of this candidate. */
  confidence: ConfidenceLevel;
  /** URLs of pages that provided evidence. */
  source_urls: string[];

  // Lens-specific optional fields
  /** Features that enable this capability (capability_mapping). */
  enabling_features?: string[];
  /** Effort that is eliminated (effort_elimination). */
  effort_eliminated?: string;
  /** Information gained (info_asymmetry). */
  information_gained?: string;
  /** Decision enabled (decision_enablement). */
  decision_enabled?: string;
  /** State transition described (state_transitions). */
  state_transition?: string;
  /** Time compression achieved (time_compression). */
  time_compression?: string;
  /** Type of artifact created (artifact_creation). */
  artifact_type?: string;
}

/** Result from running a single analytical lens. */
export interface LensResult {
  /** Which lens produced this result. */
  lens: AnalyticalLensType;
  /** Candidates discovered by this lens. */
  candidates: LensCandidate[];
  /** Number of candidates found. */
  candidate_count: number;
  /** Time taken to run this lens in milliseconds. */
  execution_time_ms: number;
}

/** Aggregated result from running all analytical lenses. */
export interface AllLensesResult {
  /** Product this analysis was performed on. */
  productId: string;
  /** All candidates across all lenses. */
  candidates: LensCandidate[];
  /** Per-lens summary stats. */
  per_lens: Array<{
    lens: AnalyticalLensType;
    candidate_count: number;
    execution_time_ms: number;
  }>;
  /** Total candidate count across all lenses. */
  total_candidates: number;
  /** Total execution time in milliseconds. */
  execution_time_ms: number;
  /** Errors encountered during lens execution. */
  errors: Array<{ lens: AnalyticalLensType; error: string }>;
}
