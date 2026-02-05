import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { classifyArchetype, selectMetrics } from "./lib/metricSuggestions";

/**
 * Suggest metrics for a product based on its business model.
 *
 * Reads identity + revenue from the product profile, classifies the
 * business archetype, selects relevant metrics from the catalog,
 * and stores the result via updateSectionInternal.
 *
 * Called internally by the scan pipeline or via scheduler.
 */
export const suggestMetrics = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // 1. Read the product profile
    const profile = await ctx.runQuery(
      internal.productProfiles.getInternal,
      { productId: args.productId },
    );

    if (!profile) {
      throw new Error("Product profile not found");
    }

    if (!profile.identity) {
      throw new Error("Product identity section is required");
    }

    // 2. Classify the business archetype
    const archetype = classifyArchetype(
      profile.identity,
      profile.revenue ?? undefined,
    );

    // 3. Select metrics from the catalog
    const metrics = selectMetrics(archetype);

    // 4. Store via updateSectionInternal
    await ctx.runMutation(
      internal.productProfiles.updateSectionInternal,
      {
        productId: args.productId,
        section: "metrics",
        data: {
          items: metrics,
          confidence: 0.7,
          evidence: [],
        },
      },
    );

    return {
      archetype,
      metricsCount: metrics.length,
    };
  },
});
