import { z } from "zod/v4";

// --- Perspective & MapsTo ---

export const PerspectiveSchema = z.enum(["product", "interaction"]);
export type Perspective = z.infer<typeof PerspectiveSchema>;

export const PerspectiveDistributionSchema = z.object({
  product: z.number(),
  interaction: z.number(),
});
export type PerspectiveDistribution = z.infer<typeof PerspectiveDistributionSchema>;

export const MapsToSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("value_moment"), moment_id: z.string().min(1) }),
  z.object({ type: z.literal("activation_level"), activation_level: z.number() }),
  z.object({ type: z.literal("both"), moment_id: z.string().min(1), activation_level: z.number() }),
]);
export type MapsTo = z.infer<typeof MapsToSchema>;

// --- Value Moment Priority (used by ICPProfile) ---

export const ValueMomentPrioritySchema = z.object({
  moment_id: z.string().min(1),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  relevance_reason: z.string().min(1),
});
export type ValueMomentPriority = z.infer<typeof ValueMomentPrioritySchema>;

// --- ICP Profile ---

export const ICPProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  value_moment_priorities: z.array(ValueMomentPrioritySchema),
  activation_triggers: z.array(z.string()),
  pain_points: z.array(z.string()),
  success_metrics: z.array(z.string()),
  confidence: z.number(),
  sources: z.array(z.string()),
  citations: z.array(z.object({ url: z.string(), excerpt: z.string() })).optional(),
});
export type ICPProfile = z.infer<typeof ICPProfileSchema>;

// --- Double Three-Layer Building Blocks ---

export const EntityPropertyTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "array",
  "id",
  "calculated",
  "experimental",
  "temporary",
]);
export type EntityPropertyType = z.infer<typeof EntityPropertyTypeSchema>;

export const EntityPropertySchema = z.object({
  name: z.string().min(1),
  type: EntityPropertyTypeSchema,
  description: z.string().min(1),
  isRequired: z.boolean(),
  variations: z.string().optional(),
});
export type EntityProperty = z.infer<typeof EntityPropertySchema>;

export const ProductActivitySchema = z.object({
  name: z.string().min(1),
  properties_supported: z.array(z.string()),
  activity_properties: z.array(EntityPropertySchema),
});
export type ProductActivity = z.infer<typeof ProductActivitySchema>;

export const InteractionActivitySchema = z.object({
  name: z.string().min(1),
  properties_supported: z.array(z.string()),
});
export type InteractionActivity = z.infer<typeof InteractionActivitySchema>;

// --- Double Three-Layer Entity Types ---

export const ProductEntitySchema = z.object({
  id: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  isHeartbeat: z.boolean(),
  properties: z.array(EntityPropertySchema),
  activities: z.array(ProductActivitySchema),
});
export type ProductEntity = z.infer<typeof ProductEntitySchema>;

export const InteractionEntitySchema = z.object({
  name: z.string().min(1),
  properties: z.array(EntityPropertySchema),
  activities: z.array(InteractionActivitySchema),
});
export type InteractionEntity = z.infer<typeof InteractionEntitySchema>;

export const EntityJsonSchemaSchema = z.object({
  entityName: z.string().min(1),
  perspective: PerspectiveSchema,
  schema: z.record(z.string(), z.unknown()),
});
export type EntityJsonSchema = z.infer<typeof EntityJsonSchemaSchema>;

// --- Activation Stages / Map ---

export const DropOffRiskSchema = z.object({
  level: z.enum(["low", "medium", "high"]),
  reason: z.string().min(1),
});
export type DropOffRisk = z.infer<typeof DropOffRiskSchema>;

export const ActivationStageSchema = z.object({
  level: z.number(),
  name: z.string().min(1),
  signal_strength: z.enum(["weak", "medium", "strong", "very_strong"]),
  trigger_events: z.array(z.string()),
  value_moments_unlocked: z.array(z.string()),
  drop_off_risk: DropOffRiskSchema,
});
export type ActivationStage = z.infer<typeof ActivationStageSchema>;

export const StageTransitionSchema = z.object({
  from_level: z.number(),
  to_level: z.number(),
  trigger_events: z.array(z.string()),
  typical_timeframe: z.string().optional(),
});
export type StageTransition = z.infer<typeof StageTransitionSchema>;

export const ActivationMapSchema = z.object({
  stages: z.array(ActivationStageSchema),
  transitions: z.array(StageTransitionSchema),
  primary_activation_level: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  sources: z.array(z.string()),
});
export type ActivationMap = z.infer<typeof ActivationMapSchema>;

// --- User State Model ---

export const UserStateCriterionSchema = z.object({
  event_name: z.string().min(1),
  condition: z.string().min(1),
});
export type UserStateCriterion = z.infer<typeof UserStateCriterionSchema>;

export const UserStateSchema = z.object({
  name: z.string().min(1),
  definition: z.string().min(1),
  criteria: z.array(UserStateCriterionSchema),
});
export type UserState = z.infer<typeof UserStateSchema>;

// --- Lifecycle States ---

export const StateCriterionSchema = z.object({
  event_name: z.string().min(1),
  condition: z.string().min(1),
  threshold: z.number().optional(),
});
export type StateCriterion = z.infer<typeof StateCriterionSchema>;

export const LifecycleStateSchema = z.object({
  name: z.string().min(1),
  definition: z.string().min(1),
  entry_criteria: z.array(StateCriterionSchema),
  exit_triggers: z.array(StateCriterionSchema),
  time_window: z.string().optional(),
});
export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

export const StateTransitionSchema = z.object({
  from_state: z.string().min(1),
  to_state: z.string().min(1),
  trigger_conditions: z.array(z.string().min(1)),
  typical_timeframe: z.string().optional(),
});
export type StateTransition = z.infer<typeof StateTransitionSchema>;

export const LifecycleStatesResultSchema = z.object({
  states: z.array(LifecycleStateSchema),
  transitions: z.array(StateTransitionSchema),
  confidence: z.number(),
  sources: z.array(z.string()),
});
export type LifecycleStatesResult = z.infer<typeof LifecycleStatesResultSchema>;

// --- Event Property (for Tracking Events) ---

export const EventPropertySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "array"]),
  description: z.string().min(1),
  isRequired: z.boolean(),
});
export type EventProperty = z.infer<typeof EventPropertySchema>;

// --- Tracking Event ---

export const TrackingEventSchema = z.object({
  name: z.string().min(1),
  entity_id: z.string().min(1),
  description: z.string().min(1),
  perspective: PerspectiveSchema,
  properties: z.array(EventPropertySchema),
  trigger_condition: z.string().min(1),
  maps_to: MapsToSchema,
  category: z.string().min(1),
});
export type TrackingEvent = z.infer<typeof TrackingEventSchema>;

// --- Measurement Spec ---

export const MeasurementSpecSchema = z.object({
  perspectives: z.object({
    product: z.object({ entities: z.array(ProductEntitySchema) }),
    interaction: z.object({ entities: z.array(InteractionEntitySchema) }),
  }),
  jsonSchemas: z.array(EntityJsonSchemaSchema),
  confidence: z.number(),
  sources: z.array(z.string()),
  warnings: z.array(z.string()).optional(),
});
export type MeasurementSpec = z.infer<typeof MeasurementSpecSchema>;
