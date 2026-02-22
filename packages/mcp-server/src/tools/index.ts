import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from "./ping.js";
import { registerListProductsTool } from "./listProducts.js";
import { registerGetProfileTool } from "./getProfile.js";
import { registerGetDefinitionTool } from "./getDefinition.js";
import { registerUpdateDefinitionTool } from "./updateDefinition.js";
import { registerExportProfileTool } from "./exportProfile.js";
import { registerScanTool } from "./scan.js";
import type { ToolContext } from "../types.js";

export function registerTools(
  server: McpServer,
  context: ToolContext,
  version: string
) {
  registerPingTool(server, version);

  if (context.storage) {
    const deps = { storage: context.storage };
    registerListProductsTool(server, deps);
    registerGetProfileTool(server, deps);
    registerGetDefinitionTool(server, deps);
    registerUpdateDefinitionTool(server, deps);
    registerExportProfileTool(server, deps);
  }

  // Register the scan_product tool when all required dependencies are provided.
  // The scan tool needs a crawler and analysis pipeline in addition to storage.
  if (context.scan) {
    registerScanTool(server, context.scan);
  }
}
