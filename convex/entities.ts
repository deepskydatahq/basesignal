import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, { orgId }) => {
    const entities = await ctx.db
      .query("entities")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    return entities.map(entity => ({
      ...entity,
      fieldCount: entity.fields.length,
      computedColumnCount: entity.computedColumns.length,
      status: entity.currentBranch
        ? "pending"
        : entity.validationErrors?.length
        ? "failed"
        : "synced",
    }));
  },
});

export const getByName = query({
  args: {
    orgId: v.id("orgs"),
    name: v.string(),
  },
  handler: async (ctx, { orgId, name }) => {
    const entity = await ctx.db
      .query("entities")
      .withIndex("by_org_and_name", (q) =>
        q.eq("orgId", orgId).eq("name", name)
      )
      .unique();

    // Return null instead of throwing if not found
    return entity;
  },
});

export const update = mutation({
  args: {
    entityId: v.id("entities"),
    fields: v.array(v.object({
      name: v.string(),
      type: v.string(),
      description: v.optional(v.string()),
      nullable: v.boolean(),
    })),
    computedColumns: v.array(v.object({
      name: v.string(),
      primitiveName: v.string(),
      params: v.any(),
      sql: v.string(),
    })),
    commitMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const { entityId, commitMessage, ...updates } = args;

    const entity = await ctx.db.get(entityId);
    if (!entity) {
      throw new Error("Entity not found");
    }

    // NEW: Set draft_base_sha if not already set
    const patchUpdates: any = {
      ...updates,
      lastModified: Date.now(),
    };

    if (!entity.draft_base_sha) {
      // First time creating draft - record base
      patchUpdates.draft_base_sha = entity.git_commit_sha;
    }

    await ctx.db.patch(entityId, patchUpdates);

    // TODO: Schedule Git operations (Task 10)
    // await ctx.scheduler.runAfter(0, internal.git.commitAndMerge, {
    //   entityId,
    //   commitMessage,
    // });

    return { success: true };
  },
});

export const updateWithConflict = mutation({
  args: {
    tenant_id: v.string(),
    entity_name: v.string(),
    live_version: v.any(),
    git_commit_sha: v.string(),
    conflict_detected_at: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("entities")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenant_id"), args.tenant_id),
          q.eq(q.field("name"), args.entity_name)
        )
      )
      .first();

    if (existing) {
      // Update existing entity - preserve draft
      await ctx.db.patch(existing._id, {
        live_version: args.live_version,
        git_commit_sha: args.git_commit_sha,
        status: "conflict",
        conflict_detected_at: args.conflict_detected_at,
        lastModified: Date.now(),
        // IMPORTANT: Preserve draft_version and draft_base_sha
      });
    } else {
      // New entity - no conflict possible
      await ctx.db.insert("entities", {
        tenant_id: args.tenant_id,
        name: args.entity_name,
        entity_type: args.live_version.entity_type,
        live_version: args.live_version,
        draft_version: undefined,
        status: "live",
        git_commit_sha: args.git_commit_sha,
        lastModified: Date.now(),
        orgId: "default_org" as any, // TODO: Use actual org ID
        sourceType: "git", // Synced from Git
        fields: [],
        computedColumns: [],
      });
    }

    return { success: true };
  },
});

/**
 * Resolves a conflict by accepting the Git version and discarding the draft.
 *
 * @param tenant_id - The tenant ID of the entity
 * @param entity_name - The name of the entity
 * @throws {Error} If entity is not found
 * @throws {Error} If entity is not in conflict state
 */
export const resolveAcceptGit = mutation({
  args: {
    tenant_id: v.string(),
    entity_name: v.string(),
  },
  handler: async (ctx, args) => {
    const entity = await ctx.db
      .query("entities")
      .filter(q =>
        q.and(
          q.eq(q.field("tenant_id"), args.tenant_id),
          q.eq(q.field("name"), args.entity_name)
        )
      )
      .first();

    if (!entity) {
      throw new Error("Entity not found");
    }

    if (entity.status !== "conflict") {
      throw new Error("Entity is not in conflict state");
    }

    // Discard draft, clear conflict
    await ctx.db.patch(entity._id, {
      draft_version: undefined,
      draft_base_sha: undefined,
      status: "live",
      conflict_detected_at: undefined,
      updated_at: Date.now(),
    });
  },
});

