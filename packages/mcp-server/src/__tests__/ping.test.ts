import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from "../tools/ping.js";

describe("ping tool", () => {
  it("is registered with correct metadata", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerPingTool(server, "0.0.1");

    const tools = (server as any)._registeredTools;
    const ping = tools["ping"];
    expect(ping).toBeDefined();
    expect(ping.description).toBe(
      "Check that the Basesignal MCP server is running. Returns server status."
    );
  });

  it("returns status ok with server info", async () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerPingTool(server, "0.0.1");

    const tools = (server as any)._registeredTools;
    const pingHandler = tools["ping"].handler;
    const result = await pingHandler({});

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("ok");
    expect(parsed.server).toBe("basesignal");
    expect(parsed.version).toBe("0.0.1");
    expect(parsed.timestamp).toBeDefined();
  });

  it("does NOT include user identity fields", async () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerPingTool(server, "0.0.1");

    const tools = (server as any)._registeredTools;
    const pingHandler = tools["ping"].handler;
    const result = await pingHandler({});
    const parsed = JSON.parse(result.content[0].text);

    // These fields belong to the hosted server, not the open-source package
    expect(parsed).not.toHaveProperty("authenticated");
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed).not.toHaveProperty("clerkId");
    expect(parsed).not.toHaveProperty("email");
    expect(parsed).not.toHaveProperty("name");
  });

  it("reflects the configured version", async () => {
    const server = new McpServer({ name: "test", version: "2.0.0" });
    registerPingTool(server, "2.0.0");

    const tools = (server as any)._registeredTools;
    const pingHandler = tools["ping"].handler;
    const result = await pingHandler({});
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.version).toBe("2.0.0");
  });
});
