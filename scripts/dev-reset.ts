#!/usr/bin/env bun
/**
 * Dev Reset Script
 *
 * Resets a user's data in development environment.
 * Usage: bun run scripts/dev-reset.ts user@example.com
 */

import "dotenv/config";
import { validateDevEnvironment } from "./lib/safety";
import { createConvexClient, findUserByEmail } from "./lib/convex-client";
import { fullReset } from "./lib/reset/full";

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: bun run scripts/dev-reset.ts <email>");
    console.error("Example: bun run scripts/dev-reset.ts user@example.com");
    process.exit(1);
  }

  // Safety check
  console.log("🔒 Safety check: validating dev environment...");
  try {
    validateDevEnvironment();
    console.log("🔒 Safety check: dev environment confirmed");
  } catch (error) {
    console.error("❌ Safety check failed:", (error as Error).message);
    process.exit(1);
  }

  // Find user
  console.log(`🔍 Finding user: ${email}`);
  const client = createConvexClient();
  const user = await findUserByEmail(client, email);

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  const createdDate = user.createdAt
    ? new Date(user.createdAt).toISOString().split("T")[0]
    : "unknown";
  console.log(`📋 Found user: ${user._id} (created ${createdDate})`);

  // Perform reset
  const result = await fullReset(client, user._id, user.clerkId);

  if (result.clerkDeleted) {
    console.log("✅ Reset complete - you can now sign up again with this email");
  } else {
    console.log("✅ Convex data reset complete");
    console.log("⚠️  Note: Clerk user was not deleted (no clerkId or deletion failed)");
  }
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
