import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const testIdentity = {
  subject: "test-user",
  issuer: "https://clerk.test",
  tokenIdentifier: "https://clerk.test|test-user",
};

describe("getRecentActivity", () => {
  it("returns empty array when user not found", async () => {
    const t = convexTest(schema);

    const asUser = t.withIdentity(testIdentity);
    const activities = await asUser.query(api.activity.getRecentActivity, {});

    expect(activities).toEqual([]);
  });

  it("returns profile_created activity from user createdAt", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: now,
      });
    });

    const asUser = t.withIdentity(testIdentity);
    const activities = await asUser.query(api.activity.getRecentActivity, {});

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      type: "profile_created",
      description: "Created product profile",
    });
    expect(activities[0].timestamp).toBe(now);
  });

  it("returns interview_completed activities from completed sessions", async () => {
    const t = convexTest(schema);
    const now = Date.now();
    const hourAgo = now - 3600000;

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: hourAgo - 1000,
      });

      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview Journey",
        isDefault: true,
        createdAt: hourAgo,
        updatedAt: hourAgo,
      });

      await ctx.db.insert("interviewSessions", {
        journeyId,
        interviewType: "first_value",
        status: "completed",
        startedAt: hourAgo,
        completedAt: now,
      });
    });

    const asUser = t.withIdentity(testIdentity);
    const activities = await asUser.query(api.activity.getRecentActivity, {});

    expect(activities).toHaveLength(2);
    expect(activities[0]).toMatchObject({
      type: "interview_completed",
      timestamp: now,
      description: "Completed first_value interview",
    });
  });

  it("returns stage_added activities from stages", async () => {
    const t = convexTest(schema);
    const now = Date.now();
    const hourAgo = now - 3600000;

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: hourAgo - 1000,
      });

      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview Journey",
        isDefault: true,
        createdAt: hourAgo,
        updatedAt: hourAgo,
      });

      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        position: { x: 0, y: 0 },
        createdAt: now,
        updatedAt: now,
      });
    });

    const asUser = t.withIdentity(testIdentity);
    const activities = await asUser.query(api.activity.getRecentActivity, {});

    expect(activities).toHaveLength(2);
    expect(activities[0]).toMatchObject({
      type: "stage_added",
      timestamp: now,
      description: "Added Account Created stage",
    });
  });

  it("returns activities sorted by timestamp descending, limited to 5", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: now - 6000, // oldest, should be excluded
      });

      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview Journey",
        isDefault: true,
        createdAt: now - 5000,
        updatedAt: now - 5000,
      });

      // Add 6 stages to test the limit
      for (let i = 0; i < 6; i++) {
        await ctx.db.insert("stages", {
          journeyId,
          name: `Stage ${i + 1}`,
          type: "activity",
          position: { x: 0, y: i * 100 },
          createdAt: now - (5 - i) * 1000, // Stage 6 is newest
          updatedAt: now - (5 - i) * 1000,
        });
      }
    });

    const asUser = t.withIdentity(testIdentity);
    const activities = await asUser.query(api.activity.getRecentActivity, {});

    expect(activities).toHaveLength(5);
    expect(activities[0].description).toBe("Added Stage 6 stage");
    expect(activities[4].description).toBe("Added Stage 2 stage");
  });
});
