import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const EntityItemSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  properties: z.array(z.string()),
});
export type EntityItem = z.infer<typeof EntityItemSchema>;

export const EntityRelationshipSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.string().min(1),
});
export type EntityRelationship = z.infer<typeof EntityRelationshipSchema>;

export const EntityModelSchema = z.object({
  items: z.array(EntityItemSchema),
  relationships: z.array(EntityRelationshipSchema),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type EntityModel = z.infer<typeof EntityModelSchema>;
