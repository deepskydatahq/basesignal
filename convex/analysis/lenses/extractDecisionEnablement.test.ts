import { describe, it, expect } from "vitest";
import {
  PAGE_TYPES,
  filterDecisionEnablementPages,
  buildKnowledgeContext,
  buildBatch1Context,
} from "./extractDecisionEnablement";
import { parseLensResponse } from "./shared";

describe("filterDecisionEnablementPages", () => {
  it("includes features, solutions, customers, homepage page types", () => {
    const pages = [
      { pageType: "features", content: "f", url: "https://x.io/features" },
      { pageType: "solutions", content: "s", url: "https://x.io/solutions" },
      { pageType: "customers", content: "c", url: "https://x.io/customers" },
      { pageType: "homepage", content: "hp", url: "https://x.io" },
    ];

    const result = filterDecisionEnablementPages(pages);
    expect(result).toHaveLength(4);
  });

  it("excludes pricing, help, about, onboarding types", () => {
    const pages = [
      { pageType: "pricing", content: "p", url: "https://x.io/pricing" },
      { pageType: "help", content: "h", url: "https://x.io/help" },
      { pageType: "about", content: "a", url: "https://x.io/about" },
      { pageType: "onboarding", content: "o", url: "https://x.io/onboarding" },
    ];

    const result = filterDecisionEnablementPages(pages);
    expect(result).toHaveLength(0);
  });

  it("sorts by priority: features > solutions > customers > homepage", () => {
    const pages = [
      { pageType: "homepage", content: "hp", url: "https://x.io" },
      { pageType: "customers", content: "c", url: "https://x.io/customers" },
      { pageType: "features", content: "f", url: "https://x.io/features" },
      { pageType: "solutions", content: "s", url: "https://x.io/solutions" },
    ];

    const result = filterDecisionEnablementPages(pages);
    expect(result.map((p) => p.pageType)).toEqual([
      "features",
      "solutions",
      "customers",
      "homepage",
    ]);
  });

  it("returns empty array when no matching pages", () => {
    expect(filterDecisionEnablementPages([])).toHaveLength(0);
  });

  it("PAGE_TYPES matches expected types", () => {
    expect(PAGE_TYPES).toEqual(["features", "solutions", "customers", "homepage"]);
  });
});

describe("buildKnowledgeContext", () => {
  it("includes identity section from profile", () => {
    const profile = {
      identity: {
        productName: "Figma",
        description: "Collaborative design tool",
        targetCustomer: "Design teams",
      },
    };
    const result = buildKnowledgeContext(profile);
    expect(result).toContain("Product: Figma");
    expect(result).toContain("Description: Collaborative design tool");
  });

  it("includes entities section from profile", () => {
    const profile = {
      entities: {
        items: [
          { name: "File", type: "core" },
          { name: "Component", type: "reusable" },
        ],
      },
    };
    const result = buildKnowledgeContext(profile);
    expect(result).toContain("File (core)");
    expect(result).toContain("Component (reusable)");
  });

  it("includes journey stages from profile", () => {
    const profile = {
      journey: {
        stages: [
          { name: "Signup", description: "Create account", order: 1 },
          { name: "First Design", description: "Create first file", order: 2 },
          { name: "Collaborate", description: "Share with team", order: 3 },
        ],
      },
    };
    const result = buildKnowledgeContext(profile);
    expect(result).toContain("Journey stages: Signup → First Design → Collaborate");
  });

  it("returns empty string for null profile", () => {
    expect(buildKnowledgeContext(null)).toBe("");
  });
});

describe("buildBatch1Context", () => {
  it("formats batch1Results into context string", () => {
    const batch1 = {
      effort_value: {
        candidates: [
          { name: "Quick Setup", description: "5-minute onboarding" },
        ],
      },
    };

    const result = buildBatch1Context(batch1);
    expect(result).toContain("Batch 1 Analysis Context");
    expect(result).toContain("Quick Setup: 5-minute onboarding");
  });

  it("handles undefined batch1Results", () => {
    expect(buildBatch1Context(undefined)).toBe("");
  });
});

describe("decision enablement response parsing", () => {
  it("validates decision_enabled field present on each candidate", () => {
    const valid = JSON.stringify([
      {
        name: "Sprint Scope Decision",
        description: "Decide sprint contents",
        role: "Engineering Manager",
        decision_enabled: "Whether to adjust sprint scope based on velocity",
        confidence: "high",
        source_urls: ["https://x.io/features"],
      },
    ]);

    const result = parseLensResponse(valid, "decision_enablement", "decision_enabled");
    expect(result).toHaveLength(1);
    expect(result[0].decision_enabled).toBe("Whether to adjust sprint scope based on velocity");
  });

  it("throws when decision_enabled is missing", () => {
    const missing = JSON.stringify([
      {
        name: "Test",
        description: "desc",
        role: "Tester",
        confidence: "high",
        source_urls: [],
      },
    ]);

    expect(() =>
      parseLensResponse(missing, "decision_enablement", "decision_enabled"),
    ).toThrow("decision_enabled");
  });
});
