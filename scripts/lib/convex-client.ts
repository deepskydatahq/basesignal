import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function createConvexClient(): ConvexHttpClient {
  const url = process.env.VITE_CONVEX_URL;
  if (!url) {
    throw new Error("VITE_CONVEX_URL environment variable is required");
  }
  return new ConvexHttpClient(url);
}

export async function findUserByEmail(
  client: ConvexHttpClient,
  email: string
): Promise<{ _id: Id<"users">; email: string; clerkId?: string; createdAt?: number } | null> {
  // Use a query to find user by email
  const users = await client.query(api.users.getByEmail, { email });
  return users;
}

export { api, internal };
export type { Id };
