import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const evidenceValidator = v.array(v.object({ url: v.string(), excerpt: v.string() }));

const sectionValidators = {
  identity: v.object({
    productName: v.string(),
    description: v.string(),
    targetCustomer: v.string(),
    businessModel: v.string(),
    industry: v.optional(v.string()),
    companyStage: v.optional(v.string()),
    confidence: v.number(),
    evidence: evidenceValidator,
  }),
  revenue: v.object({
    model: v.string(),
    billingUnit: v.optional(v.string()),
    hasFreeTier: v.boolean(),
    tiers: v.array(v.object({
      name: v.string(),
      price: v.string(),
      features: v.array(v.string()),
    })),
    expansionPaths: v.array(v.string()),
    contractionRisks: v.array(v.string()),
    confidence: v.number(),
    evidence: evidenceValidator,
  }),
  entities: v.object({
    items: v.array(v.object({
      name: v.string(),
      type: v.string(),
      properties: v.array(v.string()),
    })),
    relationships: v.array(v.object({
      from: v.string(),
      to: v.string(),
      type: v.string(),
    })),
    confidence: v.number(),
    evidence: evidenceValidator,
  }),
  journey: v.object({
    stages: v.array(v.object({
      name: v.string(),
      description: v.string(),
      order: v.number(),
    })),
    confidence: v.number(),
    evidence: evidenceValidator,
  }),
  outcomes: v.object({
    items: v.array(v.object({
      description: v.string(),
      type: v.string(),
      linkedFeatures: v.array(v.string()),
    })),
    confidence: v.number(),
    evidence: evidenceValidator,
  }),
  metrics: v.object({
    items: v.array(v.object({
      name: v.string(),
      category: v.string(),
      formula: v.optional(v.string()),
      linkedTo: v.array(v.string()),
    })),
    confidence: v.number(),
    evidence: evidenceValidator,
  }),
} as const;

// Top-level sections that contribute to completeness
const TOP_SECTIONS = ["identity", "revenue", "entities", "journey", "outcomes", "metrics"] as const;
// Definition sub-sections also contribute
const DEFINITION_KEYS = ["activation", "firstValue", "active", "atRisk", "churn"] as const;
// Total sections for completeness: 6 top + 4 definitions (excluding firstValue for the count = activation, active, atRisk, churn)
// Actually per design doc: identity, revenue, entities, journey, definitions.activation, definitions.firstValue, definitions.active, definitions.churn, outcomes, metrics = 10
const TOTAL_SECTIONS = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAuthenticatedUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();
  return user;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateCompletenessAndConfidence(profile: any) {
  let filledSections = 0;
  let totalConfidence = 0;

  for (const section of TOP_SECTIONS) {
    if (profile[section]) {
      filledSections++;
      totalConfidence += profile[section].confidence ?? 0;
    }
  }

  // Check definition sub-sections: activation, firstValue, active, churn (4 from design doc)
  const defKeys = ["activation", "firstValue", "active", "churn"] as const;
  if (profile.definitions) {
    for (const key of defKeys) {
      if (profile.definitions[key]) {
        filledSections++;
        totalConfidence += profile.definitions[key].confidence ?? 0;
      }
    }
  }

  const completeness = filledSections / TOTAL_SECTIONS;
  const overallConfidence = filledSections > 0 ? totalConfidence / filledSections : 0;

  return { completeness, overallConfidence };
}

export const create = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Verify product ownership
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== user._id) {
      throw new Error("Product not found");
    }

    // Check if profile already exists
    const existing = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("productProfiles", {
      productId: args.productId,
      completeness: 0,
      overallConfidence: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const get = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) return null;

    // Verify product ownership
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== user._id) return null;

    return await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
  },
});

// Internal version for use by Convex actions (no auth check)
export const createInternal = internalMutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // Check if profile already exists
    const existing = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("productProfiles", {
      productId: args.productId,
      completeness: 0,
      overallConfidence: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Internal version for use by Convex actions (no auth check)
export const getInternal = internalQuery({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
  },
});

export const updateSection = mutation({
  args: {
    productId: v.id("products"),
    section: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== user._id) {
      throw new Error("Product not found");
    }

    const profile = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
    if (!profile) throw new Error("Profile not found");

    // Build update
    const update: Record<string, unknown> = {
      [args.section]: args.data,
      updatedAt: Date.now(),
    };

    // Patch the profile
    await ctx.db.patch(profile._id, update);

    // Recalculate completeness
    const updated = await ctx.db.get(profile._id);
    if (updated) {
      const { completeness, overallConfidence } = calculateCompletenessAndConfidence(updated);
      await ctx.db.patch(profile._id, { completeness, overallConfidence });
    }
  },
});

export const validateSection = mutation({
  args: {
    productId: v.id("products"),
    section: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== user._id) {
      throw new Error("Product not found");
    }

    const profile = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
    if (!profile) throw new Error("Profile not found");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sectionData = (profile as any)[args.section];
    if (!sectionData) throw new Error(`Section ${args.section} not found`);

    // Set confidence to 1.0
    await ctx.db.patch(profile._id, {
      [args.section]: { ...sectionData, confidence: 1.0 },
      updatedAt: Date.now(),
    });

    // Recalculate overall confidence
    const updated = await ctx.db.get(profile._id);
    if (updated) {
      const { completeness, overallConfidence } = calculateCompletenessAndConfidence(updated);
      await ctx.db.patch(profile._id, { completeness, overallConfidence });
    }
  },
});

export const remove = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== user._id) {
      throw new Error("Product not found");
    }

    const profile = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
    if (profile) {
      await ctx.db.delete(profile._id);
    }
  },
});
