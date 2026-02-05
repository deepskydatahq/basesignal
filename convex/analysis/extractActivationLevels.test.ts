import { describe, it, expect } from "vitest";
import {
  filterActivationPages,
  truncateContent,
  buildPageContext,
  parseActivationLevelsResponse,
  ACTIVATION_SYSTEM_PROMPT,
  type ActivationCriterion,
  type ActivationLevel,
  type ActivationLevelsResult,
  type SignalStrength,
} from "./extractActivationLevels";

// ============================================================================
// Type Tests
// ============================================================================

describe("Type definitions", () => {
  it("ActivationCriterion has required fields", () => {
    const criterion: ActivationCriterion = {
      action: "create_board",
      count: 1,
    };
    expect(criterion.action).toBe("create_board");
    expect(criterion.count).toBe(1);
    expect(criterion.timeWindow).toBeUndefined();
  });

  it("ActivationCriterion accepts optional timeWindow", () => {
    const criterion: ActivationCriterion = {
      action: "invite_member",
      count: 2,
      timeWindow: "first_7d",
    };
    expect(criterion.timeWindow).toBe("first_7d");
  });

  it("SignalStrength is typed as union", () => {
    const strengths: SignalStrength[] = [
      "weak",
      "medium",
      "strong",
      "very_strong",
    ];
    expect(strengths).toHaveLength(4);
  });

  it("ActivationLevel has all required fields", () => {
    const level: ActivationLevel = {
      level: 1,
      name: "explorer",
      signalStrength: "weak",
      criteria: [{ action: "create_board", count: 1 }],
      reasoning: "Initial exploration",
      confidence: 0.8,
      evidence: [{ url: "https://example.com", excerpt: "Get started" }],
    };
    expect(level.level).toBe(1);
    expect(level.name).toBe("explorer");
    expect(level.signalStrength).toBe("weak");
    expect(level.criteria).toHaveLength(1);
    expect(level.confidence).toBe(0.8);
  });

  it("ActivationLevelsResult has levels, primaryActivation, and overallConfidence", () => {
    const result: ActivationLevelsResult = {
      levels: [],
      primaryActivation: 2,
      overallConfidence: 0.75,
    };
    expect(Array.isArray(result.levels)).toBe(true);
    expect(typeof result.primaryActivation).toBe("number");
    expect(typeof result.overallConfidence).toBe("number");
  });
});

// ============================================================================
// System Prompt Tests
// ============================================================================

describe("ACTIVATION_SYSTEM_PROMPT", () => {
  it("is defined with extraction instructions", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toBeDefined();
    expect(typeof ACTIVATION_SYSTEM_PROMPT).toBe("string");
    expect(ACTIVATION_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("requests JSON output matching ActivationLevelsResult structure", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("levels");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("primaryActivation");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("overallConfidence");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("JSON");
  });

  it("includes examples for PLG product activation spectrum", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("Collaboration tools");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("Productivity tools");
  });

  it("includes guidance on identifying primary activation based on value prop", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("primaryActivation");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("aha moment");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("core value proposition");
  });

  it("instructs to look for behavioral language", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("create");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("share");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("invite");
  });

  it("explains signalStrength mapping", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("weak");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("medium");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("strong");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("very_strong");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("Individual exploration");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("Team/habit adoption");
  });
});

// ============================================================================
// Page Filtering Tests
// ============================================================================

