import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { getTemplatesByPhase } from "../src/shared/metricTemplates";

// Helper to get current authenticated user
async function getCurrentUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

// Generate first_value metrics (Activation Rate, Time to First Value)
export const generateFromFirstValue = mutation({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, { journeyId }) => {
    // 1. Get authenticated user
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // 2. Get the first_value journey
    const journey = await ctx.db.get(journeyId);
    if (!journey) throw new Error("Journey not found");
    if (journey.userId !== user._id) throw new Error("Not authorized");

    // 3. Get stages for this journey
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", journeyId))
      .collect();

    // 4. Find activation stage for {{firstValueActivity}} slot
    const activationStage = stages.find((s) => s.lifecycleSlot === "activation");
    if (!activationStage) throw new Error("No activation stage found");

    const firstValueActivity = activationStage.name;

    // 5. Get existing metrics to check for duplicates and determine next order
    const existingMetrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existingTemplateKeys = new Set(
      existingMetrics.map((m) => m.templateKey).filter(Boolean)
    );

    // Find highest existing order
    const maxOrder =
      existingMetrics.length > 0
        ? Math.max(...existingMetrics.map((m) => m.order))
        : 0;

    // 6. Get first_value templates
    const firstValueTemplates = getTemplatesByPhase("first_value");

    // 7. Generate metrics that don't already exist
    let nextOrder = maxOrder + 1;
    const now = Date.now();

    for (const template of firstValueTemplates) {
      // Skip if already generated
      if (existingTemplateKeys.has(template.key)) continue;

      // Interpolate activity name into template
      const interpolate = (text: string) =>
        text.replace(/\{\{firstValueActivity\}\}/g, firstValueActivity);

      await ctx.db.insert("metrics", {
        userId: user._id,
        name: template.name,
        definition: interpolate(template.definition),
        formula: interpolate(template.formula),
        whyItMatters: interpolate(template.whyItMatters),
        howToImprove: interpolate(template.howToImprove),
        category: template.category,
        metricType: "generated",
        templateKey: template.key,
        relatedActivityId: activationStage._id,
        order: nextOrder++,
        createdAt: now,
      });
    }
  },
});
