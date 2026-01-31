import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withUser } from "../lib/withUser.js";

export function registerPingTool(server: McpServer) {
  server.registerTool(
    "ping",
    {
      title: "Ping Basesignal",
      description:
        "Check that the Basesignal MCP server is running and authenticated. Returns server status and your user identity.",
    },
    withUser(async (user) => {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "ok",
              server: "basesignal",
              version: "0.1.0",
              authenticated: true,
              userId: user._id,
              clerkId: user.clerkId,
              email: user.email,
              name: user.name,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };
    })
  );
}
