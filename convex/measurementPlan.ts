import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// Helper to get current authenticated user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

// ============================================
// JOURNEY EXTRACTION (for Setup Integration)
// ============================================

// Extract entities and activities from journey stages
export const extractFromJourney = query({
  args: {
    journeyId: v.id("journeys"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return { entities: [] };
    }

    // Verify journey belongs to user
    const journey = await ctx.db.get(args.journeyId);
    if (!journey || journey.userId !== user._id) {
      return { entities: [] };
    }

    // Get all stages for this journey
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    // Filter stages that have entity and action
    const activitiesStages = stages.filter(
      (stage) => stage.entity && stage.action
    );

    // Group by entity
    const entityMap = new Map<
      string,
      {
        name: string;
        activities: {
          name: string;
          action: string;
          lifecycleSlot: string | undefined;
        }[];
      }
    >();

    for (const stage of activitiesStages) {
      const entityName = stage.entity!;
      const activityName = stage.name;
      const action = stage.action!;
      const lifecycleSlot = stage.lifecycleSlot;

      if (!entityMap.has(entityName)) {
        entityMap.set(entityName, {
          name: entityName,
          activities: [],
        });
      }

      entityMap.get(entityName)!.activities.push({
        name: activityName,
        action,
        lifecycleSlot,
      });
    }

    return {
      entities: Array.from(entityMap.values()),
    };
  },
});

// Import selected entities and activities from journey (initial import)
export const importFromJourney = mutation({
  args: {
    journeyId: v.id("journeys"),
    selectedEntities: v.array(v.string()),
    selectedActivities: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Verify journey belongs to user
    const journey = await ctx.db.get(args.journeyId);
    if (!journey || journey.userId !== user._id) {
      throw new Error("Journey not found");
    }

    // Get all stages for this journey
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    // Filter stages that have entity and action
    const activitiesStages = stages.filter(
      (stage) => stage.entity && stage.action
    );

    // Get existing entities for this user
    const existingEntities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existingEntityNames = new Set(existingEntities.map((e) => e.name));
    const entityNameToId = new Map(
      existingEntities.map((e) => [e.name, e._id])
    );

    // Get existing activities for this user
    const existingActivities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existingActivityNames = new Set(existingActivities.map((a) => a.name));

    let entitiesCreated = 0;
    let activitiesCreated = 0;
    const now = Date.now();

    // Create entities for selected entities that don't exist
    for (const entityName of args.selectedEntities) {
      if (!existingEntityNames.has(entityName)) {
        const entityId = await ctx.db.insert("measurementEntities", {
          userId: user._id,
          name: entityName,
          suggestedFrom: "overview_interview",
          createdAt: now,
        });
        entityNameToId.set(entityName, entityId);
        existingEntityNames.add(entityName);
        entitiesCreated++;
      }
    }

    // Create activities for selected activities that don't exist
    for (const activityName of args.selectedActivities) {
      if (!existingActivityNames.has(activityName)) {
        // Find the stage for this activity
        const stage = activitiesStages.find((s) => s.name === activityName);
        if (!stage || !stage.entity) continue;

        // Get or create the entity
        const entityId = entityNameToId.get(stage.entity);
        if (!entityId) continue;

        await ctx.db.insert("measurementActivities", {
          userId: user._id,
          entityId,
          name: activityName,
          action: stage.action!,
          lifecycleSlot: stage.lifecycleSlot,
          isFirstValue: false,
          suggestedFrom: "overview_interview",
          createdAt: now,
        });
        existingActivityNames.add(activityName);
        activitiesCreated++;
      }
    }

    return {
      entitiesCreated,
      activitiesCreated,
    };
  },
});

