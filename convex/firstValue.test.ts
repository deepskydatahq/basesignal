import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to set up authenticated user
async function setupUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-fv",
      email: "fv-test@example.com",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user-fv",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user-fv",
  });

  return { userId, asUser };
}

// Helper to set up authenticated user with journey and session
async function setupFirstValueSession(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-fv-session",
      email: "fv-session@example.com",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user-fv-session",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user-fv-session",
  });

  const journeyId = await asUser.mutation(api.journeys.create, {
    type: "first_value",
    name: "First Value Journey",
  });

  const sessionId = await asUser.mutation(api.interviews.createSession, {
    journeyId,
    interviewType: "first_value",
  });

  return { userId, asUser, journeyId, sessionId };
}

describe("firstValueDefinitions schema", () => {
  it("allows inserting a first value definition", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const definitionId = await t.run(async (ctx) => {
      return await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Project Published",
        reasoning: "Users see their work live for the first time",
        expectedTimeframe: "Within first session",
        confirmedAt: Date.now(),
        source: "interview",
      });
    });

    expect(definitionId).toBeDefined();

    const definition = await t.run(async (ctx) => {
      return await ctx.db.get(definitionId);
    });

    expect(definition?.activityName).toBe("Project Published");
  });
});

describe("firstValue.getDefinition", () => {
  it("returns null when no definition exists", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const definition = await asUser.query(api.firstValue.getDefinition, {});

    expect(definition).toBeNull();
  });

  it("returns the definition when it exists", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupUser(t);

    // Create definition directly in db
    await t.run(async (ctx) => {
      await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Project Published",
        reasoning: "Users see their work live",
        expectedTimeframe: "Within first session",
        confirmedAt: Date.now(),
        source: "interview",
      });
    });

    const definition = await asUser.query(api.firstValue.getDefinition, {});

    expect(definition).not.toBeNull();
    expect(definition?.activityName).toBe("Project Published");
    expect(definition?.reasoning).toBe("Users see their work live");
  });
});

describe("interviewSessions First Value fields", () => {
  it("supports pendingCandidate field", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-session",
        email: "session@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "Test Journey",
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const sessionId = await t.run(async (ctx) => {
      return await ctx.db.insert("interviewSessions", {
        journeyId,
        interviewType: "first_value",
        status: "active",
        startedAt: Date.now(),
        pendingCandidate: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
        },
      });
    });

    const session = await t.run(async (ctx) => {
      return await ctx.db.get(sessionId);
    });

    expect(session?.pendingCandidate?.activityName).toBe("Project Published");
    expect(session?.pendingCandidate?.reasoning).toBe("Users see their work live");
  });

  it("supports confirmedFirstValue field", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-session-2",
        email: "session2@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "Test Journey 2",
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const sessionId = await t.run(async (ctx) => {
      return await ctx.db.insert("interviewSessions", {
        journeyId,
        interviewType: "first_value",
        status: "active",
        startedAt: Date.now(),
        confirmedFirstValue: {
          activityName: "Report Generated",
          reasoning: "Users see actionable insights",
          confirmedAt: Date.now(),
        },
      });
    });

    const session = await t.run(async (ctx) => {
      return await ctx.db.get(sessionId);
    });

    expect(session?.confirmedFirstValue?.activityName).toBe("Report Generated");
    expect(session?.confirmedFirstValue?.confirmedAt).toBeDefined();
  });
});

describe("interviews.confirmFirstValueCandidate", () => {
  it("moves pendingCandidate to confirmedFirstValue", async () => {
    const t = convexTest(schema);
    const { asUser, sessionId } = await setupFirstValueSession(t);

    // Set pending candidate directly
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        pendingCandidate: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
        },
      });
    });

    // Confirm the candidate
    await asUser.mutation(api.interviews.confirmFirstValueCandidate, {
      sessionId,
    });

    const session = await asUser.query(api.interviews.getSession, { sessionId });

    expect(session?.pendingCandidate).toBeUndefined();
    expect(session?.confirmedFirstValue).toBeDefined();
    expect(session?.confirmedFirstValue?.activityName).toBe("Project Published");
    expect(session?.confirmedFirstValue?.confirmedAt).toBeDefined();
  });

  it("throws error when no pending candidate exists", async () => {
    const t = convexTest(schema);
    const { asUser, sessionId } = await setupFirstValueSession(t);

    await expect(
      asUser.mutation(api.interviews.confirmFirstValueCandidate, { sessionId })
    ).rejects.toThrow(/no pending candidate/i);
  });
});

describe("interviews.dismissFirstValueCandidate", () => {
  it("clears pendingCandidate", async () => {
    const t = convexTest(schema);
    const { asUser, sessionId } = await setupFirstValueSession(t);

    // Set pending candidate directly
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        pendingCandidate: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
        },
      });
    });

    // Dismiss the candidate
    await asUser.mutation(api.interviews.dismissFirstValueCandidate, {
      sessionId,
    });

    const session = await asUser.query(api.interviews.getSession, { sessionId });

    expect(session?.pendingCandidate).toBeUndefined();
    expect(session?.confirmedFirstValue).toBeUndefined();
  });
});

