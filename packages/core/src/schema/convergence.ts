import { z } from "zod/v4";

// Convergence uses a different LensType set than lenses/types.ts
export const ConvergenceLensTypeSchema = z.enum([
  "jtbd",
  "outcomes",
  "pains",
  "gains",
  "alternatives",
  "workflows",
  "emotions",
]);
export type ConvergenceLensType = z.infer<typeof ConvergenceLensTypeSchema>;

export const ValidationStatusSchema = z.enum(["valid", "rewritten", "removed"]);
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;

export const ValidatedCandidateSchema = z.object({
  id: z.string().min(1),
  lens: ConvergenceLensTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  confidence: z.number(),
  validation_status: ValidationStatusSchema,
  validation_issue: z.string().optional(),
  rewritten_from: z.object({
    name: z.string(),
    description: z.string(),
  }).optional(),
});
export type ValidatedCandidate = z.infer<typeof ValidatedCandidateSchema>;

export const ValueMomentTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type ValueMomentTier = z.infer<typeof ValueMomentTierSchema>;

export const ValueMomentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  tier: ValueMomentTierSchema,
  lenses: z.array(ConvergenceLensTypeSchema),
  lens_count: z.number().int().min(0),
  roles: z.array(z.string()),
  product_surfaces: z.array(z.string()),
  contributing_candidates: z.array(z.string()),
  measurement_references: z.array(z.object({ entity: z.string(), activity: z.string() })).optional(),
  lifecycle_relevance: z.array(z.string()).optional(),
  suggested_metrics: z.array(z.string()).optional(),
});
export type ValueMoment = z.infer<typeof ValueMomentSchema>;

export const CandidateClusterSchema = z.object({
  cluster_id: z.string().min(1),
  candidates: z.array(ValidatedCandidateSchema),
  lens_count: z.number().int().min(0),
  lenses: z.array(ConvergenceLensTypeSchema),
});
export type CandidateCluster = z.infer<typeof CandidateClusterSchema>;

export const QualityStatusSchema = z.enum(["pass", "warn", "fail"]);
export type QualityStatus = z.infer<typeof QualityStatusSchema>;

export const QualityCheckSchema = z.object({
  name: z.string().min(1),
  status: QualityStatusSchema,
  message: z.string().min(1),
});
export type QualityCheck = z.infer<typeof QualityCheckSchema>;

export const QualityReportSchema = z.object({
  overall: QualityStatusSchema,
  checks: z.array(QualityCheckSchema),
});
export type QualityReport = z.infer<typeof QualityReportSchema>;

export const ConvergenceResultSchema = z.object({
  value_moments: z.array(ValueMomentSchema),
  clusters: z.array(CandidateClusterSchema),
  stats: z.object({
    total_candidates: z.number().int().min(0),
    total_clusters: z.number().int().min(0),
    total_moments: z.number().int().min(0),
    tier_1_count: z.number().int().min(0),
    tier_2_count: z.number().int().min(0),
    tier_3_count: z.number().int().min(0),
  }),
  quality: QualityReportSchema.optional(),
});
export type ConvergenceResult = z.infer<typeof ConvergenceResultSchema>;
