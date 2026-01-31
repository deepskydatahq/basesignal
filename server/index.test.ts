import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";

describe("MCP server setup", () => {
  it("registers the ping tool", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools)).toContain("ping");
  });

  it("registers at least one tool", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBeGreaterThanOrEqual(1);
  });
});