/**
 * Resolves a conflict by keeping the draft and rebasing it on the new Git version.
 * Updates the draft's base SHA to the new Git commit, transitioning back to draft state.
 *
 * @param tenant_id - The tenant ID of the entity
 * @param entity_name - The name of the entity
 * @param new_base_sha - The new Git commit SHA to rebase the draft on
 * @throws {Error} If entity is not found
 * @throws {Error} If entity is not in conflict state
 */
export const resolveKeepDraft = mutation({
  args: {
    tenant_id: v.string(),
    entity_name: v.string(),
    new_base_sha: v.string(),
  },
  handler: async (ctx, args) => {
    const entity = await ctx.db
      .query("entities")
      .filter(q =>
        q.and(
          q.eq(q.field("tenant_id"), args.tenant_id),
          q.eq(q.field("name"), args.entity_name)
        )
      )
      .first();

    if (!entity) {
      throw new Error("Entity not found");
    }

    if (entity.status !== "conflict") {
      throw new Error("Entity is not in conflict state");
    }

    // Rebase draft: update base to current Git SHA
    // Draft content stays the same, but now based on latest live
    await ctx.db.patch(entity._id, {
      draft_base_sha: args.new_base_sha,  // Update base to current Git
      status: "draft",  // Back to draft, ready to deploy
      conflict_detected_at: undefined,  // Clear conflict flag
      updated_at: Date.now(),
    });
  },
});

export const countByStatus = query({
  args: {
    tenant_id: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const entities = await ctx.db
      .query("entities")
      .filter(q =>
        q.and(
          q.eq(q.field("tenant_id"), args.tenant_id),
          q.eq(q.field("status"), args.status)
        )
      )
      .collect();

    return { count: entities.length };
  },
});

// Hardcoded Timo org ID from seed data
const TIMO_ORG_ID = "j97f5fwqn9hbcw8ngm4ayd0wr17w7kp7";

/**
 * Sync an entity from Python metadata framework.
 * Called by scripts/sync_entities_to_convex.py
 */
export const syncFromPython = mutation({
  args: {
    name: v.string(),
    entity_type: v.string(),
    source_type: v.string(),
    source_config: v.optional(v.object({
      type: v.string(),
      project: v.optional(v.string()),
      dataset: v.optional(v.string()),
      table: v.optional(v.string()),
      duckdbPath: v.optional(v.string()),
      entityName: v.optional(v.string()),
      sourceEntity: v.optional(v.string()),
      groupBy: v.optional(v.array(v.string())),
    })),
    // Source mapping data
    source_mapping: v.optional(v.object({
      fieldMappingsList: v.optional(v.array(v.object({
        entityField: v.string(),
        sourceField: v.string(),
      }))),
    })),
    // Tenant extension data
    tenant_extension: v.optional(v.object({
      tenantId: v.string(),
      tenantComputedColumns: v.optional(v.array(v.object({
        name: v.string(),
        primitiveName: v.string(),
        params: v.any(),
        sql: v.string(),
      }))),
      tenantMeasures: v.optional(v.array(v.object({
        name: v.string(),
        expression: v.string(),
      }))),
    })),
    fields: v.array(v.object({
      name: v.string(),
      type: v.string(),
      description: v.optional(v.string()),
      nullable: v.boolean(),
    })),
    // Accept origin field for computed columns
    computed_columns: v.array(v.object({
      name: v.string(),
      primitiveName: v.string(),
      params: v.any(),
      sql: v.string(),
      origin: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    // Look for existing entity by name
    const existing = await ctx.db
      .query("entities")
      .withIndex("by_org_and_name", (q) =>
        q.eq("orgId", TIMO_ORG_ID as any).eq("name", args.name)
      )
      .first();

    const entityData = {
      name: args.name,
      sourceType: args.source_type,
      sourceConfig: args.source_config,
      entity_type: args.entity_type,
      fields: args.fields,
      computedColumns: args.computed_columns,
      // Store source mapping and tenant extension
      sourceMapping: args.source_mapping,
      tenantExtension: args.tenant_extension,
      lastModified: Date.now(),
    };

    if (existing) {
      // Update existing entity
      await ctx.db.patch(existing._id, entityData);
    } else {
      // Create new entity
      await ctx.db.insert("entities", {
        ...entityData,
        orgId: TIMO_ORG_ID as any,
      });
    }

    return { status: "success", name: args.name };
  },
});
