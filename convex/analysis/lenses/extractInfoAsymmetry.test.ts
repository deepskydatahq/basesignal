import { describe, it, expect } from "vitest";
import {
  PAGE_TYPES,
  filterInfoAsymmetryPages,
  buildKnowledgeContext,
  buildBatch1Context,
} from "./extractInfoAsymmetry";
import { parseLensResponse } from "./shared";

describe("filterInfoAsymmetryPages", () => {
  it("includes features, customers, help, homepage, solutions page types", () => {
    const pages = [
      { pageType: "features", content: "f", url: "https://x.io/features" },
      { pageType: "customers", content: "c", url: "https://x.io/customers" },
      { pageType: "help", content: "h", url: "https://x.io/help" },
      { pageType: "homepage", content: "hp", url: "https://x.io" },
      { pageType: "solutions", content: "s", url: "https://x.io/solutions" },
    ];

    const result = filterInfoAsymmetryPages(pages);
    expect(result).toHaveLength(5);
  });

  it("excludes pricing, about, and other non-relevant types", () => {
    const pages = [
      { pageType: "pricing", content: "p", url: "https://x.io/pricing" },
      { pageType: "about", content: "a", url: "https://x.io/about" },
      { pageType: "legal", content: "l", url: "https://x.io/legal" },
      { pageType: "onboarding", content: "o", url: "https://x.io/onboarding" },
    ];

    const result = filterInfoAsymmetryPages(pages);
    expect(result).toHaveLength(0);
  });

  it("sorts by priority: features > customers > help > homepage > solutions", () => {
    const pages = [
      { pageType: "solutions", content: "s", url: "https://x.io/solutions" },
      { pageType: "homepage", content: "hp", url: "https://x.io" },
      { pageType: "features", content: "f", url: "https://x.io/features" },
      { pageType: "customers", content: "c", url: "https://x.io/customers" },
      { pageType: "help", content: "h", url: "https://x.io/help" },
    ];

    const result = filterInfoAsymmetryPages(pages);
    expect(result.map((p) => p.pageType)).toEqual([
      "features",
      "customers",
      "help",
      "homepage",
      "solutions",
    ]);
  });

  it("returns empty array when no matching pages", () => {
    expect(filterInfoAsymmetryPages([])).toHaveLength(0);
  });

  it("PAGE_TYPES matches expected types", () => {
    expect(PAGE_TYPES).toEqual(["features", "customers", "help", "homepage", "solutions"]);
  });
});

describe("buildKnowledgeContext", () => {
  it("includes identity section from profile", () => {
    const profile = {
      identity: {
        productName: "Linear",
        description: "Issue tracking for teams",
        targetCustomer: "Engineering teams",
      },
    };
    const result = buildKnowledgeContext(profile);
    expect(result).toContain("Product: Linear");
    expect(result).toContain("Description: Issue tracking for teams");
    expect(result).toContain("Target customer: Engineering teams");
  });

  it("includes entities section from profile", () => {
    const profile = {
      entities: {
        items: [
          { name: "Issue", type: "core" },
          { name: "Project", type: "container" },
        ],
      },
    };
    const result = buildKnowledgeContext(profile);
    expect(result).toContain("Key entities:");
    expect(result).toContain("Issue (core)");
    expect(result).toContain("Project (container)");
  });

  it("includes revenue section from profile", () => {
    const profile = {
      revenue: {
        model: "seat_subscription",
        hasFreeTier: true,
        tiers: [{ name: "Free" }, { name: "Pro" }],
      },
    };
    const result = buildKnowledgeContext(profile);
    expect(result).toContain("Revenue model: seat_subscription");
    expect(result).toContain("Free tier: Yes");
    expect(result).toContain("Tiers: Free, Pro");
  });

  it("returns empty string for null profile", () => {
    expect(buildKnowledgeContext(null)).toBe("");
  });

  it("returns empty string for profile with no relevant sections", () => {
    expect(buildKnowledgeContext({})).toBe("");
  });
});

describe("buildBatch1Context", () => {
  it("formats batch1Results into readable context string", () => {
    const batch1 = {
      capability_map: {
        candidates: [
          { name: "Kanban Boards", description: "Visual workflow management" },
          { name: "Sprints", description: "Time-boxed iteration planning" },
        ],
      },
    };

    const result = buildBatch1Context(batch1);
    expect(result).toContain("Batch 1 Analysis Context");
    expect(result).toContain("capability_map findings:");
    expect(result).toContain("Kanban Boards: Visual workflow management");
  });

  it("handles undefined batch1Results gracefully", () => {
    expect(buildBatch1Context(undefined)).toBe("");
  });

  it("handles empty batch1Results", () => {
    expect(buildBatch1Context({})).toBe("");
  });

  it("limits to 5 candidates per lens type", () => {
    const batch1 = {
      capability_map: {
        candidates: Array.from({ length: 10 }, (_, i) => ({
          name: `Cap ${i}`,
          description: `Desc ${i}`,
        })),
      },
    };

    const result = buildBatch1Context(batch1);
    const capCount = (result.match(/Cap \d/g) || []).length;
    expect(capCount).toBe(5);
  });
});

describe("info asymmetry response parsing", () => {
  it("validates information_gained field present on each candidate", () => {
    const valid = JSON.stringify([
      {
        name: "Pipeline Visibility",
        description: "See deal risk",
        role: "Sales Manager",
        information_gained: "Real-time risk signals",
        confidence: "high",
        source_urls: ["https://x.io/features"],
      },
    ]);

    const result = parseLensResponse(valid, "info_asymmetry", "information_gained");
    expect(result).toHaveLength(1);
    expect(result[0].information_gained).toBe("Real-time risk signals");
  });

  it("throws when information_gained is missing", () => {
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
      parseLensResponse(missing, "info_asymmetry", "information_gained"),
    ).toThrow("information_gained");
  });
});
