import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import type { ToolDeps, ToolResult } from "./types.js";
import { text, error } from "./types.js";
import { resolveProduct } from "./resolveProduct.js";
import {
  exportProfileAsJson,
  exportProfileAsMarkdown,
} from "./exportFormatters.js";

export const exportProfileMeta = {
  title: "Export Product Profile",
  description:
    "Export a product profile as markdown or JSON. " +
    "Use 'markdown' for readable documents, 'json' for programmatic use.",
};

export const exportProfileSchema = {
  productId: z
    .string()
    .describe(
      "Product ID (from list_products). If omitted and only one product exists, uses that one."
    )
    .optional(),
  format: z
    .enum(["markdown", "json"])
    .describe(
      "Export format: 'markdown' for readable document, 'json' for structured data"
    ),
} as const;

export function handleExportProfile(
  deps: ToolDeps
): (args: {
  productId?: string;
  format: "markdown" | "json";
}) => Promise<ToolResult> {
  return async (args) => {
    const result = await resolveProduct(deps.storage, args.productId);
    if (!result.success) {
      return error(result.error);
    }

    const output =
      args.format === "json"
        ? exportProfileAsJson(result.profile)
        : exportProfileAsMarkdown(result.profile);

    return text(output);
  };
}

export function registerExportProfileTool(
  server: McpServer,
  deps: ToolDeps
) {
  server.registerTool(
    "export_profile",
    { ...exportProfileMeta, inputSchema: exportProfileSchema },
    handleExportProfile(deps)
  );
}
