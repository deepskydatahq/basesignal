import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerGetProfileTool,
  handleGetProfile,
  getProfileMeta,
} from "./getProfile.js";
import { MockStorage, makeTestProfile } from "./__tests__/mockStorage.js";

describe("get_profile tool", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("registers with correct metadata", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerGetProfileTool(server, { storage });

    const tools = (server as any)._registeredTools;
    expect(tools["get_profile"]).toBeDefined();
    expect(tools["get_profile"].description).toBe(getProfileMeta.description);
  });

  it("auto-resolves single product", async () => {
    await storage.save(
      makeTestProfile({
        id: "only",
        completeness: 0.5,
        overallConfidence: 0.8,
      })
    );

    const handler = handleGetProfile({ storage });
    const result = await handler({});

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Test Product -- Product Profile");
    expect(result.content[0].text).toContain("**Completeness:** 50%");
  });

  it("loads explicit productId", async () => {
    await storage.save(
      makeTestProfile({
        id: "p1",
        identity: {
          productName: "Alpha",
          description: "A",
          targetCustomer: "Dev",
          businessModel: "SaaS",
          confidence: 0.9,
          evidence: [],
        },
      })
    );
    await storage.save(
      makeTestProfile({
        id: "p2",
        identity: {
          productName: "Beta",
          description: "B",
          targetCustomer: "PM",
          businessModel: "B2C",
          confidence: 0.7,
          evidence: [],
        },
      })
    );

    const handler = handleGetProfile({ storage });
    const result = await handler({ productId: "p2" });

    expect(result.content[0].text).toContain("Beta -- Product Profile");
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

    const handler = handleGetProfile({ storage });
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("You have 2 products");
  });

  it("returns error for no products", async () => {
    const handler = handleGetProfile({ storage });
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No products found");
  });

  it("returns error for invalid productId", async () => {
    const handler = handleGetProfile({ storage });
    const result = await handler({ productId: "bad-id" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No product found");
  });

  it("includes populated sections in output", async () => {
    await storage.save(
      makeTestProfile({
        id: "full",
        identity: {
          productName: "Full App",
          description: "Complete app",
          targetCustomer: "Everyone",
          businessModel: "Freemium",
          confidence: 0.9,
          evidence: [],
        },
        revenue: {
          model: "Subscription",
          hasFreeTier: true,
          tiers: [],
          confidence: 0.7,
          evidence: [],
        },
        completeness: 0.3,
        overallConfidence: 0.8,
      })
    );

    const handler = handleGetProfile({ storage });
    const result = await handler({ productId: "full" });

    expect(result.content[0].text).toContain("### Identity");
    expect(result.content[0].text).toContain("### Revenue");
  });

  it("lists missing sections", async () => {
    await storage.save(
      makeTestProfile({
        id: "minimal",
        completeness: 0.1,
        overallConfidence: 0.85,
      })
    );

    const handler = handleGetProfile({ storage });
    const result = await handler({ productId: "minimal" });

    expect(result.content[0].text).toContain("### Missing Sections");
    expect(result.content[0].text).toContain("- Revenue");
    expect(result.content[0].text).toContain("- Entities");
  });
});
