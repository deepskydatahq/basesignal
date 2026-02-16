// Lens types re-exported from @basesignal/core for convenience.

export type {
  AnalyticalLensType as LensType,
  ConfidenceLevel,
  LensCandidate,
  LensResult,
} from "@basesignal/core";

// Local types for the pipeline orchestration

export interface AllLensesResult {
  batch1Results: LensResult[];
  batch2Results: LensResult[];
  allCandidates: LensCandidate[];
  errors: Array<{ lens: string; error: string }>;
  execution_time_ms: number;
}

// Batch 1 context summary passed to Batch 2 lenses
export type Batch1Context = Record<
  string,
  { candidates: Array<{ name: string; description: string }> }
>;

// Re-import so we can reference without qualifying
import type { LensResult, LensCandidate } from "@basesignal/core";
export type { LensResult as LR, LensCandidate as LC };
