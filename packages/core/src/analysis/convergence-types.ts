/**
 * Convergence-specific types.
 *
 * All canonical type definitions live in `../types/convergence.ts`.
 * This module re-exports them for convenient local imports within the
 * analysis directory and adds any analysis-only type aliases.
 */

export type {
  ExperientialLensType,
  ValidatedCandidate,
  CandidateCluster,
  ValueMomentTier,
  ValueMoment,
  QualityStatus,
  QualityCheck,
  QualityReport,
  ConvergenceResult,
} from "../types/convergence";
