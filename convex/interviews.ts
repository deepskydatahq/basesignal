import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { INTERVIEW_TYPES, type InterviewType, type InterviewStatus, INTERVIEW_TYPE_ORDER } from "./interviewTypes";
import { getTemplatesByPhase } from "../src/shared/metricTemplates";

// Helper to generate overview metrics (duplicated to avoid circular deps with internal mutations)
async function generateOverviewMetrics(ctx: MutationCtx, journeyId: string, userId: string) {
  // 1. Get stages for this journey
  const stages = await ctx.db
    .query("stages")
    .withIndex("by_journey", (q) => q.eq("journeyId", journeyId as any))
    .collect();

  // 2. Find core_usage stage for {{coreAction}} slot (with fallback)
  const coreUsageStage = stages.find((s) => s.lifecycleSlot === "core_usage");
  const coreAction = coreUsageStage?.name ?? "Core Action";

  // 3. Get existing metrics to check for duplicates
  const existingMetrics = await ctx.db
    .query("metrics")
    .withIndex("by_user", (q) => q.eq("userId", userId as any))
    .collect();

  const existingTemplateKeys = new Set(
    existingMetrics.map((m) => m.templateKey).filter(Boolean)
  );

  // 4. Get overview templates
  const overviewTemplates = getTemplatesByPhase("overview");

  // 5. Generate metrics that don't already exist
  let order = 1;
  const now = Date.now();
  let created = 0;

  for (const template of overviewTemplates) {
    // Skip if already generated
    if (existingTemplateKeys.has(template.key)) {
      continue;
    }

    // Interpolate coreAction into template
    const interpolate = (text: string) =>
      text.replace(/\{\{coreAction\}\}/g, coreAction);

    await ctx.db.insert("metrics", {
      userId: userId as any,
      name: template.name,
      definition: interpolate(template.definition),
      formula: interpolate(template.formula),
      whyItMatters: interpolate(template.whyItMatters),
      howToImprove: interpolate(template.howToImprove),
      category: template.category,
      metricType: "generated",
      templateKey: template.key,
      relatedActivityId: coreUsageStage?._id,
      order: order++,
      createdAt: now,
    });
    created++;
  }

  return { created };
}

// Get all sessions for a journey with computed status
export const listSessionsWithStatus = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("interviewSessions")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    // Compute status for each interview type
    const typeStatuses: Record<string, { status: InterviewStatus; sessionId?: string }> = {};

    for (const type of INTERVIEW_TYPE_ORDER) {
      const typeConfig = INTERVIEW_TYPES[type];

      // Find completed session
      const completed = sessions.find(
        s => s.interviewType === type && s.status === "completed"
      );
      if (completed) {
        typeStatuses[type] = { status: "complete", sessionId: completed._id };
        continue;
      }

      // Find active session
      const active = sessions.find(
        s => s.interviewType === type && s.status === "active"
      );
      if (active) {
        typeStatuses[type] = { status: "in_progress", sessionId: active._id };
        continue;
      }

      // Check dependencies
      const allDepsMet = typeConfig.dependencies.every(dep =>
        sessions.some(s => s.interviewType === dep && s.status === "completed")
      );

      typeStatuses[type] = { status: allDepsMet ? "available" : "locked" };
    }

    return typeStatuses;
  },
});

// Get missing dependencies for a type
export const getMissingDeps = query({
  args: {
    journeyId: v.id("journeys"),
    interviewType: v.string(),
  },
  handler: async (ctx, args) => {
    const typeConfig = INTERVIEW_TYPES[args.interviewType as InterviewType];
    if (!typeConfig) return [];

    const sessions = await ctx.db
      .query("interviewSessions")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    return typeConfig.dependencies.filter(dep =>
      !sessions.some(s => s.interviewType === dep && s.status === "completed")
    );
  },
});

// Get active session for a journey and type (or null)
export const getActiveSession = query({
  args: {
    journeyId: v.id("journeys"),
    interviewType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.interviewType) {
      // Get specific type
      const sessions = await ctx.db
        .query("interviewSessions")
        .withIndex("by_journey_and_type", (q) =>
          q.eq("journeyId", args.journeyId).eq("interviewType", args.interviewType)
        )
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();
      return sessions[0] ?? null;
    } else {
      // Get any active session (backwards compat)
      const sessions = await ctx.db
        .query("interviewSessions")
        .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();
      return sessions[0] ?? null;
    }
  },
});

