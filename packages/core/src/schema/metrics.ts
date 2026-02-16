import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const MetricItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  formula: z.string().optional(),
  linkedTo: z.array(z.string()),
});
export type MetricItem = z.infer<typeof MetricItemSchema>;

export const MetricsSectionSchema = z.object({
  items: z.array(MetricItemSchema),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type MetricsSection = z.infer<typeof MetricsSectionSchema>;
