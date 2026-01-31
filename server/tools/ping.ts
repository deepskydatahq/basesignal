import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPingTool(server: McpServer) {
  server.registerTool(
    "ping",
    {
      title: "Ping Basesignal",
      description:
        "Check that the Basesignal MCP server is running and authenticated. Returns server status and your user ID.",
    },
    async (extra) => {
      const authInfo = extra.authInfo as { userId?: string } | undefined;
      const userId = authInfo?.userId ?? null;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "ok",
              server: "basesignal",
              version: "0.1.0",
              authenticated: !!userId,
              userId,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };
    }
  );
}
