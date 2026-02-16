import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

// Shared definition shape (used by firstValue, active, atRisk, churn)
const BaseDefinitionSchema = z.object({
  criteria: z.array(z.string()),
  timeWindow: z.string().optional(),
  reasoning: z.string().min(1),
  confidence: ConfidenceSchema,
  source: z.string().min(1),
  evidence: z.array(EvidenceSchema),
});

// firstValue has an extra `description` field
const FirstValueDefinitionSchema = BaseDefinitionSchema.extend({
  description: z.string().min(1),
});

// Legacy flat activation format
const LegacyActivationSchema = BaseDefinitionSchema;

// Multi-level activation format
const ActivationCriterionSchema = z.object({
  action: z.string().min(1),
  count: z.number().int().positive(),
  timeWindow: z.string().optional(),
});

const SignalStrengthSchema = z.enum(["weak", "medium", "strong", "very_strong"]);

const ActivationLevelSchema = z.object({
  level: z.number().int().positive(),
  name: z.string().min(1),
  signalStrength: SignalStrengthSchema,
  criteria: z.array(ActivationCriterionSchema),
  reasoning: z.string().min(1),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});

const MultiLevelActivationSchema = z.object({
  levels: z.array(ActivationLevelSchema),
  primaryActivation: z.number().optional(),
  overallConfidence: ConfidenceSchema,
});

const ActivationDefinitionSchema = z.union([
  LegacyActivationSchema,
  MultiLevelActivationSchema,
]);

export const DefinitionsSchema = z.object({
  activation: ActivationDefinitionSchema.optional(),
  firstValue: FirstValueDefinitionSchema.optional(),
  active: BaseDefinitionSchema.optional(),
  atRisk: BaseDefinitionSchema.optional(),
  churn: BaseDefinitionSchema.optional(),
});
export type Definitions = z.infer<typeof DefinitionsSchema>;

// Export sub-schemas for consumers that need them
export {
  ActivationDefinitionSchema,
  LegacyActivationSchema,
  MultiLevelActivationSchema,
  FirstValueDefinitionSchema,
  BaseDefinitionSchema as DefinitionSchema,
  SignalStrengthSchema,
  ActivationCriterionSchema,
  ActivationLevelSchema,
};
export type SignalStrength = z.infer<typeof SignalStrengthSchema>;
export type ActivationCriterion = z.infer<typeof ActivationCriterionSchema>;
export type ActivationLevel = z.infer<typeof ActivationLevelSchema>;
