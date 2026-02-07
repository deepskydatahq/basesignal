import { describe, it, expect } from "vitest";
import {
  parseEffortEliminationResponse,
  EFFORT_ELIMINATION_SYSTEM_PROMPT,
} from "./extractEffortElimination";

function makeValidCandidate(overrides: Record<string, unknown> = {}) {
  return {
    name: "Manual status reporting eliminated",
    description:
      "Stakeholders see live project progress without anyone writing status reports",
    role: "Project Manager",
    confidence: "high",
    source_urls: ["https://linear.app/features"],
    effort_eliminated:
      "Writing weekly status update emails and compiling progress across teams",
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
      makeValidCandidate({ name: `Effort ${i + 1}` })
    )
  );
}

describe("EFFORT_ELIMINATION_SYSTEM_PROMPT", () => {
  it("asks the core question about effort elimination", () => {
    expect(EFFORT_ELIMINATION_SYSTEM_PROMPT).toContain(
      "What repetitive or tedious work vanishes entirely"
    );
  });

  it("specifies effort_eliminated field", () => {
    expect(EFFORT_ELIMINATION_SYSTEM_PROMPT).toContain("effort_eliminated");
  });

  it("includes anti-patterns", () => {
    expect(EFFORT_ELIMINATION_SYSTEM_PROMPT).toContain("Anti-patterns");
    expect(EFFORT_ELIMINATION_SYSTEM_PROMPT).toContain("faster task creation");
    expect(EFFORT_ELIMINATION_SYSTEM_PROMPT).toContain("reduces overhead");
  });

  it("requests 8-20 candidates", () => {
    expect(EFFORT_ELIMINATION_SYSTEM_PROMPT).toContain("8-20");
  });
});

describe("parseEffortEliminationResponse", () => {
  it("parses valid response with effort_eliminated populated", () => {
    const candidates = parseEffortEliminationResponse(makeValidResponse());
    expect(candidates).toHaveLength(2);
    expect(candidates[0].lens).toBe("effort_elimination");
    expect(candidates[0].effort_eliminated).toContain("status update");
    expect(candidates[0].id).toBeTruthy();
  });

  it("validates shared fields", () => {
    const candidates = parseEffortEliminationResponse(
      makeValidResponse([makeValidCandidate()])
    );
    const c = candidates[0];
    expect(c.name).toBe("Manual status reporting eliminated");
    expect(c.description).toContain("live project progress");
    expect(c.role).toBe("Project Manager");
    expect(c.source_urls).toEqual(["https://linear.app/features"]);
  });

  it("throws on missing name", () => {
    expect(() =>
      parseEffortEliminationResponse(
        JSON.stringify([makeValidCandidate({ name: "" })])
      )
    ).toThrow("missing required field: name");
  });

  it("throws on missing description", () => {
    expect(() =>
      parseEffortEliminationResponse(
        JSON.stringify([makeValidCandidate({ description: "" })])
      )
    ).toThrow("missing required field: description");
  });

  it("throws on missing role", () => {
    expect(() =>
      parseEffortEliminationResponse(
        JSON.stringify([makeValidCandidate({ role: "" })])
      )
    ).toThrow("missing required field: role");
  });

  it("throws on missing source_urls", () => {
    expect(() =>
      parseEffortEliminationResponse(
        JSON.stringify([makeValidCandidate({ source_urls: "not-array" })])
      )
    ).toThrow("missing required field: source_urls");
  });

  it("throws on missing effort_eliminated", () => {
    expect(() =>
      parseEffortEliminationResponse(
        JSON.stringify([makeValidCandidate({ effort_eliminated: undefined })])
      )
    ).toThrow("effort_eliminated");
  });

  it("throws on empty effort_eliminated", () => {
    expect(() =>
      parseEffortEliminationResponse(
        JSON.stringify([makeValidCandidate({ effort_eliminated: "" })])
      )
    ).toThrow("effort_eliminated");
  });

  it("throws on non-array response", () => {
    expect(() =>
      parseEffortEliminationResponse(JSON.stringify({ candidates: [] }))
    ).toThrow("Expected array");
  });

  it("handles code-fenced JSON", () => {
    const wrapped = "```json\n" + makeValidResponse() + "\n```";
    const candidates = parseEffortEliminationResponse(wrapped);
    expect(candidates).toHaveLength(2);
  });

  it("normalizes invalid confidence to medium", () => {
    const candidates = parseEffortEliminationResponse(
      JSON.stringify([makeValidCandidate({ confidence: "invalid" })])
    );
    expect(candidates[0].confidence).toBe("medium");
  });

  it("preserves valid confidence values", () => {
    const high = parseEffortEliminationResponse(
      JSON.stringify([makeValidCandidate({ confidence: "high" })])
    );
    expect(high[0].confidence).toBe("high");

    const low = parseEffortEliminationResponse(
      JSON.stringify([makeValidCandidate({ confidence: "low" })])
    );
    expect(low[0].confidence).toBe("low");
  });
});
