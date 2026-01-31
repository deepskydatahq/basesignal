import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./index.js";

describe("product tools", () => {
  function getRegisteredTools() {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server);
    return (server as any)._registeredTools;
  }

  it("registers create_product tool", () => {
    const tools = getRegisteredTools();
    expect(Object.keys(tools)).toContain("create_product");
    expect(tools["create_product"].description).toContain("Create a new product");
  });

  it("registers list_products tool", () => {
    const tools = getRegisteredTools();
    expect(Object.keys(tools)).toContain("list_products");
    expect(tools["list_products"].description).toContain("List all your product");
  });

  it("registers scan_product tool", () => {
    const tools = getRegisteredTools();
    expect(Object.keys(tools)).toContain("scan_product");
    expect(tools["scan_product"].description).toContain("Crawl a product");
  });

  it("registers get_scan_status tool", () => {
    const tools = getRegisteredTools();
    expect(Object.keys(tools)).toContain("get_scan_status");
    expect(tools["get_scan_status"].description).toContain("status");
  });

  it("registers all expected tools", () => {
    const tools = getRegisteredTools();
    const toolNames = Object.keys(tools);
    expect(toolNames).toEqual(
      expect.arrayContaining([
        "ping",
        "create_product",
        "list_products",
        "scan_product",
        "get_scan_status",
      ])
    );
    expect(toolNames).toHaveLength(5);
  });
});
