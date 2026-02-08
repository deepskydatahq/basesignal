// Types for output generation pipeline (M004)

import type { ValueMoment, ValueMomentTier } from "../convergence/types";
import type { ActivationLevel, ActivationCriterion, SignalStrength } from "../extractActivationLevels";

// Re-export upstream types for convenience
export type { ValueMoment, ValueMomentTier, ActivationLevel, ActivationCriterion, SignalStrength };

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
  required: boolean;
}

export interface TrackingEvent {
  name: string;
  description: string;
  properties: EventProperty[];
  trigger_condition: string;
  maps_to: {
    type: "value_moment" | "activation_level" | "both";
    moment_id?: string;
    activation_level?: number;
  };
  category: "activation" | "value" | "retention" | "expansion";
}

export interface MeasurementSpec {
  events: TrackingEvent[];
  total_events: number;
  coverage: {
    activation_levels_covered: number[];
    value_moments_covered: string[];
  };
  confidence: number;
  sources: string[];
}

// --- Measurement Input Data (for aggregation) ---

export interface MeasurementInputData {
  value_moments: ValueMoment[];
  activation_levels: ActivationLevel[];
  icp_profiles: ICPProfile[];
  activation_map: ActivationMap | null;
  activation_event_templates: Array<{
    level: number;
    criteria: ActivationCriterion[];
    suggested_event_name: string;
  }>;
  value_event_templates: Array<{
    moment_id: string;
    moment_name: string;
    tier: ValueMomentTier;
    surfaces: string[];
    suggested_event_name: string;
  }>;
}

// --- Generation Result Types ---

export interface OutputGenerationResult {
  productId: string;
  icp_profiles: ICPProfile[];
  activation_map: ActivationMap | null;
  measurement_spec: MeasurementSpec | null;
  errors?: Array<{ step: string; error: string }>;
  generated_at: string;
  execution_time_ms: number;
}
