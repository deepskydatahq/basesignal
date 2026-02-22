import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import type { ToolDeps, ToolResult } from "./types.js";
import { text, error } from "./types.js";
import { resolveProduct } from "./resolveProduct.js";
import { formatProfileOverview } from "./formatters.js";

export const getProfileMeta = {
  title: "Get Product Profile",
  description:
    "Retrieve the full product profile with all analyzed sections. If only one product exists, it auto-resolves.",
};

export const getProfileSchema = {
  productId: z
    .string()
    .describe(
      "Product ID (from list_products). If omitted and only one product exists, uses that one."
    )
    .optional(),
} as const;

export function handleGetProfile(
  deps: ToolDeps
): (args: { productId?: string }) => Promise<ToolResult> {
  return async (args) => {
    const result = await resolveProduct(deps.storage, args.productId);
    if (!result.success) {
      return error(result.error);
    }
    const markdown = formatProfileOverview(result.profile);
    return text(markdown);
  };
}

export function registerGetProfileTool(
  server: McpServer,
  deps: ToolDeps
) {
  server.registerTool(
    "get_profile",
    { ...getProfileMeta, inputSchema: getProfileSchema },
    handleGetProfile(deps)
  );
}
