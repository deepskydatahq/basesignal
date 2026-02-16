import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps, ToolResult } from "./types.js";
import { text } from "./types.js";
import { formatRelativeTime } from "./formatters.js";

export const listProductsMeta = {
  title: "List Products",
  description:
    "List all your product profiles with completeness status.",
};

export function handleListProducts(
  deps: ToolDeps
): () => Promise<ToolResult> {
  return async () => {
    const products = await deps.storage.list();

    if (products.length === 0) {
      return text(
        "No products found. Use scan_product to analyze a website first."
      );
    }

    const lines = ["## Your Products", ""];
    for (const p of products) {
      const updated = formatRelativeTime(p.updatedAt);
      lines.push(
        `- **${p.name}** (${p.url}) -- ${Math.round(p.completeness * 100)}% complete -- updated ${updated} -- ID: ${p.id}`
      );
    }

    return text(lines.join("\n"));
  };
}

export function registerListProductsTool(
  server: McpServer,
  deps: ToolDeps
) {
  server.registerTool("list_products", listProductsMeta, handleListProducts(deps));
}
