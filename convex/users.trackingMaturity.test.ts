import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("users schema - tracking maturity fields", () => {
  it("accepts tracking maturity fields in user record", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        trackingStatus: "partial",
        trackingPainPoint: "no_outcomes",
        trackingPainPointOther: undefined,
        analyticsTools: ["amplitude", "mixpanel"],
        createdAt: Date.now(),
      });
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(user?.trackingStatus).toBe("partial");
    expect(user?.trackingPainPoint).toBe("no_outcomes");
    expect(user?.analyticsTools).toEqual(["amplitude", "mixpanel"]);
  });

  it("accepts trackingPainPointOther when pain point is other", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-2",
        email: "test2@example.com",
        trackingStatus: "minimal",
        trackingPainPoint: "other",
        trackingPainPointOther: "We have too many conflicting tools",
        analyticsTools: ["custom"],
        createdAt: Date.now(),
      });
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(user?.trackingPainPoint).toBe("other");
    expect(user?.trackingPainPointOther).toBe("We have too many conflicting tools");
  });
});

async function setupAuthenticatedUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user",
  });

  return { userId, asUser };
}

describe("updateTrackingMaturity mutation", () => {
  it("updates user with tracking maturity data", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupAuthenticatedUser(t);

    await asUser.mutation(api.users.updateTrackingMaturity, {
      trackingStatus: "partial",
      trackingPainPoint: "no_outcomes",
      analyticsTools: ["amplitude", "segment"],
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(user?.trackingStatus).toBe("partial");
    expect(user?.trackingPainPoint).toBe("no_outcomes");
    expect(user?.analyticsTools).toEqual(["amplitude", "segment"]);
  });

  it("saves trackingPainPointOther when pain point is other", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupAuthenticatedUser(t);

    await asUser.mutation(api.users.updateTrackingMaturity, {
      trackingStatus: "none",
      trackingPainPoint: "other",
      trackingPainPointOther: "Our data is siloed across teams",
      analyticsTools: ["none"],
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(user?.trackingPainPoint).toBe("other");
    expect(user?.trackingPainPointOther).toBe("Our data is siloed across teams");
  });

  it("throws error when not authenticated", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.users.updateTrackingMaturity, {
        trackingStatus: "full",
        trackingPainPoint: "trust",
        analyticsTools: ["amplitude"],
      })
    ).rejects.toThrow("Not authenticated");
  });
});
