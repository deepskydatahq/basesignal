import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const CoreIdentitySchema = z.object({
  productName: z.string().min(1),
  description: z.string().min(1),
  targetCustomer: z.string().min(1),
  businessModel: z.string().min(1),
  industry: z.string().optional(),
  companyStage: z.string().optional(),
  teams: z.array(z.string()).optional(),
  companies: z.array(z.string()).optional(),
  use_cases: z.array(z.string()).optional(),
  revenue_model: z.array(z.string()).optional(),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type CoreIdentity = z.infer<typeof CoreIdentitySchema>;
