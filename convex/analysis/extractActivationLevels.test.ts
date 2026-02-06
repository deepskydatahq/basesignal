import { describe, it, expect } from "vitest";
import {
  filterActivationPages,
  buildActivationPageContext,
  parseActivationLevelsResponse,
  ACTIVATION_SYSTEM_PROMPT,
} from "./extractActivationLevels";
import type {
  SignalStrength,
  ActivationCriterion,
  ActivationLevel,
  ActivationLevelsResult,
} from "./extractActivationLevels";

// --- Type tests (S001) ---

describe("ActivationLevel types", () => {
  it("ActivationCriterion has action, count, and optional timeWindow", () => {
    const criterion: ActivationCriterion = {
      action: "create_board",
      count: 1,
    };
    expect(criterion.action).toBe("create_board");
    expect(criterion.count).toBe(1);
    expect(criterion.timeWindow).toBeUndefined();

    const withWindow: ActivationCriterion = {
      action: "invite_member",
      count: 3,
      timeWindow: "first_7d",
    };
    expect(withWindow.timeWindow).toBe("first_7d");
  });

  it("SignalStrength is a union of weak, medium, strong, very_strong", () => {
    const values: SignalStrength[] = ["weak", "medium", "strong", "very_strong"];
    expect(values).toHaveLength(4);
  });

  it("ActivationLevel has all required fields", () => {
    const level: ActivationLevel = {
      level: 1,
      name: "explorer",
      signalStrength: "weak",
      criteria: [{ action: "create_board", count: 1 }],
      reasoning: "First board creation shows interest",
      confidence: 0.7,
      evidence: [{ url: "https://example.com", excerpt: "Create your first board" }],
    };
    expect(level.level).toBe(1);
    expect(level.name).toBe("explorer");
    expect(level.signalStrength).toBe("weak");
    expect(level.criteria).toHaveLength(1);
    expect(level.reasoning).toBeTruthy();
    expect(level.confidence).toBe(0.7);
    expect(level.evidence).toHaveLength(1);
  });

  it("ActivationLevelsResult has levels, primaryActivation, overallConfidence", () => {
    const result: ActivationLevelsResult = {
      levels: [
        {
          level: 1,
          name: "explorer",
          signalStrength: "weak",
          criteria: [{ action: "create_board", count: 1 }],
          reasoning: "test",
          confidence: 0.7,
          evidence: [],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.6,
    };
    expect(result.levels).toHaveLength(1);
    expect(result.primaryActivation).toBe(1);
    expect(result.overallConfidence).toBe(0.6);
  });
});

// --- Prompt tests (S002) ---

describe("ACTIVATION_SYSTEM_PROMPT", () => {
  it("is defined with extraction instructions", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toBeTruthy();
    expect(typeof ACTIVATION_SYSTEM_PROMPT).toBe("string");
    expect(ACTIVATION_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("requests JSON output matching ActivationLevelsResult structure", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("levels");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("primaryActivation");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("overallConfidence");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("signalStrength");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("criteria");
  });

  it("includes PLG product activation spectrum examples", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("Miro");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("collaboration");
  });

  it("includes guidance on identifying primary activation", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("primaryActivation");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("aha moment");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("core value");
  });

  it("instructs to look for behavioral language", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("create");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("invite");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("share");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("collaborate");
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

// --- filterActivationPages tests (S003) ---

describe("filterActivationPages", () => {
  it("accepts array of crawled pages", () => {
    const result = filterActivationPages([]);
    expect(result).toEqual([]);
  });

  it("includes pages of type: onboarding, help, features, customers, homepage", () => {
    const pages = [
      { pageType: "onboarding", content: "Get started", url: "https://x.io/onboarding" },
      { pageType: "help", content: "Help docs", url: "https://x.io/help" },
      { pageType: "features", content: "Features", url: "https://x.io/features" },
      { pageType: "customers", content: "Case studies", url: "https://x.io/customers" },
      { pageType: "homepage", content: "Home", url: "https://x.io" },
    ];

    const result = filterActivationPages(pages);
    expect(result).toHaveLength(5);
  });

  it("includes homepage as fallback for value prop context", () => {
    const pages = [
      { pageType: "homepage", content: "Home", url: "https://x.io" },
      { pageType: "pricing", content: "Pricing", url: "https://x.io/pricing" },
    ];

    const result = filterActivationPages(pages);
    expect(result).toHaveLength(1);
    expect(result[0].pageType).toBe("homepage");
  });

  it("pages are prioritized: onboarding > help > customers > features > homepage", () => {
    const pages = [
      { pageType: "homepage", content: "Home", url: "https://x.io" },
      { pageType: "features", content: "Features", url: "https://x.io/features" },
      { pageType: "customers", content: "Cases", url: "https://x.io/customers" },
      { pageType: "help", content: "Help", url: "https://x.io/help" },
      { pageType: "onboarding", content: "Start", url: "https://x.io/onboarding" },
    ];

    const result = filterActivationPages(pages);
    expect(result.map((p) => p.pageType)).toEqual([
      "onboarding",
      "help",
      "customers",
      "features",
      "homepage",
    ]);
  });

  it("excludes non-activation page types", () => {
    const pages = [
      { pageType: "pricing", content: "Pricing", url: "https://x.io/pricing" },
      { pageType: "about", content: "About", url: "https://x.io/about" },
      { pageType: "legal", content: "Legal", url: "https://x.io/legal" },
    ];

    expect(filterActivationPages(pages)).toHaveLength(0);
  });

  it("returns empty array when no matching pages", () => {
    const pages = [
      { pageType: "pricing", content: "Pricing", url: "https://x.io/pricing" },
    ];
    expect(filterActivationPages(pages)).toHaveLength(0);
  });
});

// --- buildActivationPageContext tests ---

describe("buildActivationPageContext", () => {
  it("formats pages with headers and content", () => {
    const pages = [
      { pageType: "features", content: "Board creation and sharing", url: "https://x.io/features", title: "Features" },
    ];

    const result = buildActivationPageContext(pages);
    expect(result).toContain("--- PAGE: Features (features) ---");
    expect(result).toContain("URL: https://x.io/features");
    expect(result).toContain("Board creation and sharing");
  });

  it("falls back to URL when title is missing", () => {
    const pages = [
      { pageType: "homepage", content: "Home", url: "https://x.io" },
    ];

    const result = buildActivationPageContext(pages);
    expect(result).toContain("--- PAGE: https://x.io (homepage) ---");
  });

  it("joins multiple pages with spacing", () => {
    const pages = [
      { pageType: "onboarding", content: "Start here", url: "https://x.io/start", title: "Start" },
      { pageType: "features", content: "Features", url: "https://x.io/features", title: "Features" },
    ];

    const result = buildActivationPageContext(pages);
    expect(result).toContain("--- PAGE: Start (onboarding) ---");
    expect(result).toContain("--- PAGE: Features (features) ---");
  });

  it("respects total content limit", () => {
    const longContent = "x".repeat(30_000);
    const pages = [
      { pageType: "homepage", content: longContent, url: "https://x.io", title: "Home" },
      { pageType: "features", content: longContent, url: "https://x.io/features", title: "Features" },
    ];

    const result = buildActivationPageContext(pages);
    expect(result.length).toBeLessThan(50_000);
  });

  it("handles empty pages array", () => {
    expect(buildActivationPageContext([])).toBe("");
  });
});

// --- parseActivationLevelsResponse tests (S005) ---

describe("parseActivationLevelsResponse", () => {
  function makeValidResponse(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      levels: [
        {
          level: 1,
          name: "explorer",
          signalStrength: "weak",
          criteria: [{ action: "create_board", count: 1 }],
          reasoning: "First board shows interest",
          confidence: 0.7,
          evidence: [{ url: "https://x.io", excerpt: "Create your first board" }],
        },
        {
          level: 2,
          name: "creator",
          signalStrength: "medium",
          criteria: [{ action: "use_template", count: 1 }],
          reasoning: "Using templates shows learning",
          confidence: 0.6,
          evidence: [{ url: "https://x.io/templates", excerpt: "Choose a template" }],
        },
        {
          level: 3,
          name: "collaborator",
          signalStrength: "strong",
          criteria: [{ action: "share_board", count: 1 }, { action: "invite_member", count: 1 }],
          reasoning: "Sharing is the core value",
          confidence: 0.8,
          evidence: [{ url: "https://x.io/features", excerpt: "Real-time collaboration" }],
        },
      ],
      primaryActivation: 3,
      overallConfidence: 0.7,
      ...overrides,
    });
  }

  it("parses raw JSON response", () => {
    const result = parseActivationLevelsResponse(makeValidResponse());
    expect(result.levels).toHaveLength(3);
    expect(result.primaryActivation).toBe(3);
    expect(result.overallConfidence).toBe(0.7);
  });

  it("extracts JSON from code fences", () => {
    const wrapped = "```json\n" + makeValidResponse() + "\n```";
    const result = parseActivationLevelsResponse(wrapped);
    expect(result.levels).toHaveLength(3);
  });

  it("extracts JSON from code fences without language tag", () => {
    const wrapped = "```\n" + makeValidResponse() + "\n```";
    const result = parseActivationLevelsResponse(wrapped);
    expect(result.levels).toHaveLength(3);
  });

  it("validates required fields: levels, primaryActivation, overallConfidence", () => {
    expect(() => parseActivationLevelsResponse(JSON.stringify({}))).toThrow(
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
    const badLevel = JSON.stringify({
      levels: [{ name: "test" }],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(badLevel)).toThrow("Level missing required field: level");
  });

  it("validates level name is non-empty string", () => {
    const noName = JSON.stringify({
      levels: [{ level: 1, name: "", signalStrength: "weak", criteria: [{ action: "x", count: 1 }], reasoning: "r", confidence: 0.5, evidence: [] }],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(noName)).toThrow("Level missing required field: name");
  });

  it("throws descriptive error for missing required fields", () => {
    expect(() => parseActivationLevelsResponse("{}")).toThrow(/Missing required field/);
  });

  it("validates signalStrength is one of: weak, medium, strong, very_strong", () => {
    const badSignal = JSON.stringify({
      levels: [
        {
          level: 1,
          name: "test",
          signalStrength: "invalid",
          criteria: [{ action: "x", count: 1 }],
          reasoning: "test",
          confidence: 0.5,
          evidence: [],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(badSignal)).toThrow("Invalid signalStrength: invalid");
  });

  it("validates criteria is non-empty array", () => {
    const noCriteria = JSON.stringify({
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
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(noCriteria)).toThrow("criteria (must be non-empty array)");
  });

  it("validates criterion has action and count", () => {
    const badCriterion = JSON.stringify({
      levels: [
        {
          level: 1,
          name: "test",
          signalStrength: "weak",
          criteria: [{ action: "", count: 1 }],
          reasoning: "test",
          confidence: 0.5,
          evidence: [],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(badCriterion)).toThrow("missing action");
  });

  it("clamps confidence values to [0, 1] range", () => {
    const result = parseActivationLevelsResponse(
      makeValidResponse({ overallConfidence: 1.5 })
    );
    expect(result.overallConfidence).toBe(1.0);

    const result2 = parseActivationLevelsResponse(
      makeValidResponse({ overallConfidence: -0.5 })
    );
    expect(result2.overallConfidence).toBe(0);
  });

  it("clamps level confidence values", () => {
    const json = JSON.stringify({
      levels: [
        {
          level: 1,
          name: "test",
          signalStrength: "weak",
          criteria: [{ action: "x", count: 1 }],
          reasoning: "test",
          confidence: 1.5,
          evidence: [],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    const result = parseActivationLevelsResponse(json);
    expect(result.levels[0].confidence).toBe(1.0);
  });

  it("ensures levels are sorted by level number ascending", () => {
    const unsorted = JSON.stringify({
      levels: [
        {
          level: 3,
          name: "collaborator",
          signalStrength: "strong",
          criteria: [{ action: "share", count: 1 }],
          reasoning: "sharing",
          confidence: 0.8,
          evidence: [],
        },
        {
          level: 1,
          name: "explorer",
          signalStrength: "weak",
          criteria: [{ action: "create", count: 1 }],
          reasoning: "creating",
          confidence: 0.7,
          evidence: [],
        },
        {
          level: 2,
          name: "creator",
          signalStrength: "medium",
          criteria: [{ action: "template", count: 1 }],
          reasoning: "templating",
          confidence: 0.6,
          evidence: [],
        },
      ],
      primaryActivation: 3,
      overallConfidence: 0.7,
    });

    const result = parseActivationLevelsResponse(unsorted);
    expect(result.levels.map((l) => l.level)).toEqual([1, 2, 3]);
    expect(result.levels[0].name).toBe("explorer");
    expect(result.levels[1].name).toBe("creator");
    expect(result.levels[2].name).toBe("collaborator");
  });

  it("validates primaryActivation references an existing level number", () => {
    const badPrimary = JSON.stringify({
      levels: [
        {
          level: 1,
          name: "test",
          signalStrength: "weak",
          criteria: [{ action: "x", count: 1 }],
          reasoning: "test",
          confidence: 0.5,
          evidence: [],
        },
      ],
      primaryActivation: 99,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(badPrimary)).toThrow(
      "primaryActivation 99 does not match any level number"
    );
  });

  it("strips evidence to only url and excerpt", () => {
    const withExtra = JSON.stringify({
      levels: [
        {
          level: 1,
          name: "test",
          signalStrength: "weak",
          criteria: [{ action: "x", count: 1 }],
          reasoning: "test",
          confidence: 0.5,
          evidence: [{ url: "https://x.io", excerpt: "test", extra: "should be stripped" }],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    const result = parseActivationLevelsResponse(withExtra);
    expect(result.levels[0].evidence[0]).toEqual({ url: "https://x.io", excerpt: "test" });
    expect("extra" in result.levels[0].evidence[0]).toBe(false);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseActivationLevelsResponse("not json")).toThrow();
  });
});
