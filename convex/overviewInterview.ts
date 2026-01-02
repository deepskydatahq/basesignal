import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { validateActivityFormat, findDuplicate, type Activity } from "./utils/validation";

// Lifecycle slot types
export const LIFECYCLE_SLOTS = [
  "account_creation",
  "activation",
  "core_usage",
  "revenue",
  "churn",
] as const;

export type LifecycleSlot = (typeof LIFECYCLE_SLOTS)[number];

// Slots required for completion
export const REQUIRED_SLOTS: LifecycleSlot[] = [
  "account_creation",
  "activation",
  "core_usage",
];

// Display info for slots
export const SLOT_INFO: Record<LifecycleSlot, { name: string; required: boolean }> = {
  account_creation: { name: "Account Creation", required: true },
  activation: { name: "Activation", required: true },
  core_usage: { name: "Core Usage", required: true },
  revenue: { name: "Revenue", required: false },
  churn: { name: "Churn", required: false },
};

// Get activities grouped by lifecycle slot
export const getActivitiesBySlot = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, args) => {
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    // Group by slot
    const bySlot: Record<string, typeof stages> = {};
    for (const slot of LIFECYCLE_SLOTS) {
      bySlot[slot] = stages.filter((s) => s.lifecycleSlot === slot);
    }

    return bySlot;
  },
});

// Check if minimum slots are filled
export const checkCompletionStatus = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, args) => {
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    const filledSlots = new Set(stages.map((s) => s.lifecycleSlot).filter(Boolean));

    const requiredFilled = REQUIRED_SLOTS.filter((slot) => filledSlots.has(slot));

    return {
      canComplete: requiredFilled.length === REQUIRED_SLOTS.length,
      filledSlots: Array.from(filledSlots),
      missingRequired: REQUIRED_SLOTS.filter((slot) => !filledSlots.has(slot)),
    };
  },
});

// Add an activity to a lifecycle slot
export const addActivity = mutation({
  args: {
    journeyId: v.id("journeys"),
    entity: v.string(),
    action: v.string(),
    slot: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate slot
    if (!LIFECYCLE_SLOTS.includes(args.slot as LifecycleSlot)) {
      throw new Error(`Invalid lifecycle slot: ${args.slot}`);
    }

    // Validate format
    const formatResult = validateActivityFormat(args.entity, args.action);
    if (!formatResult.valid) {
      return {
        success: false,
        message: `error: ${formatResult.error}. Use format: [Entity] [Past Tense Action]`,
      };
    }

    // Get existing activities for duplicate check
    const existingStages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    const existingActivities: Activity[] = existingStages.map((s) => ({
      entity: s.entity,
      action: s.action,
    }));

    // Check for duplicate (fuzzy)
    const duplicate = findDuplicate(args.entity, args.action, existingActivities);
    if (duplicate) {
      return {
        success: false,
        message: `skipped: "${args.entity} ${args.action}" matches existing "${duplicate.entity} ${duplicate.action}"`,
      };
    }

    // Calculate position (simple grid layout by slot)
    const slotIndex = LIFECYCLE_SLOTS.indexOf(args.slot as LifecycleSlot);
    const existingInSlot = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .filter((q) => q.eq(q.field("lifecycleSlot"), args.slot))
      .collect();

    const position = {
      x: slotIndex * 200 + 100,
      y: existingInSlot.length * 60 + 50,
    };

    const stageId = await ctx.db.insert("stages", {
      journeyId: args.journeyId,
      name: `${args.entity} ${args.action}`,
      type: "activity",
      description: args.description,
      position,
      entity: args.entity,
      action: args.action,
      lifecycleSlot: args.slot,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      success: true,
      stageId,
      message: `Added "${args.entity} ${args.action}" to ${args.slot}`,
    };
  },
});

// Update an existing activity
export const updateActivity = mutation({
  args: {
    journeyId: v.id("journeys"),
    entity: v.string(),
    action: v.string(),
    newEntity: v.optional(v.string()),
    newAction: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const stage = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .filter((q) =>
        q.and(q.eq(q.field("entity"), args.entity), q.eq(q.field("action"), args.action))
      )
      .first();

    if (!stage) {
      return { success: false, message: `Activity "${args.entity} ${args.action}" not found` };
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.newEntity) {
      updates.entity = args.newEntity;
      updates.name = `${args.newEntity} ${args.newAction || args.action}`;
    }
    if (args.newAction) {
      updates.action = args.newAction;
      updates.name = `${args.newEntity || args.entity} ${args.newAction}`;
    }
    if (args.description !== undefined) {
      updates.description = args.description;
    }

    await ctx.db.patch(stage._id, updates);

    return { success: true, message: `Updated activity` };
  },
});

// Remove an activity
export const removeActivity = mutation({
  args: {
    journeyId: v.id("journeys"),
    entity: v.string(),
    action: v.string(),
  },
  handler: async (ctx, args) => {
    const stage = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .filter((q) =>
        q.and(q.eq(q.field("entity"), args.entity), q.eq(q.field("action"), args.action))
      )
      .first();

    if (!stage) {
      return { success: false, message: `Activity "${args.entity} ${args.action}" not found` };
    }

    await ctx.db.delete(stage._id);

    return { success: true, message: `Removed "${args.entity} ${args.action}"` };
  },
});
