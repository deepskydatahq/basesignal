import { z } from "zod/v4";
import { CoreIdentitySchema } from "./identity";
import { RevenueArchitectureSchema } from "./revenue";
import { EntityModelSchema } from "./entities";
import { JourneyStagesSchema } from "./journey";
import { DefinitionsSchema } from "./definitions";
import { OutcomesSchema } from "./outcomes";
import { MetricsSectionSchema } from "./metrics";

export const ProfileMetadataSchema = z.object({
  created: z.string().optional(),
  updated: z.string().optional(),
  source: z.string().optional(),
});
export type ProfileMetadata = z.infer<typeof ProfileMetadataSchema>;

export const ProductProfileSchema = z.object({
  basesignal_version: z.string().min(1),
  identity: CoreIdentitySchema.optional(),
  revenue: RevenueArchitectureSchema.optional(),
  entities: EntityModelSchema.optional(),
  journey: JourneyStagesSchema.optional(),
  definitions: DefinitionsSchema.optional(),
  outcomes: OutcomesSchema.optional(),
  metrics: MetricsSectionSchema.optional(),
  completeness: z.number().min(0).max(1),
  overallConfidence: z.number().min(0).max(1),
  metadata: ProfileMetadataSchema.optional(),
});
export type ProductProfile = z.infer<typeof ProductProfileSchema>;
