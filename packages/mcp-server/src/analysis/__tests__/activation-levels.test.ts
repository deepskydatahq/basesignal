import { describe, it, expect } from "vitest";
import { parseActivationLevelsResponse, filterActivationPages } from "../activation-levels.js";
import type { CrawledPage } from "../types.js";

describe("parseActivationLevelsResponse", () => {
  it("parses valid activation levels JSON", () => {
    const input = JSON.stringify({
      levels: [
        {
          level: 1,
          name: "explorer",
          signalStrength: "weak",
          criteria: [{ action: "create_board", count: 1 }],
          reasoning: "Initial interest",
          confidence: 0.7,
          evidence: [{ url: "https://example.com", excerpt: "Create your first board" }],
        },
        {
          level: 2,
          name: "builder",
          signalStrength: "medium",
          criteria: [{ action: "invite_member", count: 2 }],
          reasoning: "Team adoption",
          confidence: 0.6,
          evidence: [],
        },
      ],
      primaryActivation: 2,
      overallConfidence: 0.65,
    });
    const result = parseActivationLevelsResponse(input);
    expect(result.levels).toHaveLength(2);
    expect(result.primaryActivation).toBe(2);
    expect(result.overallConfidence).toBe(0.65);
  });

  it("sorts levels by number ascending", () => {
    const input = JSON.stringify({
      levels: [
        { level: 2, name: "b", signalStrength: "medium", criteria: [{ action: "a", count: 1 }], reasoning: "r", confidence: 0.5, evidence: [] },
        { level: 1, name: "a", signalStrength: "weak", criteria: [{ action: "b", count: 1 }], reasoning: "r", confidence: 0.5, evidence: [] },
      ],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    const result = parseActivationLevelsResponse(input);
    expect(result.levels[0].level).toBe(1);
    expect(result.levels[1].level).toBe(2);
  });

  it("clamps confidence values", () => {
    const input = JSON.stringify({
      levels: [
        { level: 1, name: "a", signalStrength: "weak", criteria: [{ action: "a", count: 1 }], reasoning: "r", confidence: 1.5, evidence: [] },
      ],
      primaryActivation: 1,
      overallConfidence: -0.5,
    });
    const result = parseActivationLevelsResponse(input);
    expect(result.levels[0].confidence).toBe(1);
    expect(result.overallConfidence).toBe(0);
  });

  it("rejects missing levels field", () => {
    expect(() => parseActivationLevelsResponse(JSON.stringify({ primaryActivation: 1, overallConfidence: 0.5 })))
      .toThrow("Missing required field: levels");
  });

  it("rejects invalid signalStrength", () => {
    const input = JSON.stringify({
      levels: [
        { level: 1, name: "a", signalStrength: "invalid", criteria: [{ action: "a", count: 1 }], reasoning: "r", confidence: 0.5, evidence: [] },
      ],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(input)).toThrow("Invalid signalStrength");
  });

  it("rejects primaryActivation not matching any level", () => {
    const input = JSON.stringify({
      levels: [
        { level: 1, name: "a", signalStrength: "weak", criteria: [{ action: "a", count: 1 }], reasoning: "r", confidence: 0.5, evidence: [] },
      ],
      primaryActivation: 5,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(input)).toThrow("does not match any level");
  });
});

describe("filterActivationPages", () => {
  it("filters and sorts activation-relevant pages by priority", () => {
    const pages: CrawledPage[] = [
      { url: "a", pageType: "homepage", content: "a" },
      { url: "b", pageType: "onboarding", content: "b" },
      { url: "c", pageType: "blog", content: "c" },
      { url: "d", pageType: "help", content: "d" },
    ];
    const result = filterActivationPages(pages);
    expect(result).toHaveLength(3);
    expect(result[0].pageType).toBe("onboarding");
    expect(result[1].pageType).toBe("help");
    expect(result[2].pageType).toBe("homepage");
  });
});
