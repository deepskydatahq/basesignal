import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("amplitudeConnections").collect();
  },
});

export const getById = query({
  args: { id: v.id("amplitudeConnections") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("amplitudeConnections")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    apiKey: v.string(),
    secretKey: v.string(),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("amplitudeConnections", {
      name: args.name,
      apiKey: args.apiKey,
      secretKey: args.secretKey,
      projectId: args.projectId,
      status: "connected",
      selectedEvents: [],
      createdAt: Date.now(),
    });
  },
});

export const updateSelectedEvents = mutation({
  args: {
    id: v.id("amplitudeConnections"),
    selectedEvents: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      selectedEvents: args.selectedEvents,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("amplitudeConnections"),
    status: v.string(),
    lastRunAt: v.optional(v.string()),
    lastRowCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      lastRunAt: args.lastRunAt,
      lastRowCount: args.lastRowCount,
      errorMessage: args.errorMessage,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("amplitudeConnections") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const pipelineCreated = mutation({
  args: {
    id: v.id("amplitudeConnections"),
    configPath: v.string(),
    secretName: v.string(),
    workflowRunId: v.optional(v.number()),
    workflowUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "connected",
      configPath: args.configPath,
      secretName: args.secretName,
      workflowRunId: args.workflowRunId,
      workflowUrl: args.workflowUrl,
      // Clear credentials after they're stored in GitHub
      apiKey: "",
      secretKey: "",
    });
  },
});

export const updateFromSyncService = mutation({
  args: {
    id: v.string(),  // String because it comes from external service
    status: v.string(),
    lastRunAt: v.optional(v.string()),
    lastRowCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find connection by ID string
    const connections = await ctx.db
      .query("amplitudeConnections")
      .collect();

    const connection = connections.find(c => c._id.toString() === args.id);

    if (!connection) {
      throw new Error(`Connection not found: ${args.id}`);
    }

    await ctx.db.patch(connection._id, {
      status: args.status,
      lastRunAt: args.lastRunAt,
      lastRowCount: args.lastRowCount,
      errorMessage: args.errorMessage,
    });
  },
});
