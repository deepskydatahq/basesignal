// Common
export { EvidenceSchema, ConfidenceSchema } from "./common";
export type { Evidence, Confidence } from "./common";

// Profile sections
export { CoreIdentitySchema } from "./identity";
export type { CoreIdentity } from "./identity";

export { RevenueArchitectureSchema, PricingTierSchema } from "./revenue";
export type { RevenueArchitecture, PricingTier } from "./revenue";

export { EntityModelSchema, EntityItemSchema, EntityRelationshipSchema } from "./entities";
export type { EntityModel, EntityItem, EntityRelationship } from "./entities";

export { JourneyStagesSchema, JourneyStageSchema } from "./journey";
export type { JourneyStages, JourneyStage } from "./journey";

export {
  DefinitionsSchema,
  ActivationDefinitionSchema,
  LegacyActivationSchema,
  MultiLevelActivationSchema,
  FirstValueDefinitionSchema,
  DefinitionSchema,
  SignalStrengthSchema,
  ActivationCriterionSchema,
  ActivationLevelSchema,
} from "./definitions";
export type { Definitions, SignalStrength, ActivationCriterion, ActivationLevel } from "./definitions";

export { OutcomesSchema, OutcomeItemSchema } from "./outcomes";
export type { Outcomes, OutcomeItem } from "./outcomes";

export { MetricsSectionSchema, MetricItemSchema } from "./metrics";
export type { MetricsSection, MetricItem } from "./metrics";

// Output types
export {
  ICPProfileSchema,
  ActivationMapSchema,
  MeasurementSpecSchema,
  TrackingEventSchema,
  MapsToSchema,
  PerspectiveSchema,
  PerspectiveDistributionSchema,
  ValueMomentPrioritySchema,
  EventPropertySchema,
  DropOffRiskSchema,
  ActivationStageSchema,
  StageTransitionSchema,
  UserStateCriterionSchema,
  UserStateSchema,
  StateCriterionSchema,
  LifecycleStateSchema,
  StateTransitionSchema,
  LifecycleStatesResultSchema,
  // Double Three-Layer Framework schemas
  EntityPropertyTypeSchema,
  EntityPropertySchema,
  ProductActivitySchema,
  CustomerActivitySchema,
  InteractionActivitySchema,
  ProductEntitySchema,
  CustomerEntitySchema,
  InteractionEntitySchema,
  EntityJsonSchemaSchema,
} from "./outputs";
export type {
  ICPProfile,
  ActivationMap,
  MeasurementSpec,
  TrackingEvent,
  MapsTo,
  Perspective,
  PerspectiveDistribution,
  ValueMomentPriority,
  EventProperty,
  DropOffRisk,
  ActivationStage,
  StageTransition,
  UserStateCriterion,
  UserState,
  StateCriterion,
  LifecycleState,
  StateTransition,
  LifecycleStatesResult,
  // Double Three-Layer Framework types
  EntityPropertyType,
  EntityProperty,
  ProductActivity,
  CustomerActivity,
  InteractionActivity,
  ProductEntity,
  CustomerEntity,
  InteractionEntity,
  EntityJsonSchema,
} from "./outputs";

// Lens types
export {
  LensTypeSchema,
  ConfidenceLevelSchema,
  LensCandidateSchema,
  LensResultSchema,
  AllLensesResultSchema,
} from "./lenses";
export type {
  LensType,
  ConfidenceLevel,
  LensCandidate,
  LensResult,
  AllLensesResult,
} from "./lenses";

// Convergence types
export {
  ConvergenceLensTypeSchema,
  ValidationStatusSchema,
  ValidatedCandidateSchema,
  ValueMomentTierSchema,
  ValueMomentSchema,
  CandidateClusterSchema,
  QualityStatusSchema,
  QualityCheckSchema,
  QualityReportSchema,
  ConvergenceResultSchema,
} from "./convergence";
export type {
  ConvergenceLensType,
  ValidationStatus,
  ValidatedCandidate,
  ValueMomentTier,
  ValueMoment,
  CandidateCluster,
  QualityStatus,
  QualityCheck,
  QualityReport,
  ConvergenceResult,
} from "./convergence";

// Profile
export { ProductProfileSchema, ProfileMetadataSchema } from "./profile";
export type { ProductProfile, ProfileMetadata } from "./profile";
