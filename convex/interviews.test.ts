import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("getSessionHistory", () => {
  it("returns empty array when no sessions exist", async () => {
    const t = convexTest(schema);

    // Create user and journey
    const { journeyId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
      const now = Date.now();
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Test Journey",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      return { journeyId };
    });

    const history = await t.query(api.interviews.getSessionHistory, { journeyId });
    expect(history).toEqual([]);
  });

  it("returns sessions with message count and activities added", async () => {
    const t = convexTest(schema);

    const { journeyId, sessionId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
      const now = Date.now();
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Test Journey",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const sessionId = await ctx.db.insert("interviewSessions", {
        journeyId,
        interviewType: "overview",
        status: "completed",
        startedAt: Date.now() - 3600000,
        completedAt: Date.now(),
      });
      // Add messages with tool calls
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "assistant",
        content: "Let me add a stage.",
        toolCalls: [{ name: "add_stage", arguments: { name: "Signup" }, result: "success" }],
        createdAt: Date.now() - 1000,
      });
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "user",
        content: "Thanks!",
        createdAt: Date.now(),
      });
      return { journeyId, sessionId };
    });

    const history = await t.query(api.interviews.getSessionHistory, { journeyId });

    expect(history).toHaveLength(1);
    expect(history[0]._id).toBe(sessionId);
    expect(history[0].messageCount).toBe(2);
    expect(history[0].activitiesAdded).toBe(1);
    expect(history[0].interviewType).toBe("overview");
    expect(history[0].status).toBe("completed");
  });
});

describe("getTranscript", () => {
  it("returns messages in chronological order with formatted data", async () => {
    const t = convexTest(schema);

    const { sessionId } = await t.run(async (ctx) => {
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: now,
      });
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Test Journey",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const sessionId = await ctx.db.insert("interviewSessions", {
        journeyId,
        interviewType: "overview",
        status: "completed",
        startedAt: now,
      });
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "assistant",
        content: "Hello!",
        createdAt: 1000,
      });
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "user",
        content: "Hi there!",
        createdAt: 2000,
      });
      return { sessionId };
    });

    const transcript = await t.query(api.interviews.getTranscript, { sessionId });

    expect(transcript).toHaveLength(2);
    expect(transcript[0].role).toBe("assistant");
    expect(transcript[0].content).toBe("Hello!");
    expect(transcript[0].timestamp).toBe(1000);
    expect(transcript[1].role).toBe("user");
    expect(transcript[1].content).toBe("Hi there!");
    expect(transcript[1].timestamp).toBe(2000);
  });

  it("includes tool calls in transcript", async () => {
    const t = convexTest(schema);

    const { sessionId } = await t.run(async (ctx) => {
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: now,
      });
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Test Journey",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      const sessionId = await ctx.db.insert("interviewSessions", {
        journeyId,
        interviewType: "overview",
        status: "completed",
        startedAt: now,
      });
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "assistant",
        content: "Adding stage.",
        toolCalls: [{ name: "add_stage", arguments: { name: "Entry" }, result: "success" }],
        createdAt: 1000,
      });
      return { sessionId };
    });

    const transcript = await t.query(api.interviews.getTranscript, { sessionId });

    expect(transcript[0].toolCalls).toBeDefined();
    expect(transcript[0].toolCalls?.[0].name).toBe("add_stage");
  });
});