// Internal mutation for auto-generation (called from setupProgress.complete)
export const generateFromJourneyInternal = internalMutation({
  args: {
    userId: v.id("users"),
    journeyId: v.id("journeys"),
  },
  handler: async (ctx, args) => {
    // Verify journey exists and belongs to user
    const journey = await ctx.db.get(args.journeyId);
    if (!journey || journey.userId !== args.userId) {
      return { success: false, error: "Journey not found" };
    }

    // Get all stages from journey
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    // Get existing entities to avoid duplicates
    const existingEntities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existingEntityNames = new Set(
      existingEntities.map((e) => e.name.toLowerCase())
    );
    const entityNameToId = new Map(
      existingEntities.map((e) => [e.name.toLowerCase(), e._id])
    );

    // Get existing activities to avoid duplicates
    const existingActivities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existingActivityNames = new Set(
      existingActivities.map((a) => a.name.toLowerCase())
    );

    const now = Date.now();
    let entitiesCreated = 0;
    let activitiesCreated = 0;

    // Process stages with entity/action
    for (const stage of stages) {
      if (!stage.entity || !stage.action) continue;

      const entityLower = stage.entity.toLowerCase();
      const activityName = stage.name;
      const activityLower = activityName.toLowerCase();

      // Create entity if not exists
      if (!existingEntityNames.has(entityLower)) {
        const entityId = await ctx.db.insert("measurementEntities", {
          userId: args.userId,
          name: stage.entity,
          suggestedFrom: "overview_interview",
          createdAt: now,
        });
        entityNameToId.set(entityLower, entityId);
        existingEntityNames.add(entityLower);
        entitiesCreated++;
      }

      // Create activity if not exists
      if (!existingActivityNames.has(activityLower)) {
        const entityId = entityNameToId.get(entityLower);
        if (entityId) {
          await ctx.db.insert("measurementActivities", {
            userId: args.userId,
            entityId,
            name: activityName,
            action: stage.action,
            lifecycleSlot: stage.lifecycleSlot,
            isFirstValue: false,
            suggestedFrom: "overview_interview",
            createdAt: now,
          });
          existingActivityNames.add(activityLower);
          activitiesCreated++;
        }
      }
    }

    return { success: true, entitiesCreated, activitiesCreated };
  },
});

// ============================================
// ENTITIES
// ============================================

export const listEntities = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const getEntity = query({
  args: { id: v.id("measurementEntities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const entity = await ctx.db.get(args.id);
    if (!entity) return null;
    if (entity.userId !== user._id) return null;

    return entity;
  },
});

export const createEntity = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    suggestedFrom: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Check for duplicate name (case-insensitive)
    const allEntities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existing = allEntities.find(
      (e) => e.name.toLowerCase() === args.name.toLowerCase()
    );

    if (existing) {
      throw new Error(`Entity "${args.name}" already exists`);
    }

    return await ctx.db.insert("measurementEntities", {
      userId: user._id,
      name: args.name,
      description: args.description,
      suggestedFrom: args.suggestedFrom,
      createdAt: Date.now(),
    });
  },
});

