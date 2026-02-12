// Types for the convergence pipeline (M003-E002)

export type LensType =
  | "jtbd"
  | "outcomes"
  | "pains"
  | "gains"
  | "alternatives"
  | "workflows"
  | "emotions";

export type ValidationStatus = "valid" | "rewritten" | "removed";

export interface ValidatedCandidate {
  id: string;
  lens: LensType;
  name: string;
  description: string;
  confidence: number;
  validation_status: ValidationStatus;
  validation_issue?: string;
  rewritten_from?: { name: string; description: string };
}

export interface CandidateCluster {
  cluster_id: string;
  candidates: ValidatedCandidate[];
  lens_count: number;
  lenses: LensType[];
}

export type ValueMomentTier = 1 | 2 | 3;

export interface ValueMoment {
  id: string;
  name: string;
  description: string;
  tier: ValueMomentTier;
  lenses: LensType[];
  lens_count: number;
  roles: string[];
  product_surfaces: string[];
  contributing_candidates: string[];
}

export type QualityStatus = "pass" | "warn" | "fail";

export interface QualityCheck {
  name: string;
  status: QualityStatus;
  message: string;
}

export interface QualityReport {
  overall: QualityStatus;
  checks: QualityCheck[];
}

export interface ConvergenceResult {
  value_moments: ValueMoment[];
  clusters: CandidateCluster[];
  stats: {
    total_candidates: number;
    total_clusters: number;
    total_moments: number;
    tier_1_count: number;
    tier_2_count: number;
    tier_3_count: number;
  };
  quality?: QualityReport;
}