describe("filterActivationPages", () => {
  it("accepts array of crawled pages", () => {
    const pages = [
      {
        pageType: "homepage",
        content: "Home",
        url: "https://x.io",
        title: "Home",
      },
    ];
    const result = filterActivationPages(pages);
    expect(Array.isArray(result)).toBe(true);
  });

  it("includes pages of type: onboarding, help, features, customers", () => {
    const pages = [
      {
        pageType: "onboarding",
        content: "Start",
        url: "https://x.io/start",
        title: "Start",
      },
      {
        pageType: "help",
        content: "Help",
        url: "https://x.io/help",
        title: "Help",
      },
      {
        pageType: "features",
        content: "Features",
        url: "https://x.io/features",
        title: "Features",
      },
      {
        pageType: "customers",
        content: "Customers",
        url: "https://x.io/customers",
        title: "Customers",
      },
      {
        pageType: "pricing",
        content: "Pricing",
        url: "https://x.io/pricing",
        title: "Pricing",
      },
    ];

    const result = filterActivationPages(pages);
    const types = result.map((p) => p.pageType);
    expect(types).toContain("onboarding");
    expect(types).toContain("help");
    expect(types).toContain("features");
    expect(types).toContain("customers");
    expect(types).not.toContain("pricing");
  });

  it("includes homepage as fallback for value prop context", () => {
    const pages = [
      {
        pageType: "homepage",
        content: "Home",
        url: "https://x.io",
        title: "Home",
      },
      {
        pageType: "pricing",
        content: "Pricing",
        url: "https://x.io/pricing",
        title: "Pricing",
      },
    ];

    const result = filterActivationPages(pages);
    expect(result).toHaveLength(1);
    expect(result[0].pageType).toBe("homepage");
  });

  it("prioritizes pages: onboarding > help > customers > features > homepage", () => {
    const pages = [
      {
        pageType: "homepage",
        content: "Home",
        url: "https://x.io",
        title: "Home",
      },
      {
        pageType: "features",
        content: "Features",
        url: "https://x.io/features",
        title: "Features",
      },
      {
        pageType: "customers",
        content: "Customers",
        url: "https://x.io/customers",
        title: "Customers",
      },
      {
        pageType: "help",
        content: "Help",
        url: "https://x.io/help",
        title: "Help",
      },
      {
        pageType: "onboarding",
        content: "Start",
        url: "https://x.io/start",
        title: "Start",
      },
    ];

    const result = filterActivationPages(pages);
    const types = result.map((p) => p.pageType);
    expect(types).toEqual([
      "onboarding",
      "help",
      "customers",
      "features",
      "homepage",
    ]);
  });

  it("returns empty array when no matching pages", () => {
    const pages = [
      {
        pageType: "pricing",
        content: "Pricing",
        url: "https://x.io/pricing",
        title: "Pricing",
      },
      {
        pageType: "legal",
        content: "Legal",
        url: "https://x.io/legal",
        title: "Legal",
      },
    ];

    expect(filterActivationPages(pages)).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(filterActivationPages([])).toHaveLength(0);
  });
});

// ============================================================================
// Content Truncation Tests
// ============================================================================

describe("truncateContent", () => {
  it("returns content unchanged if under limit", () => {
    expect(truncateContent("short text", 100)).toBe("short text");
  });

  it("truncates at last newline before limit", () => {
    const content = "line 1\nline 2\nline 3\nline 4";
    const result = truncateContent(content, 15);
    expect(result).toBe("line 1\nline 2\n\n[Content truncated]");
  });

  it("truncates at exact limit if no newline found", () => {
    const content = "abcdefghijklmnopqrstuvwxyz";
    const result = truncateContent(content, 10);
    expect(result).toBe("abcdefghij\n\n[Content truncated]");
  });

  it("handles exact length match", () => {
    const content = "exactly10!";
    expect(truncateContent(content, 10)).toBe("exactly10!");
  });
});

// ============================================================================
// Page Context Building Tests
// ============================================================================

