import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

async function getCurrentUserMut(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

interface CompletenessSection {
  id: string;
  name: string;
  complete: boolean;
}

interface CompletenessInfo {
  sections: CompletenessSection[];
  completed: number;
  total: number;
  percentage: number;
}

function calculateCompleteness(data: {
  identity: { productName?: string };
  stages: Doc<"stages">[];
  firstValue: Doc<"firstValueDefinitions"> | null;
  metrics: Doc<"metrics">[];
  entities: Doc<"measurementEntities">[];
}): CompletenessInfo {
  const sections: CompletenessSection[] = [
    { id: "core_identity", name: "Core Identity", complete: !!data.identity.productName },
    { id: "journey_map", name: "User Journey Map", complete: data.stages.length > 0 },
    { id: "first_value", name: "First Value Moment", complete: !!data.firstValue },
    { id: "metric_catalog", name: "Metric Catalog", complete: data.metrics.length > 0 },
    { id: "measurement_plan", name: "Measurement Plan", complete: data.entities.length > 0 },
    // Future sections (always incomplete for now)
    { id: "heartbeat", name: "Heartbeat Event", complete: false },
    { id: "activation", name: "Activation Definition", complete: false },
    { id: "active", name: "Active Definition", complete: false },
    { id: "at_risk", name: "At-Risk Signals", complete: false },
    { id: "churn", name: "Churn Definition", complete: false },
    { id: "expansion", name: "Expansion Triggers", complete: false },
  ];

  const completed = sections.filter((s) => s.complete).length;
  const total = sections.length;

  return {
    sections,
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}

function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const groupKey = String(item[key]);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export const getProfileData = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    // Get overview journey
    const overviewJourney = await ctx.db
      .query("journeys")
      .withIndex("by_user_and_type", (q) =>
        q.eq("userId", user._id).eq("type", "overview")
      )
      .first();

    // Get stages from overview journey
    const stages = overviewJourney
      ? await ctx.db
          .query("stages")
          .withIndex("by_journey", (q) => q.eq("journeyId", overviewJourney._id))
          .collect()
      : [];

    // Get first value definition
    const firstValue = await ctx.db
      .query("firstValueDefinitions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Get metrics
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get measurement entities
    const entities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get activity count
    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get property count
    const properties = await ctx.db
      .query("measurementProperties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Calculate completeness
    const completeness = calculateCompleteness({
      identity: user,
      stages,
      firstValue,
      metrics,
      entities,
    });

    return {
      identity: {
        productName: user.productName,
        websiteUrl: user.websiteUrl,
        hasMultiUserAccounts: user.hasMultiUserAccounts,
        businessType: user.businessType,
        revenueModels: user.revenueModels,
      },
      primaryEntityId: user.primaryEntityId,
      journeyMap: {
        stages,
        journeyId: overviewJourney?._id ?? null,
      },
      firstValue,
      metricCatalog: {
        metrics: groupBy(metrics, "category"),
        totalCount: metrics.length,
      },
      measurementPlan: {
        entities,
        activityCount: activities.length,
        propertyCount: properties.length,
      },
      completeness,
    };
  },
});

export const getOrCreateShareToken = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserMut(ctx);
    if (!user) throw new Error("Not authenticated");

    if (user.shareToken) {
      return user.shareToken;
    }

    const shareToken = crypto.randomUUID().slice(0, 12);
    await ctx.db.patch(user._id, { shareToken });
    return shareToken;
  },
});
