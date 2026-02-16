import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerUpdateDefinitionTool,
  handleUpdateDefinition,
  updateDefinitionMeta,
} from "./updateDefinition.js";
import { MockStorage, makeTestProfile } from "./__tests__/mockStorage.js";

describe("update_definition tool", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("registers with correct metadata", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerUpdateDefinitionTool(server, { storage });

    const tools = (server as any)._registeredTools;
    expect(tools["update_definition"]).toBeDefined();
    expect(tools["update_definition"].description).toBe(
      updateDefinitionMeta.description
    );
  });

  it("saves valid identity update and returns confirmation", async () => {
    await storage.save(
      makeTestProfile({
        id: "prod-1",
        completeness: 0.1,
      })
    );

    const handler = handleUpdateDefinition({ storage });
    const result = await handler({
      productId: "prod-1",
      type: "identity",
      data: {
        productName: "New Name",
        description: "Updated description",
        targetCustomer: "Enterprise teams",
        businessModel: "B2B SaaS",
        confidence: 0.95,
        evidence: [{ url: "https://new.com", excerpt: "Updated info" }],
      },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("## Updated: Identity");
    expect(result.content[0].text).toContain("New Name");
    expect(result.content[0].text).toContain("Completeness:");
  });

  it("shows completeness change", async () => {
    // Profile with only identity initially -> completeness ~9% (1/11)
    await storage.save(
      makeTestProfile({
        id: "prod-1",
        completeness: 0.09,
      })
    );

    const handler = handleUpdateDefinition({ storage });
    const result = await handler({
      productId: "prod-1",
      type: "revenue",
      data: {
        model: "Subscription",
        hasFreeTier: true,
        tiers: [{ name: "Free", price: "$0", features: ["basic"] }],
        expansionPaths: ["Enterprise tier"],
        contractionRisks: ["Churn"],
        confidence: 0.8,
        evidence: [{ url: "https://pricing.com", excerpt: "Pricing page" }],
      },
    });

    expect(result.content[0].text).toContain("Completeness:");
    // Should show a change since revenue was just added
    expect(result.content[0].text).toMatch(/Completeness: \d+% -> \d+%/);
  });

  it("returns validation error for invalid data", async () => {
    await storage.save(makeTestProfile({ id: "prod-1" }));

    const handler = handleUpdateDefinition({ storage });
    const result = await handler({
      productId: "prod-1",
      type: "identity",
      data: {
        // Missing required fields
        productName: "",
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation failed for identity");
  });

  it("returns validation error with field paths", async () => {
    await storage.save(makeTestProfile({ id: "prod-1" }));

    const handler = handleUpdateDefinition({ storage });
    const result = await handler({
      productId: "prod-1",
      type: "revenue",
      data: {
        model: "Sub",
        // missing hasFreeTier (required boolean)
        tiers: [],
        expansionPaths: [],
        contractionRisks: [],
        confidence: 0.5,
        evidence: [],
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation failed");
  });

  it("auto-resolves product when omitted", async () => {
    await storage.save(makeTestProfile({ id: "only" }));

    const handler = handleUpdateDefinition({ storage });
    const result = await handler({
      type: "identity",
      data: {
        productName: "Updated",
        description: "Updated desc",
        targetCustomer: "New target",
        businessModel: "B2C",
        confidence: 0.9,
        evidence: [],
      },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Updated");
  });

  it("returns error on invalid productId", async () => {
    const handler = handleUpdateDefinition({ storage });
    const result = await handler({
      productId: "nonexistent",
      type: "identity",
      data: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No product found");
  });

  it("writes definition type to definitions map", async () => {
    await storage.save(makeTestProfile({ id: "prod-1" }));

    const handler = handleUpdateDefinition({ storage });
    await handler({
      productId: "prod-1",
      type: "active",
      data: {
        criteria: ["logged in within 7 days"],
        reasoning: "Regular usage pattern",
        confidence: 0.8,
        source: "analysis",
        evidence: [],
      },
    });

    const saved = await storage.load("prod-1");
    expect(saved).not.toBeNull();
    const defs = saved!.definitions as Record<string, unknown>;
    expect(defs.active).toBeDefined();
    const active = defs.active as { criteria: string[] };
    expect(active.criteria).toContain("logged in within 7 days");
  });

  it("writes top-level type directly to profile", async () => {
    await storage.save(makeTestProfile({ id: "prod-1" }));

    const handler = handleUpdateDefinition({ storage });
    await handler({
      productId: "prod-1",
      type: "entities",
      data: {
        items: [{ name: "User", type: "core", properties: ["email", "name"] }],
        relationships: [],
        confidence: 0.75,
        evidence: [],
      },
    });

    const saved = await storage.load("prod-1");
    expect(saved).not.toBeNull();
    const entities = saved!.entities as { items: Array<{ name: string }> };
    expect(entities.items[0].name).toBe("User");
  });

  it("re-read after save confirms data persisted", async () => {
    await storage.save(makeTestProfile({ id: "prod-1" }));

    const handler = handleUpdateDefinition({ storage });
    await handler({
      productId: "prod-1",
      type: "identity",
      data: {
        productName: "Persisted Product",
        description: "Desc",
        targetCustomer: "Target",
        businessModel: "B2B",
        confidence: 0.9,
        evidence: [],
      },
    });

    const loaded = await storage.load("prod-1");
    expect(loaded).not.toBeNull();
    const identity = loaded!.identity as { productName: string };
    expect(identity.productName).toBe("Persisted Product");
  });
});
