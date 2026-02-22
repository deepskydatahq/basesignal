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

/** A single stage in the activation progression. */
export interface ActivationStage {
  level: number;
  name: string;
  signal_strength: SignalStrength;
  trigger_events: string[];
  value_moments_unlocked: string[];
  drop_off_risk: "low" | "medium" | "high";
  drop_off_reasons?: string[];
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
  confidence: number;
  sources: string[];
}

// ---------------------------------------------------------------------------
// Entity / Property Types
// ---------------------------------------------------------------------------

/** Property definition for an entity. */
export interface EntityPropertyDef {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
  isRequired: boolean;
}

/** Entity definition for the measurement spec. */
export interface EntityDefinition {
  id: string;
  name: string;
  description: string;
  isHeartbeat: boolean;
  properties: EntityPropertyDef[];
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
// Lifecycle States Types
// ---------------------------------------------------------------------------

/** A single criterion for entering or evaluating a lifecycle state. */
export interface StateCriterion {
  event_name: string;
  condition: string;
  threshold?: number;
}

/** A lifecycle state with structured entry criteria and exit triggers. */
export interface LifecycleState {
  name: string;
  definition: string;
  entry_criteria: StateCriterion[];
  exit_triggers: string[];
  time_window?: string;
}

/** A transition between two lifecycle states. */
export interface StateTransition {
  from_state: string;
  to_state: string;
  trigger_conditions: string[];
  typical_timeframe?: string;
}

/** Complete lifecycle states result with states and transitions. */
export interface LifecycleStatesResult {
  states: LifecycleState[];
  transitions: StateTransition[];
  confidence: number;
  sources: string[];
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
export type Perspective = "customer" | "product" | "interaction";

/** Distribution of events across perspectives. */
export interface PerspectiveDistribution {
  customer: number;
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

/** Complete measurement specification. */
export interface MeasurementSpec {
  entities: EntityDefinition[];
  events: TrackingEvent[];
  total_events: number;
  coverage: {
    activation_levels_covered: number[];
    value_moments_covered: string[];
    perspective_distribution: PerspectiveDistribution;
  };
  userStateModel: UserState[];
  confidence: number;
  sources: string[];
  warnings?: string[];
}

// ---------------------------------------------------------------------------
// Lifecycle States Types
// ---------------------------------------------------------------------------

/** A single criterion for determining lifecycle state entry/exit. */
export interface StateCriterion {
  event_name: string;
  condition: string;
  threshold?: number;
}

/** A lifecycle state in the user lifecycle state machine. */
export interface LifecycleState {
  name: string;
  definition: string;
  entry_criteria: StateCriterion[];
  exit_triggers: StateCriterion[];
  time_window?: string;
}

/** Transition between two lifecycle states. */
export interface StateTransition {
  from_state: string;
  to_state: string;
  trigger_conditions: string[];
  typical_timeframe?: string;
}

/** Complete lifecycle states result from the generator. */
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
