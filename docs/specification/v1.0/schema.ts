// docs/specification/v1.0/schema.ts
//
// Re-export all ProductProfile types from @basesignal/core.
// This file exists so that consumers who discover the specification
// can immediately find the canonical TypeScript types.

export type {
  ProductProfile,
  CoreIdentity,
  RevenueArchitecture,
  PricingTier,
  EntityModel,
  EntityItem,
  EntityRelationship,
  UserJourney,
  JourneyStage,
  DefinitionsMap,
  ActivationDefinition,
  LegacyActivationDefinition,
  MultiLevelActivationDefinition,
  ActivationLevelDef,
  ActivationCriterion,
  LifecycleDefinition,
  OutcomesSection,
  OutcomeItem,
  MetricsSection,
  MetricItem,
  Evidence,
  SignalStrength,
  ConfidenceLevel,
} from "@basesignal/core";

export { SCHEMA_VERSION, checkVersion } from "@basesignal/core";
