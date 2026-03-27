// Pipeline I/O types for the analysis pipeline.
// LlmProvider and related types are imported from @basesignal/core.

import type {
  LlmProvider,
  LlmMessage,
  LlmOptions,
} from "@basesignal/core";

import type {
  LensCandidate,
  AnalyticalLensType,
} from "@basesignal/core";

import type {
  ConvergenceResult,
  ValueMoment,
} from "@basesignal/core";

import type {
  ICPProfile,
  ActivationMap,
  MeasurementSpec,
  ActivationLevel,
  ValidatedCandidate,
  LifecycleStatesResult,
  OutcomeItem,
} from "@basesignal/core";

import type { ActivationMapResult } from "./outputs/activation-map.js";

// Re-export for convenience within the analysis package
export type {
  LlmProvider,
  LlmMessage,
  LlmOptions,
  LensCandidate,
  AnalyticalLensType,
  ConvergenceResult,
  ValueMoment,
  ValidatedCandidate,
  ICPProfile,
  ActivationMap,
  MeasurementSpec,
  ActivationLevel,
  LifecycleStatesResult,
  OutcomeItem,
  ActivationMapResult,
};

// --- Pipeline-specific types ---

export interface CrawledPage {
  url: string;
  title?: string;
  pageType: string;
  content: string;
}

export interface ProductContext {
  name?: string;
  description?: string;
  targetCustomer?: string;
}

export interface PipelineInput {
  pages: CrawledPage[];
  productContext?: ProductContext;
}

// Progress reporting
export type ProgressPhase =
  | "identity"
  | "activation_levels"
  | "lenses_batch1"
  | "lenses_batch2"
  | "validation"
  | "clustering"
  | "convergence"
  | "outputs_icp"
  | "outputs_activation_map"
  | "outputs_measurement_spec"
  | "outputs_lifecycle_states"
  | "outputs_reconciliation"
  | "outputs_enrichment"
  | "outputs_outcome_generation"
  | "outputs_outcome_enrichment";

export interface ProgressEvent {
  phase: ProgressPhase;
  status: "started" | "completed" | "failed";
  detail?: string;
}

export type OnProgress = (event: ProgressEvent) => void;

// Pipeline error
export interface PipelineError {
  phase: string;
  step: string;
  message: string;
}

// Identity result (extracted from product pages)
export interface IdentityResult {
  productName: string;
  description: string;
  targetCustomer: string;
  businessModel: string;
  industry?: string;
  companyStage?: string;
  teams?: string[];
  companies?: string[];
  use_cases?: string[];
  revenue_model?: string[];
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

// Activation levels result
export interface ActivationLevelsResult {
  levels: ActivationLevel[];
  primaryActivation: number;
  overallConfidence: number;
}

// Per-lens extraction result for intermediates
export interface LensIntermediateResult {
  lens: string;
  candidates: LensCandidate[];
}

// Pipeline intermediates — all intermediate artifacts produced during analysis
export interface PipelineIntermediates {
  lens_results: LensIntermediateResult[];
  validated_candidates: ValidatedCandidate[];
  clusters: ConvergenceResult["clusters"] | null;
  quality_report: ConvergenceResult["quality"] | null;
}

// Pipeline output artifacts
export interface PipelineOutputs {
  icp_profiles: ICPProfile[];
  activation_map: ActivationMapResult | null;
  measurement_spec: MeasurementSpec | null;
  lifecycle_states: LifecycleStatesResult | null;
  value_moments: ValueMoment[];
  enriched_outcomes: OutcomeItem[] | null;
}

// Pipeline result
export interface PipelineResult {
  identity: IdentityResult | null;
  activation_levels: ActivationLevelsResult | null;
  lens_candidates: LensCandidate[];
  convergence: ConvergenceResult | null;
  intermediates: PipelineIntermediates;
  outputs: PipelineOutputs;
  errors: PipelineError[];
  execution_time_ms: number;
}
