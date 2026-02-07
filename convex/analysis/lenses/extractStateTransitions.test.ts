import { describe, it, expect } from "vitest";
import {
  PAGE_TYPES,
  filterStateTransitionPages,
  buildKnowledgeContext,
  buildBatch1Context,
} from "./extractStateTransitions";
import { parseLensResponse } from "./shared";

describe("filterStateTransitionPages", () => {
  it("includes customers, features, onboarding, help, homepage page types", () => {
    const pages = [
      { pageType: "customers", content: "c", url: "https://x.io/customers" },
      { pageType: "features", content: "f", url: "https://x.io/features" },
      { pageType: "onboarding", content: "o", url: "https://x.io/onboarding" },
      { pageType: "help", content: "h", url: "https://x.io/help" },
      { pageType: "homepage", content: "hp", url: "https://x.io" },
    ];

    const result = filterStateTransitionPages(pages);
    expect(result).toHaveLength(5);
  });

  it("excludes pricing, solutions, about, legal types", () => {
    const pages = [
      { pageType: "pricing", content: "p", url: "https://x.io/pricing" },
      { pageType: "solutions", content: "s", url: "https://x.io/solutions" },
      { pageType: "about", content: "a", url: "https://x.io/about" },
      { pageType: "legal", content: "l", url: "https://x.io/legal" },
    ];

    const result = filterStateTransitionPages(pages);
    expect(result).toHaveLength(0);
  });

  it("sorts by priority: customers > features > onboarding > help > homepage", () => {
    const pages = [
      { pageType: "homepage", content: "hp", url: "https://x.io" },
      { pageType: "help", content: "h", url: "https://x.io/help" },
      { pageType: "onboarding", content: "o", url: "https://x.io/onboarding" },
      { pageType: "features", content: "f", url: "https://x.io/features" },
      { pageType: "customers", content: "c", url: "https://x.io/customers" },
    ];

    const result = filterStateTransitionPages(pages);
    expect(result.map((p) => p.pageType)).toEqual([
      "customers",
      "features",
      "onboarding",
      "help",
      "homepage",
    ]);
  });

  it("returns empty array when no matching pages", () => {
    expect(filterStateTransitionPages([])).toHaveLength(0);
  });

  it("PAGE_TYPES matches expected types", () => {
    expect(PAGE_TYPES).toEqual(["customers", "features", "onboarding", "help", "homepage"]);
  });
});

describe("buildKnowledgeContext", () => {
  it("includes identity section from profile", () => {
    const profile = {
      identity: {
        productName: "Notion",
        description: "All-in-one workspace",
        targetCustomer: "Knowledge workers",
      },
    };
    const result = buildKnowledgeContext(profile);
    expect(result).toContain("Product: Notion");
    expect(result).toContain("All-in-one workspace");
  });

  it("includes entities section from profile", () => {
    const profile = {
      entities: {
        items: [
          { name: "Page", type: "core" },
          { name: "Database", type: "structured" },
        ],
      },
    };
    const result = buildKnowledgeContext(profile);
    expect(result).toContain("Page (core)");
    expect(result).toContain("Database (structured)");
  });

  it("includes journey stages from profile", () => {
    const profile = {
      journey: {
        stages: [
          { name: "Signup", description: "Create account", order: 1 },
          { name: "Create", description: "Make first page", order: 2 },
        ],
      },
    };
    const result = buildKnowledgeContext(profile);
    expect(result).toContain("Journey stages: Signup → Create");
  });

  it("includes activation definitions from profile", () => {
    const profile = {
      definitions: {
        activation: {
          levels: [
            { name: "explorer", signalStrength: "weak" },
            { name: "creator", signalStrength: "medium" },
            { name: "collaborator", signalStrength: "strong" },
          ],
        },
      },
    };
    const result = buildKnowledgeContext(profile);
    expect(result).toContain("Activation levels:");
    expect(result).toContain("explorer (weak)");
    expect(result).toContain("creator (medium)");
    expect(result).toContain("collaborator (strong)");
  });

  it("returns empty string for null profile", () => {
    expect(buildKnowledgeContext(null)).toBe("");
  });
});

describe("buildBatch1Context", () => {
  it("formats batch1Results into context string", () => {
    const batch1 = {
      capability_map: {
        candidates: [
          { name: "Wiki", description: "Team knowledge base" },
        ],
      },
    };

    const result = buildBatch1Context(batch1);
    expect(result).toContain("Batch 1 Analysis Context");
    expect(result).toContain("Wiki: Team knowledge base");
  });

  it("handles undefined batch1Results", () => {
    expect(buildBatch1Context(undefined)).toBe("");
  });
});

describe("state transitions response parsing", () => {
  it("validates state_transition field present on each candidate", () => {
    const valid = JSON.stringify([
      {
        name: "Manual → Automated",
        description: "Users move from manual tracking to automated reports",
        role: "Product Manager",
        state_transition: "From: manually tracking status → To: automated progress reports",
        confidence: "high",
        source_urls: ["https://x.io/features"],
      },
    ]);

    const result = parseLensResponse(valid, "state_transitions", "state_transition");
    expect(result).toHaveLength(1);
    expect(result[0].state_transition).toContain("manually tracking");
  });

  it("throws when state_transition is missing", () => {
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
      parseLensResponse(missing, "state_transitions", "state_transition"),
    ).toThrow("state_transition");
  });
});