describe("firstValue.completeFirstValueInterview", () => {
  it("saves definition and completes session", async () => {
    const t = convexTest(schema);
    const { userId, asUser, sessionId } = await setupFirstValueSession(t);

    // Set confirmed First Value
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        confirmedFirstValue: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
          confirmedAt: Date.now(),
        },
      });
    });

    await asUser.mutation(api.firstValue.completeFirstValueInterview, {
      sessionId,
      expectedTimeframe: "Within first session",
      successCriteria: "User shares the published link",
    });

    // Verify definition was created
    const definition = await t.run(async (ctx) => {
      return await ctx.db
        .query("firstValueDefinitions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
    });

    expect(definition).not.toBeNull();
    expect(definition?.activityName).toBe("Project Published");
    expect(definition?.reasoning).toBe("Users see their work live");
    expect(definition?.expectedTimeframe).toBe("Within first session");
    expect(definition?.successCriteria).toBe("User shares the published link");
    expect(definition?.source).toBe("interview");

    // Verify session was completed
    const session = await asUser.query(api.interviews.getSession, { sessionId });
    expect(session?.status).toBe("completed");
  });

  it("throws error when no confirmed First Value", async () => {
    const t = convexTest(schema);
    const { asUser, sessionId } = await setupFirstValueSession(t);

    await expect(
      asUser.mutation(api.firstValue.completeFirstValueInterview, {
        sessionId,
        expectedTimeframe: "Within first session",
      })
    ).rejects.toThrow(/no confirmed first value/i);
  });

  it("replaces existing definition for the user", async () => {
    const t = convexTest(schema);
    const { userId, asUser, sessionId } = await setupFirstValueSession(t);

    // Create existing definition
    await t.run(async (ctx) => {
      await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Old Activity",
        reasoning: "Old reasoning",
        expectedTimeframe: "Within 24 hours",
        confirmedAt: Date.now() - 10000,
        source: "interview",
      });
    });

    // Set confirmed First Value
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        confirmedFirstValue: {
          activityName: "New Activity",
          reasoning: "New reasoning",
          confirmedAt: Date.now(),
        },
      });
    });

    await asUser.mutation(api.firstValue.completeFirstValueInterview, {
      sessionId,
      expectedTimeframe: "Within first session",
    });

    // Verify only one definition exists (old one replaced)
    const definitions = await t.run(async (ctx) => {
      return await ctx.db
        .query("firstValueDefinitions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    expect(definitions).toHaveLength(1);
    expect(definitions[0].activityName).toBe("New Activity");
  });
});

describe("completeFirstValueInterview marks activity", () => {
  it("sets isFirstValue on matching measurement activity", async () => {
    const t = convexTest(schema);
    const { userId, asUser, sessionId } = await setupFirstValueSession(t);

    // Create entity and activity
    const entityId = await t.run(async (ctx) => {
      return await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Published",
        action: "Published",
        isFirstValue: false,
        createdAt: Date.now(),
      });
    });

    // Set confirmed First Value
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        confirmedFirstValue: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
          confirmedAt: Date.now(),
        },
      });
    });

    await asUser.mutation(api.firstValue.completeFirstValueInterview, {
      sessionId,
      expectedTimeframe: "Within first session",
    });

    // Verify activity was marked
    const activities = await t.run(async (ctx) => {
      return await ctx.db
        .query("measurementActivities")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    const markedActivity = activities.find((a) => a.name === "Project Published");
    expect(markedActivity?.isFirstValue).toBe(true);
  });

  it("clears isFirstValue from previous activity", async () => {
    const t = convexTest(schema);
    const { userId, asUser, sessionId } = await setupFirstValueSession(t);

    // Create entity and two activities
    const entityId = await t.run(async (ctx) => {
      return await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        isFirstValue: true, // Previously marked
        createdAt: Date.now(),
      });
      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Published",
        action: "Published",
        isFirstValue: false,
        createdAt: Date.now(),
      });
    });

    // Set confirmed First Value to the new activity
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        confirmedFirstValue: {
          activityName: "Project Published",
          reasoning: "Users see their work live",
          confirmedAt: Date.now(),
        },
      });
    });

    await asUser.mutation(api.firstValue.completeFirstValueInterview, {
      sessionId,
      expectedTimeframe: "Within first session",
    });

    // Verify old activity was unmarked
    const activities = await t.run(async (ctx) => {
      return await ctx.db
        .query("measurementActivities")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    const oldActivity = activities.find((a) => a.name === "Project Created");
    const newActivity = activities.find((a) => a.name === "Project Published");

    expect(oldActivity?.isFirstValue).toBe(false);
    expect(newActivity?.isFirstValue).toBe(true);
  });
});

describe("firstValue.updateDefinition", () => {
  it("updates existing definition and sets source to manual_edit", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupUser(t);

    // Create initial definition
    await t.run(async (ctx) => {
      await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Project Published",
        reasoning: "Original reasoning",
        expectedTimeframe: "Within first session",
        confirmedAt: Date.now(),
        source: "interview",
      });
    });

    await asUser.mutation(api.firstValue.updateDefinition, {
      activityName: "Report Generated",
      reasoning: "Updated reasoning",
      expectedTimeframe: "Within 24 hours",
      successCriteria: "User exports data",
    });

    const definition = await asUser.query(api.firstValue.getDefinition, {});

    expect(definition?.activityName).toBe("Report Generated");
    expect(definition?.reasoning).toBe("Updated reasoning");
    expect(definition?.expectedTimeframe).toBe("Within 24 hours");
    expect(definition?.successCriteria).toBe("User exports data");
    expect(definition?.source).toBe("manual_edit");
  });

  it("creates definition if none exists", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    await asUser.mutation(api.firstValue.updateDefinition, {
      activityName: "Project Published",
      reasoning: "Users see their work live",
      expectedTimeframe: "Within first session",
    });

    const definition = await asUser.query(api.firstValue.getDefinition, {});

    expect(definition).not.toBeNull();
    expect(definition?.activityName).toBe("Project Published");
    expect(definition?.source).toBe("manual_edit");
  });

  it("throws error for unauthenticated users", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.firstValue.updateDefinition, {
        activityName: "Project Published",
        reasoning: "Test",
        expectedTimeframe: "Test",
      })
    ).rejects.toThrow(/Not authenticated/i);
  });
});
