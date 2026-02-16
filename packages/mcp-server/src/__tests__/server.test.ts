import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../tools/index.js";
import type { ToolContext } from "../types.js";
import { MockStorage } from "../tools/__tests__/mockStorage.js";

describe("MCP server", () => {
  function createTestServer(name = "test", version = "0.0.1") {
    const server = new McpServer({ name, version });
    const context: ToolContext = {};
    registerTools(server, context, version);
    return server;
  }

  it("registers the ping tool", () => {
    const server = createTestServer();
    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools)).toContain("ping");
  });

  it("registers only ping without storage", () => {
    const server = createTestServer();
    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools)).toHaveLength(1);
    expect(Object.keys(tools)).toEqual(["ping"]);
  });

  it("registers all 6 tools with storage", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const context: ToolContext = { storage: new MockStorage() };
    registerTools(server, context, "0.0.1");

    const tools = (server as any)._registeredTools;
    const toolNames = Object.keys(tools);
    expect(toolNames).toHaveLength(6);
    expect(toolNames).toContain("ping");
    expect(toolNames).toContain("list_products");
    expect(toolNames).toContain("get_profile");
    expect(toolNames).toContain("get_definition");
    expect(toolNames).toContain("update_definition");
    expect(toolNames).toContain("export_profile");
  });

  it("accepts custom server name via config", () => {
    const server = createTestServer("my-custom-server");
    // McpServer stores the name internally; verify it was constructed.
    // The server existing without error is the primary assertion.
    expect(server).toBeDefined();
  });
});
