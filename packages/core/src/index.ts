// @basesignal/core — analysis engine for product P&L measurement

export * from "./llm";

// --- Product Profile Type System ---

// Common primitives
export type { Evidence, SignalStrength, ConfidenceLevel } from "./types/common";

// Version utilities
export { SCHEMA_VERSION, checkVersion } from "./version";
export type { VersionCompatibility } from "./version";

// Profile types
export type {
  ProductProfile,
  CoreIdentity,
  PricingTier,
  RevenueArchitecture,
  EntityItem,
  EntityRelationship,
  EntityModel,
  JourneyStage,
  UserJourney,
  ActivationCriterion,
  ActivationLevelDef,
  LegacyActivationDefinition,
  MultiLevelActivationDefinition,
  ActivationDefinition,
  LifecycleDefinition,
  DefinitionsMap,
  OutcomeItem,
  OutcomesSection,
  MetricItem,
  MetricsSection,
} from "./types/profile";

// Analytical lens types
export type {
  AnalyticalLensType,
  LensCandidate,
  LensResult,
  AllLensesResult,
} from "./types/lenses";

// Convergence types
export type {
  ExperientialLensType,
  ValidationStatus,
  ValidatedCandidate,
  CandidateCluster,
  ValueMomentTier,
  ValueMoment,
  QualityStatus,
  QualityCheck,
  QualityReport,
  ConvergenceResult,
} from "./types/convergence";

// Output types
export type {
  ValueMomentPriority,
  ICPProfile,
  ActivationStage,
  StageTransition,
  ActivationMap,
  EntityPropertyDef,
  EntityDefinition,
  UserStateCriterion,
  UserState,
  EventProperty,
  Perspective,
  PerspectiveDistribution,
  MapsTo,
  TrackingEvent,
  MeasurementSpec,
  ActivationLevel,
  MeasurementInputData,
  OutputGenerationResult,
} from "./types/outputs";

// --- Zod Runtime Validation Schemas ---
export * from "./schema";

// --- Validation Functions ---
export { validateProfile, validateSection } from "./validation";
export type { ValidationResult, ValidationError } from "./validation";

// --- Analysis Utilities ---
// Note: extractJson is already exported from ./llm, so we export everything else explicitly.
export {
  type TfIdfVector,
  tokenize,
  termFrequency,
  inverseDocumentFrequency,
  computeTfIdfVectors,
  cosineSimilarity,
  pairwiseSimilarity,
  DEFAULT_SIMILARITY_THRESHOLD,
  UnionFind,
  candidateText,
  sameLens,
  canMerge,
  buildCluster,
  clusterCandidatesCore,
  CLUSTERING_SYSTEM_PROMPT,
  buildClusteringPrompt,
  parseClusteringResponse,
  FEATURE_AS_VALUE_PATTERNS,
  MARKETING_LANGUAGE_PATTERNS,
  ABSTRACT_OUTCOME_PATTERNS,
  VAGUE_PHRASES,
  isFeatureAsValue,
  isVagueCandidate,
  isMarketingLanguage,
  findWithinLensDuplicates,
  hasUnverifiedFeatureRef,
  buildKnownFeaturesSet,
  runValidationPipeline,
  type ValidationLensResult,
  // Convergence and tiering (S006)
  type LlmProvider as ConvergenceLlmFn,
  type ConvergeOptions,
  assignTier,
  parseMergeResponse,
  directMerge,
  capTierDistribution,
  BUSINESS_VERBS,
  USER_ACTION_VERBS,
  isBusinessVerb,
  validateConvergenceQuality,
  MERGE_SYSTEM_PROMPT,
  buildMergePrompt,
  converge,
  runConvergence,
} from "./analysis";
