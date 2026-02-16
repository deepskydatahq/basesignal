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
} from "@basesignal/core";

// Re-export for convenience within the analysis package
export type {
  LlmProvider,
  LlmMessage,
  LlmOptions,
  LensCandidate,
  AnalyticalLensType,
  ConvergenceResult,
  ValueMoment,
  ICPProfile,
  ActivationMap,
  MeasurementSpec,
  ActivationLevel,
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
  | "outputs_measurement_spec";

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
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

// Activation levels result
export interface ActivationLevelsResult {
  levels: ActivationLevel[];
  primaryActivation: number;
  overallConfidence: number;
}

// Pipeline result
export interface PipelineResult {
  identity: IdentityResult | null;
  activation_levels: ActivationLevelsResult | null;
  lens_candidates: LensCandidate[];
  convergence: ConvergenceResult | null;
  outputs: {
    icp_profiles: ICPProfile[];
    activation_map: ActivationMap | null;
    measurement_spec: MeasurementSpec | null;
  };
  errors: PipelineError[];
  execution_time_ms: number;
}
