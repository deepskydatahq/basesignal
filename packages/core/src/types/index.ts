// Common primitives
export type { Evidence, SignalStrength, ConfidenceLevel } from "./common";

// Profile types
export { SCHEMA_VERSION } from "./profile";
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
} from "./profile";

// Analytical lens types
export type {
  AnalyticalLensType,
  LensCandidate,
  LensResult,
  AllLensesResult,
} from "./lenses";

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
} from "./convergence";

// Output types
export type {
  ValueMomentPriority,
  ICPProfile,
  ActivationStage,
  StageTransition,
  ActivationMap,
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
} from "./outputs";
