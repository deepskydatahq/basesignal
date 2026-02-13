import { describe, it, expect } from "vitest";
import {
  parseCapabilityMappingResponse,
  CAPABILITY_MAPPING_SYSTEM_PROMPT,
} from "./extractCapabilityMapping";

function makeValidCandidate(overrides: Record<string, unknown> = {}) {
  return {
    name: "Orchestrate cross-team dependencies",
    description:
      "Teams can coordinate work across projects without scheduling sync meetings",
    role: "Engineering Manager",
    confidence: "high",
    source_urls: ["https://linear.app/features"],
    enabling_features: ["Cross-project dependencies", "Timeline view"],
    ...overrides,
  };
}

function makeValidResponse(
  candidates?: Record<string, unknown>[],
  count?: number
): string {
  if (candidates) return JSON.stringify(candidates);
  const n = count ?? 2;
  return JSON.stringify(
    Array.from({ length: n }, (_, i) =>
      makeValidCandidate({ name: `Capability ${i + 1}` })
    )
  );
}

describe("CAPABILITY_MAPPING_SYSTEM_PROMPT", () => {
  it("asks the core question about specific user actions", () => {
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain(
      "What specific actions can a user take in this product that they could not do before"
    );
  });

  it("specifies enabling_features field", () => {
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("enabling_features");
  });

  it("includes anti-patterns", () => {
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("Anti-patterns");
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("create tasks");
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("better organization");
  });

  it("requests 8-20 candidates", () => {
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("8-20");
  });

  it("includes banned marketing words list", () => {
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("automate");
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("streamline");
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("optimize");
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("leverage");
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("enhance");
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("empower");
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("BANNED WORDS");
  });

  it("includes GOOD vs BAD example pairs", () => {
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("GOOD");
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain("BAD");
    const goodCount = (CAPABILITY_MAPPING_SYSTEM_PROMPT.match(/GOOD:/g) || []).length;
    const badCount = (CAPABILITY_MAPPING_SYSTEM_PROMPT.match(/BAD:/g) || []).length;
    expect(goodCount).toBeGreaterThanOrEqual(2);
    expect(badCount).toBeGreaterThanOrEqual(2);
  });

  it("requires specific screen, UI element, or user action", () => {
    expect(CAPABILITY_MAPPING_SYSTEM_PROMPT).toContain(
      "Every candidate must reference a specific screen, UI element, or user action"
    );
  });
});

describe("parseCapabilityMappingResponse", () => {
  it("parses valid response with enabling_features populated", () => {
    const candidates = parseCapabilityMappingResponse(makeValidResponse());
    expect(candidates).toHaveLength(2);
    expect(candidates[0].lens).toBe("capability_mapping");
    expect(candidates[0].enabling_features).toEqual([
      "Cross-project dependencies",
      "Timeline view",
    ]);
    expect(candidates[0].id).toBeTruthy();
  });

  it("validates shared fields: name, description, role, source_urls", () => {
    const candidates = parseCapabilityMappingResponse(
      makeValidResponse([makeValidCandidate()])
    );
    const c = candidates[0];
    expect(c.name).toBe("Orchestrate cross-team dependencies");
    expect(c.description).toContain("coordinate work");
    expect(c.role).toBe("Engineering Manager");
    expect(c.source_urls).toEqual(["https://linear.app/features"]);
  });

  it("throws on missing name", () => {
    expect(() =>
      parseCapabilityMappingResponse(
        JSON.stringify([makeValidCandidate({ name: "" })])
      )
    ).toThrow("missing required field: name");
  });

  it("throws on missing description", () => {
    expect(() =>
      parseCapabilityMappingResponse(
        JSON.stringify([makeValidCandidate({ description: "" })])
      )
    ).toThrow("missing required field: description");
  });

  it("throws on missing role", () => {
    expect(() =>
      parseCapabilityMappingResponse(
        JSON.stringify([makeValidCandidate({ role: "" })])
      )
    ).toThrow("missing required field: role");
  });

  it("throws on missing source_urls", () => {
    expect(() =>
      parseCapabilityMappingResponse(
        JSON.stringify([makeValidCandidate({ source_urls: "not-array" })])
      )
    ).toThrow("missing required field: source_urls");
  });

  it("throws on missing enabling_features", () => {
    expect(() =>
      parseCapabilityMappingResponse(
        JSON.stringify([makeValidCandidate({ enabling_features: undefined })])
      )
    ).toThrow("enabling_features");
  });

  it("throws on empty enabling_features", () => {
    expect(() =>
      parseCapabilityMappingResponse(
        JSON.stringify([makeValidCandidate({ enabling_features: [] })])
      )
    ).toThrow("enabling_features");
  });

  it("throws on non-array response", () => {
    expect(() =>
      parseCapabilityMappingResponse(JSON.stringify({ candidates: [] }))
    ).toThrow("Expected array");
  });

  it("handles code-fenced JSON", () => {
    const wrapped = "```json\n" + makeValidResponse() + "\n```";
    const candidates = parseCapabilityMappingResponse(wrapped);
    expect(candidates).toHaveLength(2);
  });

  it("normalizes confidence to valid values", () => {
    const candidates = parseCapabilityMappingResponse(
      JSON.stringify([makeValidCandidate({ confidence: "invalid" })])
    );
    expect(candidates[0].confidence).toBe("medium");
  });

  it("preserves valid confidence values", () => {
    const high = parseCapabilityMappingResponse(
      JSON.stringify([makeValidCandidate({ confidence: "high" })])
    );
    expect(high[0].confidence).toBe("high");

    const low = parseCapabilityMappingResponse(
      JSON.stringify([makeValidCandidate({ confidence: "low" })])
    );
    expect(low[0].confidence).toBe("low");
  });

  it("assigns unique ids to each candidate", () => {
    const candidates = parseCapabilityMappingResponse(makeValidResponse(undefined, 5));
    const ids = candidates.map((c) => c.id);
    expect(new Set(ids).size).toBe(5);
  });
});