export const updateEntity = mutation({
  args: {
    id: v.id("measurementEntities"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const entity = await ctx.db.get(args.id);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Not authorized");

    // Check for duplicate name if name is being changed (case-insensitive)
    if (args.name && args.name.toLowerCase() !== entity.name.toLowerCase()) {
      const allEntities = await ctx.db
        .query("measurementEntities")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      const existing = allEntities.find(
        (e) => e.name.toLowerCase() === args.name!.toLowerCase()
      );

      if (existing) {
        throw new Error(`Entity "${args.name}" already exists`);
      }
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.id, updates);
  },
});

export const deleteEntity = mutation({
  args: { id: v.id("measurementEntities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const entity = await ctx.db.get(args.id);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Not authorized");

    // Delete all activities for this entity
    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_entity", (q) => q.eq("entityId", args.id))
      .collect();
    for (const a of activities) {
      await ctx.db.delete(a._id);
    }

    // Delete all properties for this entity
    const properties = await ctx.db
      .query("measurementProperties")
      .withIndex("by_entity", (q) => q.eq("entityId", args.id))
      .collect();
    for (const p of properties) {
      await ctx.db.delete(p._id);
    }

    // Delete the entity
    await ctx.db.delete(args.id);
  },
});

// ============================================
// ACTIVITIES
// ============================================

export const listActivities = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const listActivitiesByEntity = query({
  args: { entityId: v.id("measurementEntities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("measurementActivities")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();
  },
});

export const getActivity = query({
  args: { id: v.id("measurementActivities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const activity = await ctx.db.get(args.id);
    if (!activity) return null;
    if (activity.userId !== user._id) return null;

    return activity;
  },
});

export const createActivity = mutation({
  args: {
    entityId: v.id("measurementEntities"),
    name: v.string(),
    action: v.string(),
    description: v.optional(v.string()),
    lifecycleSlot: v.optional(v.string()),
    isFirstValue: v.boolean(),
    suggestedFrom: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Verify entity exists and belongs to user
    const entity = await ctx.db.get(args.entityId);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Not authorized");

    return await ctx.db.insert("measurementActivities", {
      userId: user._id,
      entityId: args.entityId,
      name: args.name,
      action: args.action,
      description: args.description,
      lifecycleSlot: args.lifecycleSlot,
      isFirstValue: args.isFirstValue,
      suggestedFrom: args.suggestedFrom,
      createdAt: Date.now(),
    });
  },
});

export const updateActivity = mutation({
  args: {
    id: v.id("measurementActivities"),
    name: v.optional(v.string()),
    action: v.optional(v.string()),
    description: v.optional(v.string()),
    lifecycleSlot: v.optional(v.string()),
    isFirstValue: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const activity = await ctx.db.get(args.id);
    if (!activity) throw new Error("Activity not found");
    if (activity.userId !== user._id) throw new Error("Not authorized");

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.action !== undefined) updates.action = args.action;
    if (args.description !== undefined) updates.description = args.description;
    if (args.lifecycleSlot !== undefined)
      updates.lifecycleSlot = args.lifecycleSlot;
    if (args.isFirstValue !== undefined) updates.isFirstValue = args.isFirstValue;

    await ctx.db.patch(args.id, updates);
  },
});

export const deleteActivity = mutation({
  args: { id: v.id("measurementActivities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const activity = await ctx.db.get(args.id);
    if (!activity) throw new Error("Activity not found");
    if (activity.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(args.id);
  },
});

export const setFirstValue = mutation({
  args: {
    activityId: v.id("measurementActivities"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");
    if (activity.userId !== user._id) throw new Error("Not authorized");

    // Clear isFirstValue from all user's activities
    const allActivities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const act of allActivities) {
      if (act.isFirstValue && act._id !== args.activityId) {
        await ctx.db.patch(act._id, { isFirstValue: false });
      }
    }

    // Set this activity as First Value
    await ctx.db.patch(args.activityId, { isFirstValue: true });
  },
});

// ============================================
// PROPERTIES
// ============================================

export const listProperties = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("measurementProperties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const listPropertiesByEntity = query({
  args: { entityId: v.id("measurementEntities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("measurementProperties")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();
  },
});

export const getProperty = query({
  args: { id: v.id("measurementProperties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const property = await ctx.db.get(args.id);
    if (!property) return null;
    if (property.userId !== user._id) return null;

    return property;
  },
});

export const createProperty = mutation({
  args: {
    entityId: v.id("measurementEntities"),
    name: v.string(),
    dataType: v.string(),
    description: v.optional(v.string()),
    isRequired: v.boolean(),
    suggestedFrom: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Verify entity exists and belongs to user
    const entity = await ctx.db.get(args.entityId);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Not authorized");

    // Check for duplicate property name within entity
    const existingProps = await ctx.db
      .query("measurementProperties")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .collect();

    const existing = existingProps.find((p) => p.name === args.name);

    if (existing) {
      throw new Error(`Property "${args.name}" already exists on this entity`);
    }

    return await ctx.db.insert("measurementProperties", {
      userId: user._id,
      entityId: args.entityId,
      name: args.name,
      dataType: args.dataType,
      description: args.description,
      isRequired: args.isRequired,
      suggestedFrom: args.suggestedFrom,
      createdAt: Date.now(),
    });
  },
});

export const updateProperty = mutation({
  args: {
    id: v.id("measurementProperties"),
    name: v.optional(v.string()),
    dataType: v.optional(v.string()),
    description: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.id);
    if (!property) throw new Error("Property not found");
    if (property.userId !== user._id) throw new Error("Not authorized");

    // Check for duplicate name if name is being changed
    if (args.name && args.name !== property.name) {
      const existingProps = await ctx.db
        .query("measurementProperties")
        .withIndex("by_entity", (q) => q.eq("entityId", property.entityId))
        .collect();

      const existing = existingProps.find((p) => p.name === args.name);

      if (existing) {
        throw new Error(`Property "${args.name}" already exists on this entity`);
      }
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.dataType !== undefined) updates.dataType = args.dataType;
    if (args.description !== undefined) updates.description = args.description;
    if (args.isRequired !== undefined) updates.isRequired = args.isRequired;

    await ctx.db.patch(args.id, updates);
  },
});

export const deleteProperty = mutation({
  args: { id: v.id("measurementProperties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.id);
    if (!property) throw new Error("Property not found");
    if (property.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(args.id);
  },
});

// ============================================
// FULL PLAN (Hierarchical View)
// ============================================

export const getFullPlan = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const entities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const result = await Promise.all(
      entities.map(async (entity) => {
        const activities = await ctx.db
          .query("measurementActivities")
          .withIndex("by_entity", (q) => q.eq("entityId", entity._id))
          .collect();

        const properties = await ctx.db
          .query("measurementProperties")
          .withIndex("by_entity", (q) => q.eq("entityId", entity._id))
          .collect();

        return {
          entity,
          activities,
          properties,
        };
      })
    );

    return result;
  },
});

// ============================================
// JOURNEY DIFF & IMPORT
// ============================================

export const computeJourneyDiff = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    // Verify journey belongs to user
    const journey = await ctx.db.get(args.journeyId);
    if (!journey) return null;
    if (journey.userId !== user._id) return null;

    // Get all stages from the journey
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    // Get existing measurement entities and activities for user
    const existingEntities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existingActivities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Build maps for quick lookup (case-insensitive)
    const existingEntityMap = new Map(
      existingEntities.map((e) => [e.name.toLowerCase(), e])
    );
    const existingActivityMap = new Map(
      existingActivities.map((a) => [a.name.toLowerCase(), a])
    );

    // Process stages to extract entities and activities
    const newEntities: Array<{
      name: string;
      activities: Array<{
        name: string;
        action: string;
        lifecycleSlot?: string;
      }>;
    }> = [];
    const existingEntitiesList: Array<{ name: string; matchedActivityCount: number }> = [];
    const newActivities: Array<{
      entityName: string;
      name: string;
      action: string;
      lifecycleSlot?: string;
    }> = [];
    const existingActivitiesList: Array<{ name: string }> = [];

    // Track entities we've seen in this diff
    const seenEntities = new Map<string, { name: string; activities: Array<{ name: string; action: string; lifecycleSlot?: string }> }>();

    for (const stage of stages) {
      // Skip stages without entity/action (entry nodes, etc.)
      if (!stage.entity || !stage.action) continue;

      const entityLower = stage.entity.toLowerCase();
      const activityName = `${stage.entity} ${stage.action}`;
      const activityLower = activityName.toLowerCase();

      // Check if activity already exists
      if (existingActivityMap.has(activityLower)) {
        existingActivitiesList.push({ name: activityName });
      } else {
        // Activity is new - add to new list
        newActivities.push({
          entityName: stage.entity,
          name: activityName,
          action: stage.action,
          lifecycleSlot: stage.lifecycleSlot ?? undefined,
        });
      }

      // Track entity
      if (existingEntityMap.has(entityLower)) {
        // Entity exists - track activity count
        const existing = existingEntitiesList.find(
          (e) => e.name.toLowerCase() === entityLower
        );
        if (existing) {
          existing.matchedActivityCount++;
        } else {
          existingEntitiesList.push({
            name: stage.entity,
            matchedActivityCount: 1,
          });
        }
      } else {
        // Entity is new
        if (!seenEntities.has(entityLower)) {
          seenEntities.set(entityLower, {
            name: stage.entity,
            activities: [],
          });
        }
        const entityEntry = seenEntities.get(entityLower)!;
        entityEntry.activities.push({
          name: activityName,
          action: stage.action,
          lifecycleSlot: stage.lifecycleSlot ?? undefined,
        });
      }
    }

    // Convert seen entities to array
    for (const entity of seenEntities.values()) {
      newEntities.push(entity);
    }

    return {
      journeyType: journey.type,
      newEntities,
      existingEntities: existingEntitiesList,
      newActivities,
      existingActivities: existingActivitiesList,
    };
  },
});

