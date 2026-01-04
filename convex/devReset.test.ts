import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("devReset.deleteUserData", () => {
  it("deletes user and all related data", async () => {
    const t = convexTest(schema);

    // Create a user with full data hierarchy
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        clerkId: "clerk_test_123",
        createdAt: Date.now(),
      });

      // Create setup progress
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "overview_interview",
        status: "active",
        stepsCompleted: [],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });

      // Create journey
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Test Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create stage
      const stageId = await ctx.db.insert("stages", {
        journeyId,
        name: "Test Stage",
        type: "entry",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create another stage for transition
      const stage2Id = await ctx.db.insert("stages", {
        journeyId,
        name: "Test Stage 2",
        type: "activity",
        position: { x: 100, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create transition
      await ctx.db.insert("transitions", {
        journeyId,
        fromStageId: stageId,
        toStageId: stage2Id,
        createdAt: Date.now(),
      });

      // Create interview session
      const sessionId = await ctx.db.insert("interviewSessions", {
        journeyId,
        status: "active",
        startedAt: Date.now(),
      });

      // Create interview message
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "user",
        content: "Test message",
        createdAt: Date.now(),
      });

      return userId;
    });

    // Run the delete mutation
    const result = await t.mutation(api.devReset.deleteUserData, { userId });

    // Verify counts
    expect(result.deletedCounts.interviewMessages).toBe(1);
    expect(result.deletedCounts.interviewSessions).toBe(1);
    expect(result.deletedCounts.transitions).toBe(1);
    expect(result.deletedCounts.stages).toBe(2);
    expect(result.deletedCounts.journeys).toBe(1);
    expect(result.deletedCounts.setupProgress).toBe(1);
    expect(result.deletedCounts.users).toBe(1);

    // Verify user is gone
    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId);
      expect(user).toBeNull();
    });
  });

  it("returns zero counts when user has no data", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "empty@example.com",
        clerkId: "clerk_empty",
        createdAt: Date.now(),
      });
    });

    const result = await t.mutation(api.devReset.deleteUserData, { userId });

    expect(result.deletedCounts.users).toBe(1);
    expect(result.deletedCounts.journeys).toBe(0);
  });
});
