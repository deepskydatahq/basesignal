/**
 * Types for the convergence pipeline.
 *
 * ValidatedCandidate is the input from the validation pass (S002).
 * CandidateCluster is the output of semantic clustering (S003).
 * ValueMoment and ConvergenceResult are the final pipeline output (S004).
 */

export type ValueMomentTier = 1 | 2 | 3;

export type ValidationStatus = "valid" | "rewritten" | "removed";

export interface ValidatedCandidate {
  id: string;
  lens: string;
  name: string;
  description: string;
  roles: string[];
  product_surfaces: string[];
  validation_status: ValidationStatus;
  validation_issue?: string;
  rewritten_from?: {
    name: string;
    description: string;
  };
}

export interface CandidateCluster {
  cluster_id: string;
  candidates: ValidatedCandidate[];
  lens_count: number;
  lenses: string[];
}

export interface ValueMoment {
  id: string;
  name: string;
  tier: ValueMomentTier;
  convergence_count: number;
  contributing_lenses: string[];
  description: string;
  roles: string[];
  product_surfaces: string[];
  contributing_candidates: string[];
}

export interface ConvergenceResult {
  productId: string;
  value_moments: ValueMoment[];
  tier_1_count: number;
  tier_2_count: number;
  tier_3_count: number;
  total_moments: number;
  execution_time_ms: number;
  validation_stats?: {
    total_candidates: number;
    valid: number;
    rewritten: number;
    removed: number;
  };
}
