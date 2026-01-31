import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from "./ping.js";
import { registerProductTools } from "./products.js";

export function registerTools(server: McpServer) {
  registerPingTool(server);
  registerProductTools(server);
}
