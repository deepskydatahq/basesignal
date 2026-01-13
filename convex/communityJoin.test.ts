import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("communityJoin.getConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns honor mode by default when no env var set", async () => {
    const t = convexTest(schema);
    delete process.env.COMMUNITY_VERIFICATION_MODE;

    const config = await t.query(api.communityJoin.getConfig, {});

    expect(config.mode).toBe("honor");
  });

  it("returns magic_code mode when env var is set", async () => {
    const t = convexTest(schema);
    process.env.COMMUNITY_VERIFICATION_MODE = "magic_code";

    const config = await t.query(api.communityJoin.getConfig, {});

    expect(config.mode).toBe("magic_code");
  });

  it("returns discord invite URL from env var", async () => {
    const t = convexTest(schema);
    process.env.COMMUNITY_DISCORD_INVITE = "https://discord.gg/test123";

    const config = await t.query(api.communityJoin.getConfig, {});

    expect(config.discordInvite).toBe("https://discord.gg/test123");
  });
});

describe("communityJoin.verify", () => {
  it("updates user and progress when verifying with honor mode", async () => {
    const t = convexTest(schema);

    // Create user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    // Create setup progress
    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "onboarding",
        status: "active",
        stepsCompleted: [],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    await asUser.mutation(api.communityJoin.verify, {
      method: "honor",
    });

    // Check user was updated
    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "test-user"))
        .first();
    });

    expect(user?.communityJoined).toBe(true);
    expect(user?.communityJoinMethod).toBe("honor");
    expect(user?.communityJoinedAt).toBeDefined();

    // Check progress was updated
    const progress = await t.run(async (ctx) => {
      return await ctx.db
        .query("setupProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
    });

    expect(progress?.communityJoinStatus).toBe("verified");
  });

  it("marks as skipped_email for email_fallback method", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "onboarding",
        status: "active",
        stepsCompleted: [],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    await asUser.mutation(api.communityJoin.verify, {
      method: "email_fallback",
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "test-user"))
        .first();
    });

    expect(user?.communityJoined).toBe(false);
    expect(user?.communityJoinMethod).toBe("email_fallback");

    const progress = await t.run(async (ctx) => {
      return await ctx.db
        .query("setupProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
    });

    expect(progress?.communityJoinStatus).toBe("skipped_email");
  });

  it("throws error when not authenticated", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.communityJoin.verify, { method: "honor" })
    ).rejects.toThrow("Not authenticated");
  });
});

describe("communityJoin.verify with magic_code", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.COMMUNITY_MAGIC_CODE = "BASESIGNAL2026";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("accepts correct magic code", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "onboarding",
        status: "active",
        stepsCompleted: [],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    await asUser.mutation(api.communityJoin.verify, {
      method: "magic_code",
      code: "BASESIGNAL2026",
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "test-user"))
        .first();
    });

    expect(user?.communityJoined).toBe(true);
    expect(user?.communityJoinMethod).toBe("magic_code");
  });

  it("rejects incorrect magic code", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "onboarding",
        status: "active",
        stepsCompleted: [],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    await expect(
      asUser.mutation(api.communityJoin.verify, {
        method: "magic_code",
        code: "WRONGCODE",
      })
    ).rejects.toThrow("Invalid code");
  });
});
