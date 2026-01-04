import { ConvexHttpClient } from "convex/browser";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { deleteClerkUser } from "../clerk-client";

export interface ResetResult {
  convexDeleted: {
    interviewMessages: number;
    interviewSessions: number;
    transitions: number;
    stages: number;
    journeys: number;
    setupProgress: number;
    users: number;
  };
  clerkDeleted: boolean;
}

export async function fullReset(
  client: ConvexHttpClient,
  userId: Id<"users">,
  clerkId: string | undefined
): Promise<ResetResult> {
  // Delete from Convex first
  console.log("🗑️  Deleting Convex data...");
  const convexResult = await client.mutation(internal.devReset.deleteUserData, { userId });

  const counts = convexResult.deletedCounts;
  console.log(`   - ${counts.interviewMessages} interview messages`);
  console.log(`   - ${counts.interviewSessions} interview sessions`);
  console.log(`   - ${counts.transitions} transitions`);
  console.log(`   - ${counts.stages} stages`);
  console.log(`   - ${counts.journeys} journeys`);
  console.log(`   - ${counts.setupProgress} setup progress`);
  console.log(`   - ${counts.users} user record`);

  // Delete from Clerk if we have a clerkId
  let clerkDeleted = false;
  if (clerkId) {
    console.log("🗑️  Deleting from Clerk...");
    try {
      await deleteClerkUser(clerkId);
      clerkDeleted = true;
    } catch (error) {
      console.error("   Warning: Failed to delete from Clerk:", error);
    }
  } else {
    console.log("⚠️  No Clerk ID found, skipping Clerk deletion");
  }

  return {
    convexDeleted: counts,
    clerkDeleted,
  };
}