describe("buildPageContext", () => {
  it("formats pages with headers and content", () => {
    const pages = [
      {
        pageType: "onboarding",
        content: "Get started with Acme",
        url: "https://acme.io/start",
        title: "Getting Started",
      },
    ];

    const result = buildPageContext(pages);
    expect(result).toContain("--- PAGE: Getting Started (onboarding) ---");
    expect(result).toContain("URL: https://acme.io/start");
    expect(result).toContain("Get started with Acme");
  });

  it("falls back to URL when title is missing", () => {
    const pages = [
      { pageType: "help", content: "Help content", url: "https://acme.io/help" },
    ];

    const result = buildPageContext(pages);
    expect(result).toContain("--- PAGE: https://acme.io/help (help) ---");
  });

  it("joins multiple pages with spacing", () => {
    const pages = [
      {
        pageType: "onboarding",
        content: "Start here",
        url: "https://acme.io/start",
        title: "Start",
      },
      {
        pageType: "help",
        content: "Help docs",
        url: "https://acme.io/help",
        title: "Help",
      },
    ];

    const result = buildPageContext(pages);
    expect(result).toContain("--- PAGE: Start (onboarding) ---");
    expect(result).toContain("--- PAGE: Help (help) ---");
  });

  it("truncates content appropriately for context window limits", () => {
    const longContent = "x".repeat(30_000);
    const pages = [
      {
        pageType: "homepage",
        content: longContent,
        url: "https://acme.io",
        title: "Home",
      },
      {
        pageType: "features",
        content: longContent,
        url: "https://acme.io/features",
        title: "Features",
      },
    ];

    const result = buildPageContext(pages);
    // Total should be capped around MAX_TOTAL_CONTENT (40000)
    expect(result.length).toBeLessThan(50_000);
  });
});

// ============================================================================
// Response Parsing Tests
// ============================================================================

