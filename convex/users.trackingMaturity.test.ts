import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";

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
