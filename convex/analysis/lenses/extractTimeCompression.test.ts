import { describe, it, expect } from "vitest";
import {
  parseTimeCompressionResponse,
  TIME_COMPRESSION_SYSTEM_PROMPT,
} from "./extractTimeCompression";

function makeValidCandidate(overrides: Record<string, unknown> = {}) {
  return {
    name: "Sprint planning compressed",
    description:
      "Sprint planning drops from 2 hours to 15 minutes, enabling weekly planning cycles",
    role: "Engineering Manager",
    confidence: "high",
    source_urls: ["https://linear.app/features"],
    time_compression:
      "Sprint planning from 2 hours to 15 minutes — teams plan weekly instead of biweekly",
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
      makeValidCandidate({ name: `Time ${i + 1}` })
    )
  );
}

describe("TIME_COMPRESSION_SYSTEM_PROMPT", () => {
  it("asks the core question about time compression", () => {
    expect(TIME_COMPRESSION_SYSTEM_PROMPT).toContain(
      "What workflows become fast enough to change behavior"
    );
  });

  it("specifies time_compression field", () => {
    expect(TIME_COMPRESSION_SYSTEM_PROMPT).toContain("time_compression");
  });

  it("includes anti-patterns", () => {
    expect(TIME_COMPRESSION_SYSTEM_PROMPT).toContain("Anti-patterns");
    expect(TIME_COMPRESSION_SYSTEM_PROMPT).toContain("saves a click");
    expect(TIME_COMPRESSION_SYSTEM_PROMPT).toContain("moves faster");
  });

  it("requests 8-20 candidates", () => {
    expect(TIME_COMPRESSION_SYSTEM_PROMPT).toContain("8-20");
  });
});

describe("parseTimeCompressionResponse", () => {
  it("parses valid response with time_compression populated", () => {
    const candidates = parseTimeCompressionResponse(makeValidResponse());
    expect(candidates).toHaveLength(2);
    expect(candidates[0].lens).toBe("time_compression");
    expect(candidates[0].time_compression).toContain("Sprint planning");
    expect(candidates[0].id).toBeTruthy();
  });

  it("validates shared fields", () => {
    const candidates = parseTimeCompressionResponse(
      makeValidResponse([makeValidCandidate()])
    );
    const c = candidates[0];
    expect(c.name).toBe("Sprint planning compressed");
    expect(c.description).toContain("weekly planning");
    expect(c.role).toBe("Engineering Manager");
    expect(c.source_urls).toEqual(["https://linear.app/features"]);
  });

  it("throws on missing name", () => {
    expect(() =>
      parseTimeCompressionResponse(
        JSON.stringify([makeValidCandidate({ name: "" })])
      )
    ).toThrow("missing required field: name");
  });

  it("throws on missing description", () => {
    expect(() =>
      parseTimeCompressionResponse(
        JSON.stringify([makeValidCandidate({ description: "" })])
      )
    ).toThrow("missing required field: description");
  });

  it("throws on missing role", () => {
    expect(() =>
      parseTimeCompressionResponse(
        JSON.stringify([makeValidCandidate({ role: "" })])
      )
    ).toThrow("missing required field: role");
  });

  it("throws on missing source_urls", () => {
    expect(() =>
      parseTimeCompressionResponse(
        JSON.stringify([makeValidCandidate({ source_urls: "not-array" })])
      )
    ).toThrow("missing required field: source_urls");
  });

  it("throws on missing time_compression", () => {
    expect(() =>
      parseTimeCompressionResponse(
        JSON.stringify([makeValidCandidate({ time_compression: undefined })])
      )
    ).toThrow("time_compression");
  });

  it("throws on empty time_compression", () => {
    expect(() =>
      parseTimeCompressionResponse(
        JSON.stringify([makeValidCandidate({ time_compression: "" })])
      )
    ).toThrow("time_compression");
  });

  it("throws on non-array response", () => {
    expect(() =>
      parseTimeCompressionResponse(JSON.stringify({ candidates: [] }))
    ).toThrow("Expected array");
  });

  it("handles code-fenced JSON", () => {
    const wrapped = "```json\n" + makeValidResponse() + "\n```";
    const candidates = parseTimeCompressionResponse(wrapped);
    expect(candidates).toHaveLength(2);
  });

  it("normalizes invalid confidence to medium", () => {
    const candidates = parseTimeCompressionResponse(
      JSON.stringify([makeValidCandidate({ confidence: "very_high" })])
    );
    expect(candidates[0].confidence).toBe("medium");
  });

  it("preserves valid confidence values", () => {
    const low = parseTimeCompressionResponse(
      JSON.stringify([makeValidCandidate({ confidence: "low" })])
    );
    expect(low[0].confidence).toBe("low");
  });
});
