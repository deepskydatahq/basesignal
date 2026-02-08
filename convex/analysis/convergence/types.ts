import type { Id } from "../../_generated/dataModel";
import type { LensCandidate, LensType } from "../lenses/types";

export type ValueMomentTier = 1 | 2 | 3;

export type ValidationStatus = "valid" | "rewritten" | "removed";

export interface ValidatedCandidate extends LensCandidate {
  validation_status: ValidationStatus;
  validation_issue?: string;
  rewritten_from?: LensCandidate;
}

export interface ValueMoment {
  id: string;
  name: string;
  tier: ValueMomentTier;
  convergence_count: number;
  contributing_lenses: LensType[];
  description: string;
  roles: string[];
  product_surfaces: string[];
  contributing_candidates: string[];
}

export interface ConvergenceResult {
  productId: Id<"products">;
  value_moments: ValueMoment[];
  tier_1_count: number;
  tier_2_count: number;
  tier_3_count: number;
  total_moments: number;
  execution_time_ms: number;
  validation_stats: {
    total_candidates: number;
    valid: number;
    rewritten: number;
    removed: number;
  };
}
