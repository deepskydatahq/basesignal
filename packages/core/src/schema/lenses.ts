import { z } from "zod/v4";

export const LensTypeSchema = z.enum([
  "capability_mapping",
  "effort_elimination",
  "info_asymmetry",
  "decision_enablement",
  "state_transitions",
  "time_compression",
  "artifact_creation",
]);
export type LensType = z.infer<typeof LensTypeSchema>;

export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const LensCandidateSchema = z.object({
  id: z.string().min(1),
  lens: LensTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  role: z.string().min(1),
  confidence: ConfidenceLevelSchema,
  source_urls: z.array(z.string()),
  // Lens-specific optional fields
  enabling_features: z.array(z.string()).optional(),
  effort_eliminated: z.string().optional(),
  information_gained: z.string().optional(),
  decision_enabled: z.string().optional(),
  state_transition: z.string().optional(),
  time_compression: z.string().optional(),
  artifact_type: z.string().optional(),
});
export type LensCandidate = z.infer<typeof LensCandidateSchema>;

export const LensResultSchema = z.object({
  lens: LensTypeSchema,
  candidates: z.array(LensCandidateSchema),
  candidate_count: z.number().int().min(0),
  execution_time_ms: z.number(),
});
export type LensResult = z.infer<typeof LensResultSchema>;

export const AllLensesResultSchema = z.object({
  productId: z.string().min(1),
  candidates: z.array(LensCandidateSchema),
  per_lens: z.array(z.object({
    lens: LensTypeSchema,
    candidate_count: z.number().int().min(0),
    execution_time_ms: z.number(),
  })),
  total_candidates: z.number().int().min(0),
  execution_time_ms: z.number(),
  errors: z.array(z.object({
    lens: LensTypeSchema,
    error: z.string(),
  })),
});
export type AllLensesResult = z.infer<typeof AllLensesResultSchema>;
