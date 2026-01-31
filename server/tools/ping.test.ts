import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./index.js";

describe("ping tool", () => {
  it("is registered on the server", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools)).toContain("ping");
  });

  it("has correct metadata", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server);

    const tools = (server as any)._registeredTools;
    const ping = tools["ping"];
    expect(ping).toBeDefined();
    expect(ping.description).toBe(
      "Check that the Basesignal MCP server is running and authenticated. Returns server status and your user identity."
    );
  });
});
