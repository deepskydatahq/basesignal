/** All experiential lens values — the experience-oriented lenses used in convergence. */
export const EXPERIENTIAL_LENS_TYPES = [
  "jtbd",
  "outcomes",
  "pains",
  "gains",
  "alternatives",
  "workflows",
  "emotions",
] as const;

/** Experiential lens type — derived from the lens values array. */
export type ExperientialLensType = (typeof EXPERIENTIAL_LENS_TYPES)[number];

/** Validation status for a candidate after quality checks. */
export type ValidationStatus = "valid" | "rewritten" | "removed";

/** A candidate that has been validated and potentially rewritten. */
export interface ValidatedCandidate {
  /** Unique identifier. */
  id: string;
  /** Experiential lens that produced this candidate. */
  lens: ExperientialLensType;
  /** Short name for the value moment. */
  name: string;
  /** Longer description of the value delivered. */
  description: string;
  /** Numeric confidence score (0-1). */
  confidence: number;
  /** Validation outcome. */
  validation_status: ValidationStatus;
  /** Description of validation issue, if any. */
  validation_issue?: string;
  /** Original name/description before rewrite. */
  rewritten_from?: { name: string; description: string };
}

/** A cluster of validated candidates that converge on a theme. */
export interface CandidateCluster {
  /** Unique cluster identifier. */
  cluster_id: string;
  /** Candidates belonging to this cluster. */
  candidates: ValidatedCandidate[];
  /** Number of distinct lenses represented. */
  lens_count: number;
  /** Which lenses contributed candidates. */
  lenses: ExperientialLensType[];
}

/** Tier classification for value moments (1 = highest). */
export type ValueMomentTier = 1 | 2 | 3;

/** A discovered value moment from convergence analysis. */
export interface ValueMoment {
  /** Unique identifier. */
  id: string;
  /** Short name for the value moment. */
  name: string;
  /** Longer description of the value delivered. */
  description: string;
  /** Tier classification (1 = highest convergence). */
  tier: ValueMomentTier;
  /** Lenses that contributed to this moment. */
  lenses: ExperientialLensType[];
  /** Number of lenses that converged. */
  lens_count: number;
  /** Target user roles. */
  roles: string[];
  /** Product surfaces where this value is delivered. */
  product_surfaces: string[];
  /** IDs of candidates that contributed. */
  contributing_candidates: string[];
  /** Measurement spec entity.activity pairs that can measure this moment. */
  measurement_references?: Array<{ entity: string; activity: string }>;
  /** Lifecycle state names where this moment is relevant. */
  lifecycle_relevance?: string[];
  /** Derivable metric descriptions (e.g., 'boards_shared_per_user'). */
  suggested_metrics?: string[];
}

/** Quality check status. */
export type QualityStatus = "pass" | "warn" | "fail";

/** A single quality check result. */
export interface QualityCheck {
  /** Name of the check. */
  name: string;
  /** Check outcome. */
  status: QualityStatus;
  /** Human-readable result message. */
  message: string;
}

/** Aggregated quality report for a convergence run. */
export interface QualityReport {
  /** Overall quality status. */
  overall: QualityStatus;
  /** Individual check results. */
  checks: QualityCheck[];
}

/** Complete result from the convergence pipeline. */
export interface ConvergenceResult {
  /** Discovered value moments. */
  value_moments: ValueMoment[];
  /** Candidate clusters. */
  clusters: CandidateCluster[];
  /** Summary statistics. */
  stats: {
    total_candidates: number;
    total_clusters: number;
    total_moments: number;
    tier_1_count: number;
    tier_2_count: number;
    tier_3_count: number;
  };
  /** Optional quality report. */
  quality?: QualityReport;
}
