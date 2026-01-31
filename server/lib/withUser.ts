import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { resolveUser, type ResolvedUser } from "./auth.js";

/**
 * Extract the Clerk user ID from MCP authInfo.
 * @clerk/mcp-tools stores it in authInfo.extra.userId
 */
function getClerkId(authInfo?: AuthInfo): string | null {
  const extra = authInfo?.extra as { userId?: string } | undefined;
  return extra?.userId ?? null;
}

/** MCP tool call result type (index signature required by MCP SDK) */
interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** The extra object passed to MCP tool handlers */
interface ToolExtra {
  authInfo?: AuthInfo;
  [key: string]: unknown;
}

/**
 * Wraps an MCP tool handler to automatically resolve the authenticated user.
 *
 * - Extracts clerkId from extra.authInfo (set by mcpAuthClerk middleware)
 * - Resolves to a Convex user record via ConvexHttpClient
 * - Passes the resolved user as the first argument to the inner handler
 * - Returns an error response if authentication is missing
 *
 * Usage (tool with no input schema):
 *   withUser(async (user, extra) => { ... })
 *
 * Usage (tool with input schema):
 *   withUserArgs(async (user, args, extra) => { ... })
 */
export function withUser(
  handler: (user: ResolvedUser, extra: ToolExtra) => Promise<ToolResult>
): (extra: ToolExtra) => Promise<ToolResult> {
  return async (extra: ToolExtra) => {
    const clerkId = getClerkId(extra.authInfo);
    if (!clerkId) {
      return {
        content: [{ type: "text" as const, text: "Authentication required" }],
        isError: true,
      };
    }

    const user = await resolveUser(clerkId);
    return handler(user, extra);
  };
}

/**
 * Like withUser but for tools that have an input schema (args + extra).
 */
export function withUserArgs<TArgs>(
  handler: (
    user: ResolvedUser,
    args: TArgs,
    extra: ToolExtra
  ) => Promise<ToolResult>
): (args: TArgs, extra: ToolExtra) => Promise<ToolResult> {
  return async (args: TArgs, extra: ToolExtra) => {
    const clerkId = getClerkId(extra.authInfo);
    if (!clerkId) {
      return {
        content: [{ type: "text" as const, text: "Authentication required" }],
        isError: true,
      };
    }

    const user = await resolveUser(clerkId);
    return handler(user, args, extra);
  };
}
