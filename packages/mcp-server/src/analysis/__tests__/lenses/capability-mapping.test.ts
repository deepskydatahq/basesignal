import { describe, it, expect } from "vitest";
import { parseCapabilityMappingResponse } from "../../lenses/capability-mapping.js";

describe("parseCapabilityMappingResponse", () => {
  it("parses valid JSON array of candidates", () => {
    const input = JSON.stringify([
      {
        name: "Test Capability",
        description: "User opens board and sees dependencies",
        role: "Engineering Manager",
        confidence: "high",
        source_urls: ["https://example.com"],
        enabling_features: ["Dependency Graph", "Board View"],
      },
    ]);
    const result = parseCapabilityMappingResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].lens).toBe("capability_mapping");
    expect(result[0].enabling_features).toEqual(["Dependency Graph", "Board View"]);
  });

  it("handles code fences", () => {
    const json = JSON.stringify([
      {
        name: "Test",
        description: "Desc",
        role: "User",
        confidence: "medium",
        source_urls: ["url"],
        enabling_features: ["Feature"],
      },
    ]);
    const input = "```json\n" + json + "\n```";
    const result = parseCapabilityMappingResponse(input);
    expect(result).toHaveLength(1);
  });

  it("rejects candidates with empty enabling_features", () => {
    const input = JSON.stringify([
      {
        name: "Test",
        description: "Desc",
        role: "User",
        source_urls: ["url"],
        enabling_features: [],
      },
    ]);
    expect(() => parseCapabilityMappingResponse(input)).toThrow("enabling_features");
  });

  it("normalizes confidence values", () => {
    const input = JSON.stringify([
      {
        name: "Test",
        description: "Desc",
        role: "User",
        source_urls: ["url"],
        enabling_features: ["F"],
        confidence: "invalid",
      },
    ]);
    const result = parseCapabilityMappingResponse(input);
    expect(result[0].confidence).toBe("medium");
  });

  it("rejects non-array response", () => {
    expect(() => parseCapabilityMappingResponse('{"not":"array"}'))
      .toThrow("Expected array");
  });
});
