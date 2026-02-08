/**
 * Types for the convergence/validation pipeline.
 * Used across lens output processing, validation, and merging.
 */

/** A single candidate from a lens analysis */
export interface LensCandidate {
  id: string;
  name: string;
  description: string;
  source_urls?: string[];
}

/** Output from a single lens analysis */
export interface LensResult {
  lens: string;
  candidates: LensCandidate[];
}

/** Validation status after checks */
export type ValidationStatus = "valid" | "rewritten" | "removed";

/** A candidate after validation */
export interface ValidatedCandidate {
  id: string;
  name: string;
  description: string;
  lens: string;
  validation_status: ValidationStatus;
  validation_issue?: string;
  rewritten_from?: {
    name: string;
    description: string;
  };
  source_urls?: string[];
}
