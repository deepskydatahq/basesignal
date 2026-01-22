import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

export interface Activity {
  type: "profile_created" | "interview_completed" | "stage_added";
  timestamp: number;
  description: string;
}

export const getRecentActivity = query({
  args: {},
  handler: async (ctx): Promise<Activity[]> => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const activities: Activity[] = [];

    // Profile created
    if (user.createdAt) {
      activities.push({
        type: "profile_created",
        timestamp: user.createdAt,
        description: "Created product profile",
      });
    }

    // Get user's journeys to find interview sessions and stages
    const journeys = await ctx.db
      .query("journeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Interview completed
    for (const journey of journeys) {
      const sessions = await ctx.db
        .query("interviewSessions")
        .withIndex("by_journey", (q) => q.eq("journeyId", journey._id))
        .collect();

      for (const session of sessions) {
        if (session.status === "completed" && session.completedAt) {
          activities.push({
            type: "interview_completed",
            timestamp: session.completedAt,
            description: `Completed ${session.interviewType ?? "overview"} interview`,
          });
        }
      }

      // Stage added
      const stages = await ctx.db
        .query("stages")
        .withIndex("by_journey", (q) => q.eq("journeyId", journey._id))
        .collect();

      for (const stage of stages) {
        activities.push({
          type: "stage_added",
          timestamp: stage.createdAt,
          description: `Added ${stage.name} stage`,
        });
      }
    }

    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  },
});
