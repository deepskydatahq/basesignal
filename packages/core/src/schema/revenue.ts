import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const PricingTierSchema = z.object({
  name: z.string().min(1),
  price: z.string().min(1),
  features: z.array(z.string()),
});
export type PricingTier = z.infer<typeof PricingTierSchema>;

export const RevenueArchitectureSchema = z.object({
  model: z.string().min(1),
  billingUnit: z.string().optional(),
  hasFreeTier: z.boolean(),
  tiers: z.array(PricingTierSchema),
  expansionPaths: z.array(z.string()),
  contractionRisks: z.array(z.string()),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type RevenueArchitecture = z.infer<typeof RevenueArchitectureSchema>;
