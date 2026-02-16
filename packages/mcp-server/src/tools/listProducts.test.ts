import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerListProductsTool,
  handleListProducts,
  listProductsMeta,
} from "./listProducts.js";
import { MockStorage, makeTestProfile } from "./__tests__/mockStorage.js";

describe("list_products tool", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("registers with correct name and metadata", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerListProductsTool(server, { storage });

    const tools = (server as any)._registeredTools;
    expect(tools["list_products"]).toBeDefined();
    expect(tools["list_products"].description).toBe(listProductsMeta.description);
  });

  it("returns 'no products' message when empty", async () => {
    const handler = handleListProducts({ storage });
    const result = await handler();

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("No products found");
    expect(result.content[0].text).toContain("scan_product");
  });

  it("returns markdown with single product", async () => {
    await storage.save(
      makeTestProfile({
        id: "prod-1",
        completeness: 0.6,
      })
    );

    const handler = handleListProducts({ storage });
    const result = await handler();

    expect(result.content[0].text).toContain("## Your Products");
    expect(result.content[0].text).toContain("**Test Product**");
    expect(result.content[0].text).toContain("60% complete");
    expect(result.content[0].text).toContain("ID: prod-1");
  });

  it("returns markdown list with multiple products", async () => {
    await storage.save(
      makeTestProfile({
        id: "p1",
        identity: {
          productName: "Alpha",
          description: "A",
          targetCustomer: "A",
          businessModel: "A",
          confidence: 0.8,
          evidence: [],
        },
        completeness: 0.4,
      })
    );
    await storage.save(
      makeTestProfile({
        id: "p2",
        identity: {
          productName: "Beta",
          description: "B",
          targetCustomer: "B",
          businessModel: "B",
          confidence: 0.7,
          evidence: [],
        },
        completeness: 0.8,
      })
    );

    const handler = handleListProducts({ storage });
    const result = await handler();

    expect(result.content[0].text).toContain("**Alpha**");
    expect(result.content[0].text).toContain("**Beta**");
    expect(result.content[0].text).toContain("40% complete");
    expect(result.content[0].text).toContain("80% complete");
  });

  it("output is plain text, not JSON", async () => {
    await storage.save(makeTestProfile({ id: "p1" }));

    const handler = handleListProducts({ storage });
    const result = await handler();

    // Should not be valid JSON (it's markdown)
    expect(() => JSON.parse(result.content[0].text)).toThrow();
  });
});