export const importFromJourneyIncremental = mutation({
  args: {
    journeyId: v.id("journeys"),
    selectedEntities: v.array(v.string()),
    selectedActivities: v.array(v.string()),
    selectedProperties: v.array(
      v.object({
        entityName: v.string(),
        propertyName: v.string(),
        dataType: v.string(),
        isRequired: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Verify journey belongs to user
    const journey = await ctx.db.get(args.journeyId);
    if (!journey) throw new Error("Journey not found");
    if (journey.userId !== user._id) throw new Error("Not authorized");

    // Get existing entities for duplicate check
    const existingEntities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const existingEntityMap = new Map(
      existingEntities.map((e) => [e.name.toLowerCase(), e])
    );

    // Get existing activities for duplicate check
    const existingActivities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const existingActivityMap = new Map(
      existingActivities.map((a) => [a.name.toLowerCase(), a])
    );

    // Get all stages from journey
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    const suggestedFrom = journey.type;
    let entitiesCreated = 0;
    let activitiesCreated = 0;
    let propertiesCreated = 0;

    // Track entity IDs (existing and newly created) for activity creation
    const entityIdMap = new Map<string, typeof existingEntities[0]["_id"]>();
    for (const [name, entity] of existingEntityMap) {
      entityIdMap.set(name, entity._id);
    }

    // Create selected entities
    for (const entityName of args.selectedEntities) {
      const entityLower = entityName.toLowerCase();
      if (!existingEntityMap.has(entityLower)) {
        const entityId = await ctx.db.insert("measurementEntities", {
          userId: user._id,
          name: entityName,
          suggestedFrom,
          createdAt: Date.now(),
        });
        entityIdMap.set(entityLower, entityId);
        entitiesCreated++;
      }
    }

    // Create selected activities
    for (const activityName of args.selectedActivities) {
      const activityLower = activityName.toLowerCase();
      if (!existingActivityMap.has(activityLower)) {
        // Find the corresponding stage to get entity and action
        const stage = stages.find((s) => {
          if (!s.entity || !s.action) return false;
          return `${s.entity} ${s.action}`.toLowerCase() === activityLower;
        });

        if (stage && stage.entity && stage.action) {
          const entityId = entityIdMap.get(stage.entity.toLowerCase());
          if (entityId) {
            await ctx.db.insert("measurementActivities", {
              userId: user._id,
              entityId,
              name: activityName,
              action: stage.action,
              lifecycleSlot: stage.lifecycleSlot ?? undefined,
              isFirstValue: false,
              suggestedFrom,
              createdAt: Date.now(),
            });
            activitiesCreated++;
          }
        }
      }
    }

    // Create selected properties
    for (const prop of args.selectedProperties) {
      const entityId = entityIdMap.get(prop.entityName.toLowerCase());
      if (entityId) {
        // Check for duplicate property
        const existingProps = await ctx.db
          .query("measurementProperties")
          .withIndex("by_entity", (q) => q.eq("entityId", entityId))
          .filter((q) => q.eq(q.field("name"), prop.propertyName))
          .first();

        if (!existingProps) {
          await ctx.db.insert("measurementProperties", {
            userId: user._id,
            entityId,
            name: prop.propertyName,
            dataType: prop.dataType,
            isRequired: prop.isRequired,
            suggestedFrom: "template",
            createdAt: Date.now(),
          });
          propertiesCreated++;
        }
      }
    }

    return {
      entitiesCreated,
      activitiesCreated,
      propertiesCreated,
    };
  },
});

// Delete all measurement plan data for current user (for regeneration)
export const deleteAll = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Delete all properties
    const properties = await ctx.db
      .query("measurementProperties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const p of properties) {
      await ctx.db.delete(p._id);
    }

    // Delete all activities
    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const a of activities) {
      await ctx.db.delete(a._id);
    }

    // Delete all entities
    const entities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const e of entities) {
      await ctx.db.delete(e._id);
    }

    return {
      deletedEntities: entities.length,
      deletedActivities: activities.length,
      deletedProperties: properties.length,
    };
  },
});