describe("parseActivationLevelsResponse", () => {
  const validResponse = JSON.stringify({
    levels: [
      {
        level: 1,
        name: "explorer",
        signalStrength: "weak",
        criteria: [{ action: "create_board", count: 1 }],
        reasoning: "Initial exploration",
        confidence: 0.7,
        evidence: [
          { url: "https://example.com", excerpt: "Create your first board" },
        ],
      },
      {
        level: 2,
        name: "creator",
        signalStrength: "medium",
        criteria: [
          { action: "add_item", count: 5 },
          { action: "use_template", count: 1 },
        ],
        reasoning: "Learning the product",
        confidence: 0.75,
        evidence: [],
      },
      {
        level: 3,
        name: "collaborator",
        signalStrength: "strong",
        criteria: [{ action: "share_board", count: 1, timeWindow: "first_7d" }],
        reasoning: "Realized core value through collaboration",
        confidence: 0.8,
        evidence: [
          { url: "https://example.com/share", excerpt: "Share with your team" },
        ],
      },
    ],
    primaryActivation: 3,
    overallConfidence: 0.75,
  });

  it("extracts JSON from code fences", () => {
    const wrapped = "```json\n" + validResponse + "\n```";
    const result = parseActivationLevelsResponse(wrapped);
    expect(result.levels).toHaveLength(3);
  });

  it("parses raw JSON response", () => {
    const result = parseActivationLevelsResponse(validResponse);
    expect(result.levels).toHaveLength(3);
    expect(result.primaryActivation).toBe(3);
    expect(result.overallConfidence).toBe(0.75);
  });

  it("validates required fields: levels, primaryActivation, overallConfidence", () => {
    expect(() => parseActivationLevelsResponse("{}")).toThrow(
      "Missing required field: levels"
    );

    expect(() =>
      parseActivationLevelsResponse(JSON.stringify({ levels: [] }))
    ).toThrow("Missing required field: primaryActivation");

    expect(() =>
      parseActivationLevelsResponse(
        JSON.stringify({ levels: [], primaryActivation: 1 })
      )
    ).toThrow("Missing required field: overallConfidence");
  });

  it("validates each level has required fields", () => {
    const missingLevel = JSON.stringify({
      levels: [{ name: "test", signalStrength: "weak" }],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(missingLevel)).toThrow(
      "missing level number"
    );

    const missingName = JSON.stringify({
      levels: [{ level: 1, signalStrength: "weak" }],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(missingName)).toThrow(
      "missing name"
    );
  });

  it("throws descriptive error for missing required fields", () => {
    try {
      parseActivationLevelsResponse(JSON.stringify({ levels: "not an array" }));
    } catch (e) {
      expect((e as Error).message).toContain("levels");
      expect((e as Error).message).toContain("must be array");
    }
  });

  it("clamps confidence values to [0, 1] range", () => {
    const highConfidence = JSON.stringify({
      levels: [
        {
          level: 1,
          name: "test",
          signalStrength: "weak",
          criteria: [],
          reasoning: "test",
          confidence: 1.5,
          evidence: [],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 2.0,
    });
    const result = parseActivationLevelsResponse(highConfidence);
    expect(result.overallConfidence).toBe(1.0);
    expect(result.levels[0].confidence).toBe(1.0);

    const lowConfidence = JSON.stringify({
      levels: [
        {
          level: 1,
          name: "test",
          signalStrength: "weak",
          criteria: [],
          reasoning: "test",
          confidence: -0.5,
          evidence: [],
        },
      ],
      primaryActivation: 1,
      overallConfidence: -1.0,
    });
    const result2 = parseActivationLevelsResponse(lowConfidence);
    expect(result2.overallConfidence).toBe(0);
    expect(result2.levels[0].confidence).toBe(0);
  });

  it("validates signalStrength is one of valid values", () => {
    const invalidStrength = JSON.stringify({
      levels: [
        {
          level: 1,
          name: "test",
          signalStrength: "invalid",
          criteria: [],
          reasoning: "test",
          confidence: 0.5,
          evidence: [],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(invalidStrength)).toThrow(
      'invalid signalStrength "invalid"'
    );
  });

  it("ensures levels are sorted by level number ascending", () => {
    const unordered = JSON.stringify({
      levels: [
        {
          level: 3,
          name: "third",
          signalStrength: "strong",
          criteria: [],
          reasoning: "test",
          confidence: 0.5,
          evidence: [],
        },
        {
          level: 1,
          name: "first",
          signalStrength: "weak",
          criteria: [],
          reasoning: "test",
          confidence: 0.5,
          evidence: [],
        },
        {
          level: 2,
          name: "second",
          signalStrength: "medium",
          criteria: [],
          reasoning: "test",
          confidence: 0.5,
          evidence: [],
        },
      ],
      primaryActivation: 2,
      overallConfidence: 0.5,
    });
    const result = parseActivationLevelsResponse(unordered);
    expect(result.levels.map((l) => l.level)).toEqual([1, 2, 3]);
    expect(result.levels.map((l) => l.name)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("validates primaryActivation references an existing level number", () => {
    const invalidPrimary = JSON.stringify({
      levels: [
        {
          level: 1,
          name: "test",
          signalStrength: "weak",
          criteria: [],
          reasoning: "test",
          confidence: 0.5,
          evidence: [],
        },
      ],
      primaryActivation: 5,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(invalidPrimary)).toThrow(
      "primaryActivation 5 does not match any level"
    );
  });

  it("strips evidence to only url and excerpt", () => {
    const extraEvidence = JSON.stringify({
      levels: [
        {
          level: 1,
          name: "test",
          signalStrength: "weak",
          criteria: [],
          reasoning: "test",
          confidence: 0.5,
          evidence: [
            {
              url: "https://example.com",
              excerpt: "Quote",
              extra: "should be stripped",
            },
          ],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    const result = parseActivationLevelsResponse(extraEvidence);
    expect(result.levels[0].evidence[0]).toEqual({
      url: "https://example.com",
      excerpt: "Quote",
    });
    expect("extra" in result.levels[0].evidence[0]).toBe(false);
  });

  it("handles criteria with optional timeWindow", () => {
    const result = parseActivationLevelsResponse(validResponse);
    const level3 = result.levels.find((l) => l.level === 3);
    expect(level3?.criteria[0].timeWindow).toBe("first_7d");

    const level1 = result.levels.find((l) => l.level === 1);
    expect(level1?.criteria[0].timeWindow).toBeUndefined();
  });

  it("throws on invalid JSON", () => {
    expect(() => parseActivationLevelsResponse("not json at all")).toThrow();
  });
});
