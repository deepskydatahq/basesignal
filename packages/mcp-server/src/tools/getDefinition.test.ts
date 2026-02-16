import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerGetDefinitionTool,
  handleGetDefinition,
  getDefinitionMeta,
} from "./getDefinition.js";
import { MockStorage, makeTestProfile } from "./__tests__/mockStorage.js";

describe("get_definition tool", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("registers with correct metadata", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerGetDefinitionTool(server, { storage });

    const tools = (server as any)._registeredTools;
    expect(tools["get_definition"]).toBeDefined();
    expect(tools["get_definition"].description).toBe(
      getDefinitionMeta.description
    );
  });

  it("returns activation definition with evidence", async () => {
    await storage.save(
      makeTestProfile({
        id: "prod-1",
        definitions: {
          activation: {
            criteria: ["Sign up", "Create project"],
            timeWindow: "7 days",
            reasoning: "Core activation path",
            confidence: 0.85,
            source: "website",
            evidence: [
              { url: "https://example.com", excerpt: "onboarding flow" },
            ],
          },
        },
      })
    );

    const handler = handleGetDefinition({ storage });
    const result = await handler({ productId: "prod-1", type: "activation" });

    expect(result.content[0].text).toContain("### Activation");
    expect(result.content[0].text).toContain("Sign up");
    expect(result.content[0].text).toContain("85%");
    expect(result.content[0].text).toContain("https://example.com");
  });

  it("returns top-level section (identity)", async () => {
    await storage.save(
      makeTestProfile({
        id: "prod-1",
      })
    );

    const handler = handleGetDefinition({ storage });
    const result = await handler({ productId: "prod-1", type: "identity" });

    expect(result.content[0].text).toContain("### Identity");
    expect(result.content[0].text).toContain("Test Product");
  });

  it("returns empty section message for null section", async () => {
    await storage.save(
      makeTestProfile({
        id: "prod-1",
      })
    );

    const handler = handleGetDefinition({ storage });
    const result = await handler({ productId: "prod-1", type: "activation" });

    expect(result.content[0].text).toContain(
      "activation definition has not been analyzed yet"
    );
  });

  it("auto-resolves product when omitted", async () => {
    await storage.save(
      makeTestProfile({
        id: "only",
      })
    );

    const handler = handleGetDefinition({ storage });
    const result = await handler({ type: "identity" });

    expect(result.content[0].text).toContain("### Identity");
    expect(result.content[0].text).toContain("Test Product");
  });

  it("returns error on invalid productId", async () => {
    const handler = handleGetDefinition({ storage });
    const result = await handler({ productId: "bad", type: "identity" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No product found");
  });

  it("routes definition types through definitions map", async () => {
    await storage.save(
      makeTestProfile({
        id: "prod-1",
        definitions: {
          firstValue: {
            description: "First aha moment",
            criteria: ["see dashboard"],
            reasoning: "Users see value",
            confidence: 0.75,
            source: "interviews",
            evidence: [],
          },
        },
      })
    );

    const handler = handleGetDefinition({ storage });
    const result = await handler({ productId: "prod-1", type: "firstValue" });

    expect(result.content[0].text).toContain("### First Value");
    expect(result.content[0].text).toContain("see dashboard");
  });

  it("routes top-level types from profile root", async () => {
    await storage.save(
      makeTestProfile({
        id: "prod-1",
        revenue: {
          model: "Subscription",
          hasFreeTier: false,
          tiers: [],
          confidence: 0.7,
          evidence: [],
        },
      })
    );

    const handler = handleGetDefinition({ storage });
    const result = await handler({ productId: "prod-1", type: "revenue" });

    expect(result.content[0].text).toContain("### Revenue");
    expect(result.content[0].text).toContain("Subscription");
  });

  it("formats multi-level activation correctly", async () => {
    await storage.save(
      makeTestProfile({
        id: "prod-1",
        definitions: {
          activation: {
            levels: [
              {
                level: 1,
                name: "Basic",
                signalStrength: "weak",
                criteria: [{ action: "login", count: 1 }],
                reasoning: "Logged in",
                confidence: 0.6,
                evidence: [],
              },
            ],
            primaryActivation: 1,
            overallConfidence: 0.7,
          },
        },
      })
    );

    const handler = handleGetDefinition({ storage });
    const result = await handler({ productId: "prod-1", type: "activation" });

    expect(result.content[0].text).toContain("Multi-Level");
    expect(result.content[0].text).toContain("Basic");
    expect(result.content[0].text).toContain("login x1");
  });
});
