import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerExportProfileTool,
  handleExportProfile,
  exportProfileMeta,
} from "./exportProfile.js";
import { registerTools } from "./index.js";
import type { ToolContext } from "../types.js";
import { MockStorage, makeTestProfile } from "./__tests__/mockStorage.js";

describe("export_profile tool", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("registers with correct metadata", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerExportProfileTool(server, { storage });

    const tools = (server as any)._registeredTools;
    expect(tools["export_profile"]).toBeDefined();
    expect(tools["export_profile"].description).toBe(
      exportProfileMeta.description
    );
  });

  it("is included in registerTools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const context: ToolContext = { storage };
    registerTools(server, context, "0.0.1");

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools)).toContain("export_profile");
  });

  it("total tool count is correct", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const context: ToolContext = { storage };
    registerTools(server, context, "0.0.1");

    const tools = (server as any)._registeredTools;
    // ping + list_products + get_profile + get_definition + update_definition + export_profile = 6
    expect(Object.keys(tools)).toHaveLength(6);
  });

  it("exports as json with basesignal_version", async () => {
    await storage.save(
      makeTestProfile({
        id: "p1",
        completeness: 0.5,
        overallConfidence: 0.8,
      })
    );

    const handler = handleExportProfile({ storage });
    const result = await handler({ productId: "p1", format: "json" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.basesignal_version).toBe("1.0");
    expect(parsed.identity.productName).toBe("Test Product");
  });

  it("exports as markdown with section headings", async () => {
    await storage.save(
      makeTestProfile({
        id: "p1",
        completeness: 0.5,
        overallConfidence: 0.8,
      })
    );

    const handler = handleExportProfile({ storage });
    const result = await handler({ productId: "p1", format: "markdown" });

    expect(result.isError).toBeUndefined();
    const md = result.content[0].text;
    expect(md).toContain("# Test Product - Product Profile");
    expect(md).toContain("## Core Identity");
    expect(md).toContain("Exported from Basesignal on");
  });

  it("auto-resolves single product", async () => {
    await storage.save(
      makeTestProfile({
        id: "only",
        completeness: 0.5,
        overallConfidence: 0.8,
      })
    );

    const handler = handleExportProfile({ storage });
    const result = await handler({ format: "json" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.identity.productName).toBe("Test Product");
  });

  it("returns error for no products", async () => {
    const handler = handleExportProfile({ storage });
    const result = await handler({ format: "json" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No products found");
  });

  it("returns error for invalid productId", async () => {
    const handler = handleExportProfile({ storage });
    const result = await handler({ productId: "bad-id", format: "json" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No product found");
  });

  it("returns error for multiple products without productId", async () => {
    await storage.save(makeTestProfile({ id: "p1" }));
    await storage.save(
      makeTestProfile({
        id: "p2",
        identity: {
          productName: "Other",
          description: "B",
          targetCustomer: "B",
          businessModel: "B",
          confidence: 0.7,
          evidence: [],
        },
      })
    );

    const handler = handleExportProfile({ storage });
    const result = await handler({ format: "markdown" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("You have 2 products");
  });
});
