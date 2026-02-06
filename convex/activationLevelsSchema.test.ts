import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

async function setupProductProfile(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-clerk-id",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });
  const productId = await t.run(async (ctx) => {
    return await ctx.db.insert("products", {
      userId,
      name: "Test Product",
      url: "https://test.io",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  await t.mutation(internal.productProfiles.createInternal, { productId });
  return { userId, productId };
}

describe("activation levels schema", () => {
  it("accepts activation with levels array containing level objects", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductProfile(t);

    const activationData = {
      levels: [
        {
          level: 1,
          name: "Basic Setup",
          signalStrength: "weak" as const,
          criteria: [
            { action: "create_account", count: 1 },
          ],
          reasoning: "Account creation is minimum engagement",
          confidence: 0.6,
          evidence: [{ url: "https://docs.test.io/onboarding", excerpt: "Users must create an account" }],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.6,
    };

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "definitions",
      data: { activation: activationData },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.definitions?.activation).toBeDefined();
    expect(profile?.definitions?.activation?.levels).toHaveLength(1);
    expect(profile?.definitions?.activation?.primaryActivation).toBe(1);
    expect(profile?.definitions?.activation?.overallConfidence).toBe(0.6);
  });

  it("each level has level number, name, and signalStrength enum", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductProfile(t);

    const activationData = {
      levels: [
        {
          level: 1,
          name: "Setup Complete",
          signalStrength: "weak" as const,
          criteria: [{ action: "complete_setup", count: 1 }],
          reasoning: "Basic setup",
          confidence: 0.5,
          evidence: [],
        },
        {
          level: 2,
          name: "First Value",
          signalStrength: "medium" as const,
          criteria: [{ action: "use_core_feature", count: 1 }],
          reasoning: "Core feature usage",
          confidence: 0.7,
          evidence: [],
        },
        {
          level: 3,
          name: "Habitual Use",
          signalStrength: "strong" as const,
          criteria: [{ action: "use_core_feature", count: 5, timeWindow: "7d" }],
          reasoning: "Repeated engagement",
          confidence: 0.8,
          evidence: [],
        },
        {
          level: 4,
          name: "Power User",
          signalStrength: "very_strong" as const,
          criteria: [{ action: "use_advanced_feature", count: 3, timeWindow: "14d" }],
          reasoning: "Advanced feature adoption",
          confidence: 0.9,
          evidence: [],
        },
      ],
      primaryActivation: 2,
      overallConfidence: 0.75,
    };

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "definitions",
      data: { activation: activationData },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    const levels = profile?.definitions?.activation?.levels;
    expect(levels).toHaveLength(4);

    expect(levels?.[0]?.level).toBe(1);
    expect(levels?.[0]?.name).toBe("Setup Complete");
    expect(levels?.[0]?.signalStrength).toBe("weak");

    expect(levels?.[1]?.signalStrength).toBe("medium");
    expect(levels?.[2]?.signalStrength).toBe("strong");
    expect(levels?.[3]?.signalStrength).toBe("very_strong");
  });

  it("each level has criteria array with action, count, and optional timeWindow", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductProfile(t);

    const activationData = {
      levels: [
        {
          level: 1,
          name: "Engaged",
          signalStrength: "medium" as const,
          criteria: [
            { action: "create_project", count: 1 },
            { action: "invite_teammate", count: 1, timeWindow: "7d" },
          ],
          reasoning: "Project creation plus collaboration",
          confidence: 0.7,
          evidence: [],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.7,
    };

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "definitions",
      data: { activation: activationData },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    const criteria = profile?.definitions?.activation?.levels?.[0]?.criteria;
    expect(criteria).toHaveLength(2);
    expect(criteria?.[0]?.action).toBe("create_project");
    expect(criteria?.[0]?.count).toBe(1);
    expect(criteria?.[0]?.timeWindow).toBeUndefined();
    expect(criteria?.[1]?.action).toBe("invite_teammate");
    expect(criteria?.[1]?.count).toBe(1);
    expect(criteria?.[1]?.timeWindow).toBe("7d");
  });

  it("each level has reasoning, confidence, and evidence array", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductProfile(t);

    const activationData = {
      levels: [
        {
          level: 1,
          name: "Aha Moment",
          signalStrength: "strong" as const,
          criteria: [{ action: "complete_first_workflow", count: 1 }],
          reasoning: "Users who complete a workflow retain 3x better",
          confidence: 0.85,
          evidence: [
            { url: "https://docs.test.io/success", excerpt: "Workflow completion drives retention" },
            { url: "https://blog.test.io/metrics", excerpt: "3x retention for activated users" },
          ],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.85,
    };

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "definitions",
      data: { activation: activationData },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    const level = profile?.definitions?.activation?.levels?.[0];
    expect(level?.reasoning).toBe("Users who complete a workflow retain 3x better");
    expect(level?.confidence).toBe(0.85);
    expect(level?.evidence).toHaveLength(2);
    expect(level?.evidence?.[0]?.url).toBe("https://docs.test.io/success");
    expect(level?.evidence?.[0]?.excerpt).toBe("Workflow completion drives retention");
  });

  it("primaryActivation indicates which level is the aha-moment", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductProfile(t);

    const activationData = {
      levels: [
        {
          level: 1,
          name: "Setup",
          signalStrength: "weak" as const,
          criteria: [{ action: "create_account", count: 1 }],
          reasoning: "Basic entry",
          confidence: 0.5,
          evidence: [],
        },
        {
          level: 2,
          name: "Aha Moment",
          signalStrength: "strong" as const,
          criteria: [{ action: "first_success", count: 1 }],
          reasoning: "This is the aha moment",
          confidence: 0.9,
          evidence: [],
        },
      ],
      primaryActivation: 2,
      overallConfidence: 0.7,
    };

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "definitions",
      data: { activation: activationData },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.definitions?.activation?.primaryActivation).toBe(2);
  });

  it("overallConfidence is a number on the activation object", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductProfile(t);

    const activationData = {
      levels: [
        {
          level: 1,
          name: "Basic",
          signalStrength: "weak" as const,
          criteria: [{ action: "signup", count: 1 }],
          reasoning: "Entry point",
          confidence: 0.4,
          evidence: [],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.65,
    };

    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "definitions",
      data: { activation: activationData },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profile?.definitions?.activation?.overallConfidence).toBe(0.65);
    expect(typeof profile?.definitions?.activation?.overallConfidence).toBe("number");
  });
});
