// Output types for M004: Actionable Output Generation
// Defines the shape of all three output artifacts: ICPProfile, ActivationMap, MeasurementSpec

import type { ValueMoment, ValueMomentTier } from "../convergence/types";
import type {
  ActivationLevel,
  SignalStrength,
} from "../extractActivationLevels";

// Re-export upstream types for convenience
export type { ValueMoment, ValueMomentTier, ActivationLevel, SignalStrength };

// --- ICP Profile Types ---

export interface ValueMomentPriority {
  moment_id: string;
  priority: 1 | 2 | 3;
  relevance_reason: string;
}

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

// --- Activation Map Types ---

export interface ActivationStage {
  level: number;
  name: string;
  signal_strength: SignalStrength;
  trigger_events: string[];
  value_moments_unlocked: string[];
  drop_off_risk: "low" | "medium" | "high";
  drop_off_reasons?: string[];
}

export interface StageTransition {
  from_level: number;
  to_level: number;
  trigger_events: string[];
  typical_timeframe?: string;
}

export interface ActivationMap {
  stages: ActivationStage[];
  transitions: StageTransition[];
  primary_activation_level: number;
  confidence: number;
  sources: string[];
}

// --- Measurement Spec Types ---

export interface EventProperty {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
}

export type MapsTo =
  | { type: "value_moment"; moment_id: string }
  | { type: "activation_level"; activation_level: number }
  | { type: "both"; moment_id: string; activation_level: number };

export interface TrackingEvent {
  name: string;
  description: string;
  properties: EventProperty[];
  trigger_condition: string;
  maps_to: MapsTo;
  category: string;
}

export interface MeasurementSpec {
  events: TrackingEvent[];
  total_events: number;
  activation_levels_covered: number[];
  value_moments_covered: string[];
  confidence: number;
  sources: string[];
}

// --- Container Type ---

export interface OutputGenerationResult {
  productId: string;
  icp_profiles: ICPProfile[];
  activation_map: ActivationMap;
  measurement_spec: MeasurementSpec;
  generated_at: string;
  execution_time_ms: number;
}
