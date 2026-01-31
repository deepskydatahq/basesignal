import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from "./ping.js";

export function registerTools(server: McpServer) {
  registerPingTool(server);
}
