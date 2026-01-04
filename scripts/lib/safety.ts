export function validateDevEnvironment(): void {
  const convexUrl = process.env.VITE_CONVEX_URL || "";
  const clerkKey = process.env.CLERK_SECRET_KEY || "";

  // Check Convex URL - block if it contains "prod" (common convention)
  if (convexUrl.includes("prod")) {
    throw new Error(
      `Refusing to run against production Convex: ${convexUrl}\n` +
      "This script only runs in development environments."
    );
  }

  // Check Clerk key - must be test key, not live
  if (clerkKey.startsWith("sk_live_")) {
    throw new Error(
      "Refusing to run with production Clerk key.\n" +
      "CLERK_SECRET_KEY must start with 'sk_test_' for dev scripts."
    );
  }

  // Require both env vars to be set
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL environment variable is required");
  }

  if (!clerkKey) {
    throw new Error("CLERK_SECRET_KEY environment variable is required");
  }
}
