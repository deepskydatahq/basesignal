// Re-export all output types from the core package.
export type {
  // Upstream re-exports
  ValueMoment,
  ValueMomentTier,
  SignalStrength,

  // ICP types
  ValueMomentPriority,
  ICPProfile,

  // Activation Map types
  ActivationStage,
  StageTransition,
  ActivationMap,

  // Entity/Property types
  EntityPropertyDef,
  EntityDefinition,
  EventProperty,
  Perspective,
  PerspectiveDistribution,

  // Tracking Event types
  MapsTo,
  TrackingEvent,

  // Measurement Spec
  MeasurementSpec,
  UserStateCriterion,
  UserState,

  // Input/Output containers
  MeasurementInputData,
  OutputGenerationResult,

  // Activation levels (from extractActivationLevels)
  ActivationLevel,
} from "@basesignal/core";

// Backward compatibility: EntityProperty was a type alias for EntityPropertyDef
export type { EntityPropertyDef as EntityProperty } from "@basesignal/core";
