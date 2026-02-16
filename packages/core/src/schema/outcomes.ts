import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const OutcomeItemSchema = z.object({
  description: z.string().min(1),
  type: z.string().min(1),
  linkedFeatures: z.array(z.string()),
});
export type OutcomeItem = z.infer<typeof OutcomeItemSchema>;

export const OutcomesSchema = z.object({
  items: z.array(OutcomeItemSchema),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type Outcomes = z.infer<typeof OutcomesSchema>;
