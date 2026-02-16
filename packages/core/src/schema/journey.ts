import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const JourneyStageSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  order: z.number(),
});
export type JourneyStage = z.infer<typeof JourneyStageSchema>;

export const JourneyStagesSchema = z.object({
  stages: z.array(JourneyStageSchema),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type JourneyStages = z.infer<typeof JourneyStagesSchema>;
