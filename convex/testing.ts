import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const activationLevelValidator = v.object({
  criteria: v.array(v.string()),
  timeWindow: v.optional(v.string()),
  reasoning: v.string(),
  confidence: v.number(),
  source: v.string(),
  evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
});

/**
 * Inject activation levels into a product profile's definitions section.
 * Used by validation scripts to test profile storage infrastructure.
 *
 * Accepts activation, firstValue, active, and churn definition data.
 * Auto-creates profile if missing, then patches the definitions field
 * and recalculates completeness/confidence.
 */
export const injectActivation = internalMutation({
  args: {
    productId: v.id("products"),
    definitions: v.object({
      activation: v.optional(activationLevelValidator),
      firstValue: v.optional(v.object({
        description: v.string(),
        criteria: v.array(v.string()),
        reasoning: v.string(),
        confidence: v.number(),
        source: v.string(),
        evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
      })),
      active: v.optional(activationLevelValidator),
      churn: v.optional(activationLevelValidator),
    }),
  },
  handler: async (ctx, args) => {
    let profile = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();

    if (!profile) {
      const now = Date.now();
      const id = await ctx.db.insert("productProfiles", {
        productId: args.productId,
        completeness: 0,
        overallConfidence: 0,
        createdAt: now,
        updatedAt: now,
      });
      profile = await ctx.db.get(id);
      if (!profile) throw new Error("Failed to create profile");
    }

    // Merge new definitions with any existing definitions
    const existingDefs = profile.definitions ?? {};
    const mergedDefs = { ...existingDefs, ...args.definitions };

    await ctx.db.patch(profile._id, {
      definitions: mergedDefs,
      updatedAt: Date.now(),
    });

    // Recalculate completeness
    const updated = await ctx.db.get(profile._id);
    if (updated) {
      const { completeness, overallConfidence } = calculateCompletenessAndConfidence(updated);
      await ctx.db.patch(profile._id, { completeness, overallConfidence });
    }

    return profile._id;
  },
});

/**
 * List all products with their profile completeness.
 * Used by validation scripts to check which products have profiles.
 */
export const listProductsWithProfiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    const results = [];

    for (const product of products) {
      const profile = await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .first();

      results.push({
        productId: product._id,
        name: product.name,
        url: product.url,
        hasProfile: !!profile,
        completeness: profile?.completeness ?? 0,
        hasActivation: !!profile?.definitions?.activation,
        hasFirstValue: !!profile?.definitions?.firstValue,
        hasActive: !!profile?.definitions?.active,
        hasChurn: !!profile?.definitions?.churn,
      });
    }

    return results;
  },
});

// Duplicated from productProfiles.ts to keep this module self-contained
const TOP_SECTIONS = ["identity", "revenue", "entities", "journey", "outcomes", "metrics"] as const;
const TOTAL_SECTIONS = 10;

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
