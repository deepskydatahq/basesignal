import { z } from "zod/v4";

export const EvidenceSchema = z.object({
  url: z.string().min(1),
  excerpt: z.string().min(1),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ConfidenceSchema = z.number().min(0).max(1);
export type Confidence = z.infer<typeof ConfidenceSchema>;
