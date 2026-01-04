import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const deleteUserData = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const deletedCounts = {
      interviewMessages: 0,
      interviewSessions: 0,
      transitions: 0,
      stages: 0,
      journeys: 0,
      setupProgress: 0,
      users: 0,
    };

    // Get all journeys for this user
    const journeys = await ctx.db
      .query("journeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // For each journey, delete all related data
    for (const journey of journeys) {
      // Get all interview sessions for this journey
      const sessions = await ctx.db
        .query("interviewSessions")
        .withIndex("by_journey", (q) => q.eq("journeyId", journey._id))
        .collect();

      // Delete interview messages for each session
      for (const session of sessions) {
        const messages = await ctx.db
          .query("interviewMessages")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();

        for (const message of messages) {
          await ctx.db.delete(message._id);
          deletedCounts.interviewMessages++;
        }

        await ctx.db.delete(session._id);
        deletedCounts.interviewSessions++;
      }

      // Delete transitions
      const transitions = await ctx.db
        .query("transitions")
        .withIndex("by_journey", (q) => q.eq("journeyId", journey._id))
        .collect();

      for (const transition of transitions) {
        await ctx.db.delete(transition._id);
        deletedCounts.transitions++;
      }

      // Delete stages
      const stages = await ctx.db
        .query("stages")
        .withIndex("by_journey", (q) => q.eq("journeyId", journey._id))
        .collect();

      for (const stage of stages) {
        await ctx.db.delete(stage._id);
        deletedCounts.stages++;
      }

      // Delete the journey
      await ctx.db.delete(journey._id);
      deletedCounts.journeys++;
    }

    // Delete setup progress
    const setupProgress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const progress of setupProgress) {
      await ctx.db.delete(progress._id);
      deletedCounts.setupProgress++;
    }

    // Delete the user
    await ctx.db.delete(userId);
    deletedCounts.users++;

    return { deletedCounts };
  },
});