// Get session by ID
export const getSession = query({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

// Get messages for a session
export const getMessages = query({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("interviewMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

// Create a new interview session
export const createSession = mutation({
  args: {
    journeyId: v.id("journeys"),
    interviewType: v.string(),
  },
  handler: async (ctx, args) => {
    const type = args.interviewType as InterviewType;
    const typeConfig = INTERVIEW_TYPES[type];
    if (!typeConfig) throw new Error(`Invalid interview type: ${args.interviewType}`);

    // Close any existing active sessions of THIS type
    const activeSessions = await ctx.db
      .query("interviewSessions")
      .withIndex("by_journey_and_type", (q) =>
        q.eq("journeyId", args.journeyId).eq("interviewType", args.interviewType)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const session of activeSessions) {
      await ctx.db.patch(session._id, {
        status: "archived",
        completedAt: Date.now(),
      });
    }

    const sessionId = await ctx.db.insert("interviewSessions", {
      journeyId: args.journeyId,
      interviewType: args.interviewType,
      status: "active",
      startedAt: Date.now(),
    });

    // Add initial AI message based on type - action-focused opening questions
    const initialMessages: Record<InterviewType, string> = {
      first_value: "Walk me through what happens when someone first opens your app. What's the first thing they DO?",
      retention: "Think of a user who uses your product regularly. What specific actions do they take in a typical session?",
      value_outcomes: "Tell me about a user who's getting real value from your product. What actions do they take?",
      value_capture: "Walk me through how a user goes from trying your product to becoming a paying customer. What actions lead to conversion?",
      churn: "Think of a user who stopped using your product. What were the last actions they took before leaving?",
      overview: "Let's map out your product's user journey. First, a quick question: What does your product help users do? One sentence is fine.",
    };

    await ctx.db.insert("interviewMessages", {
      sessionId,
      role: "assistant",
      content: initialMessages[type],
      createdAt: Date.now(),
    });

    return sessionId;
  },
});

// Mark a session as complete
export const completeSession = mutation({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "active") throw new Error("Session is not active");

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt: Date.now(),
    });

    // Trigger metric generation for overview interviews
    if (session.interviewType === "overview") {
      const journey = await ctx.db.get(session.journeyId);
      if (journey) {
        try {
          await generateOverviewMetrics(ctx, session.journeyId, journey.userId);
        } catch (error) {
          // Log but don't fail completion if metric generation fails
          console.error("Failed to generate overview metrics:", error);
        }
      }
    }
  },
});

// Reset a completed interview (archive and start fresh)
export const resetSession = mutation({
  args: {
    journeyId: v.id("journeys"),
    interviewType: v.string(),
  },
  handler: async (ctx, args) => {
    // Archive existing sessions of this type
    const sessions = await ctx.db
      .query("interviewSessions")
      .withIndex("by_journey_and_type", (q) =>
        q.eq("journeyId", args.journeyId).eq("interviewType", args.interviewType)
      )
      .collect();

    for (const session of sessions) {
      if (session.status !== "archived") {
        await ctx.db.patch(session._id, {
          status: "archived",
          completedAt: Date.now(),
        });
      }
    }

    // Create new session (reuse createSession logic)
    const type = args.interviewType as InterviewType;
    const typeConfig = INTERVIEW_TYPES[type];
    if (!typeConfig) throw new Error(`Invalid interview type: ${args.interviewType}`);

    const sessionId = await ctx.db.insert("interviewSessions", {
      journeyId: args.journeyId,
      interviewType: args.interviewType,
      status: "active",
      startedAt: Date.now(),
    });

    // Action-focused opening questions (same as createSession)
    const initialMessages: Record<InterviewType, string> = {
      first_value: "Walk me through what happens when someone first opens your app. What's the first thing they DO?",
      retention: "Think of a user who uses your product regularly. What specific actions do they take in a typical session?",
      value_outcomes: "Tell me about a user who's getting real value from your product. What actions do they take?",
      value_capture: "Walk me through how a user goes from trying your product to becoming a paying customer. What actions lead to conversion?",
      churn: "Think of a user who stopped using your product. What were the last actions they took before leaving?",
      overview: "Let's map out your product's user journey. First, a quick question: What does your product help users do? One sentence is fine.",
    };

    await ctx.db.insert("interviewMessages", {
      sessionId,
      role: "assistant",
      content: initialMessages[type],
      createdAt: Date.now(),
    });

    return sessionId;
  },
});

// Confirm the pending First Value candidate
export const confirmFirstValueCandidate = mutation({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.pendingCandidate) throw new Error("No pending candidate to confirm");

    // Move pending to confirmed
    await ctx.db.patch(args.sessionId, {
      confirmedFirstValue: {
        activityName: session.pendingCandidate.activityName,
        reasoning: session.pendingCandidate.reasoning,
        confirmedAt: Date.now(),
      },
      pendingCandidate: undefined,
    });

    return { confirmed: true };
  },
});

// Dismiss the pending First Value candidate
export const dismissFirstValueCandidate = mutation({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      pendingCandidate: undefined,
    });

    return { dismissed: true };
  },
});

// Set pending First Value candidate (called by AI)
export const setPendingCandidate = mutation({
  args: {
    sessionId: v.id("interviewSessions"),
    candidate: v.object({
      activityName: v.string(),
      reasoning: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      pendingCandidate: args.candidate,
    });
    return { success: true };
  },
});

// Get all sessions for a journey with computed metadata
export const getSessionHistory = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("interviewSessions")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    return Promise.all(sessions.map(async (session) => {
      const messages = await ctx.db
        .query("interviewMessages")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      // Count activities added from tool calls
      const activitiesAdded = messages.reduce((count, msg) => {
        if (!msg.toolCalls) return count;
        return count + msg.toolCalls.filter(tc =>
          tc.name === "add_activity" || tc.name === "add_stage"
        ).length;
      }, 0);

      return {
        ...session,
        messageCount: messages.length,
        activitiesAdded,
      };
    }));
  },
});

// Get formatted transcript for a session
export const getTranscript = query({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("interviewMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.createdAt,
      toolCalls: msg.toolCalls,
    }));
  },
});

// Add a message to the session
export const addMessage = mutation({
  args: {
    sessionId: v.id("interviewSessions"),
    role: v.string(),
    content: v.string(),
    toolCalls: v.optional(
      v.array(
        v.object({
          name: v.string(),
          arguments: v.any(),
          result: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("interviewMessages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      toolCalls: args.toolCalls,
      createdAt: Date.now(),
    });
  },
});
