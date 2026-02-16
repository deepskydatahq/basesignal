// Re-export all convergence types from the core package.
// LensType is preserved as an alias for backward compatibility.
export type {
  ExperientialLensType as LensType,
  ValidationStatus,
  ValidatedCandidate,
  CandidateCluster,
  ValueMomentTier,
  ValueMoment,
  QualityStatus,
  QualityCheck,
  QualityReport,
  ConvergenceResult,
} from "@basesignal/core";
