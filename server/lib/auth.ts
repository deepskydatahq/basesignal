import { getConvexClient } from "./convex.js";
import { api } from "../../convex/_generated/api.js";

export interface ResolvedUser {
  _id: string;
  clerkId: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

// In-memory cache: clerkId → resolved user
const userCache = new Map<string, ResolvedUser>();

/**
 * Resolve a Clerk user ID to a Convex user record.
 * Creates the user in Convex if they don't exist yet (first MCP login).
 * Results are cached in-memory for the lifetime of the server process.
 */
export async function resolveUser(
  clerkId: string,
  profile?: { email?: string; name?: string; image?: string }
): Promise<ResolvedUser> {
  const cached = userCache.get(clerkId);
  if (cached) return cached;

  const client = getConvexClient();
  const user = await client.mutation(api.users.getOrCreateByClerkId, {
    clerkId,
    email: profile?.email,
    name: profile?.name,
    image: profile?.image,
  });

  const resolved: ResolvedUser = {
    _id: user._id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    image: user.image,
  };

  userCache.set(clerkId, resolved);
  return resolved;
}

/** Clear the user cache (useful for testing). */
export function clearUserCache(): void {
  userCache.clear();
}
