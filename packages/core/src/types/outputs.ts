import type { SignalStrength } from "./common";
import type { ValueMoment, ValueMomentTier } from "./convergence";
import type { ActivationCriterion } from "./profile";

// Re-export upstream types for convenience
export type { ValueMoment, ValueMomentTier, SignalStrength };

// ---------------------------------------------------------------------------
// ICP Profile Types
// ---------------------------------------------------------------------------

/** Priority ranking for a value moment within an ICP profile. */
export interface ValueMomentPriority {
  moment_id: string;
  priority: 1 | 2 | 3;
  relevance_reason: string;
}

/** Ideal Customer Profile derived from value moments. */
export interface ICPProfile {
  id: string;
  name: string;
  description: string;
  value_moment_priorities: ValueMomentPriority[];
  activation_triggers: string[];
  pain_points: string[];
  success_metrics: string[];
  confidence: number;
  sources: string[];
}

// ---------------------------------------------------------------------------
// Activation Map Types
// ---------------------------------------------------------------------------

/** Drop-off risk assessment for an activation stage. */
export interface DropOffRisk {
  level: "low" | "medium" | "high";
  reason: string;
}

/** A single stage in the activation progression. */
export interface ActivationStage {
  level: number;
  name: string;
  signal_strength: SignalStrength;
  trigger_events: string[];
  value_moments_unlocked: string[];
  drop_off_risk: DropOffRisk;
}

/** Transition between two activation stages. */
export interface StageTransition {
  from_level: number;
  to_level: number;
  trigger_events: string[];
  typical_timeframe?: string;
}

/** Complete activation map with stages and transitions. */
export interface ActivationMap {
  stages: ActivationStage[];
  transitions: StageTransition[];
  primary_activation_level: number;
  confidence: "low" | "medium" | "high";
  sources: string[];
}

// ---------------------------------------------------------------------------
// Double Three-Layer Building Blocks
// ---------------------------------------------------------------------------

/** Property type for the Double Three-Layer Framework. */
export type EntityPropertyType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "id"
  | "calculated"
  | "experimental"
  | "temporary";

/** Property definition for an entity in the Double Three-Layer Framework. */
export interface EntityProperty {
  name: string;
  type: EntityPropertyType;
  description: string;
  isRequired: boolean;
  variations?: string;
}

/** A product entity activity — past-tense lifecycle marker. */
export interface ProductActivity {
  name: string;
  properties_supported: string[];
  activity_properties: EntityProperty[];
}

/** An interaction activity — generic UI tracking. */
export interface InteractionActivity {
  name: string;
  properties_supported: string[];
}

// ---------------------------------------------------------------------------
// Double Three-Layer Entity Types
// ---------------------------------------------------------------------------

/** A product entity with lifecycle activities. */
export interface ProductEntity {
  id: string;
  name: string;
  description: string;
  isHeartbeat: boolean;
  properties: EntityProperty[];
  activities: ProductActivity[];
}

/** An interaction entity with generic tracking activities. */
export interface InteractionEntity {
  name: string;
  properties: EntityProperty[];
  activities: InteractionActivity[];
}

/** A generated JSON Schema for an entity. */
export interface EntityJsonSchema {
  entityName: string;
  perspective: Perspective;
  schema: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// User State Model Types
// ---------------------------------------------------------------------------

/** A single criterion for determining user state. */
export interface UserStateCriterion {
  event_name: string;
  condition: string;
}

/** A user lifecycle state with entry criteria. */
export interface UserState {
  name: string;
  definition: string;
  criteria: UserStateCriterion[];
}

// ---------------------------------------------------------------------------
// Measurement Spec Types
// ---------------------------------------------------------------------------

/** Property definition for a tracking event. */
export interface EventProperty {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
  isRequired: boolean;
}

/** Perspective for a tracking event. */
export type Perspective = "product" | "interaction";

/** Distribution of events across perspectives. */
export interface PerspectiveDistribution {
  product: number;
  interaction: number;
}

/** Discriminated union describing what a tracking event maps to. */
export type MapsTo =
  | { type: "value_moment"; moment_id: string }
  | { type: "activation_level"; activation_level: number }
  | { type: "both"; moment_id: string; activation_level: number };

/** A tracking event in the measurement spec. */
export interface TrackingEvent {
  name: string;
  entity_id: string;
  description: string;
  perspective: Perspective;
  properties: EventProperty[];
  trigger_condition: string;
  maps_to: MapsTo;
  category: string;
}

/** Complete measurement specification — Double Three-Layer Framework. */
export interface MeasurementSpec {
  perspectives: {
    product: { entities: ProductEntity[] };
    interaction: { entities: InteractionEntity[] };
  };
  jsonSchemas: EntityJsonSchema[];
  confidence: number;
  sources: string[];
  warnings?: string[];
}

// ---------------------------------------------------------------------------
// Lifecycle States Types
// ---------------------------------------------------------------------------

/** A single criterion for entering or exiting a lifecycle state. */
export interface StateCriterion {
  event_name: string;
  condition: string;
  threshold?: number;
}

/** A lifecycle state definition. */
export interface LifecycleState {
  name: string;
  definition: string;
  entry_criteria: StateCriterion[];
  exit_triggers: StateCriterion[];
  time_window: string;
}

/** A transition between two lifecycle states. */
export interface StateTransition {
  from_state: string;
  to_state: string;
  trigger_conditions: string[];
  typical_timeframe: string;
}

/** Complete lifecycle states result from analysis. */
export interface LifecycleStatesResult {
  states: LifecycleState[];
  transitions: StateTransition[];
  confidence: number;
  sources: string[];
}

// ---------------------------------------------------------------------------
// Activation Level (from extractActivationLevels)
// ---------------------------------------------------------------------------

/** A single activation level extracted from product analysis. */
export interface ActivationLevel {
  level: number;
  name: string;
  signalStrength: SignalStrength;
  criteria: ActivationCriterion[];
  reasoning: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

// ---------------------------------------------------------------------------
// Input / Output Containers
// ---------------------------------------------------------------------------

/** Input data required for measurement spec generation. */
export interface MeasurementInputData {
  value_moments: ValueMoment[];
  activation_levels: ActivationLevel[];
  icp_profiles: ICPProfile[];
  activation_map: ActivationMap;
}

/** Complete result from the output generation pipeline. */
export interface OutputGenerationResult {
  productId: string;
  icp_profiles: ICPProfile[];
  activation_map: ActivationMap;
  measurement_spec: MeasurementSpec;
  lifecycle_states?: LifecycleStatesResult;
  generated_at: string;
  execution_time_ms: number;
}
