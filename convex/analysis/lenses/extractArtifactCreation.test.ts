import { describe, it, expect } from "vitest";
import {
  parseArtifactCreationResponse,
  ARTIFACT_CREATION_SYSTEM_PROMPT,
} from "./extractArtifactCreation";

function makeValidCandidate(overrides: Record<string, unknown> = {}) {
  return {
    name: "Project roadmap shared with stakeholders",
    description:
      "A visual project roadmap that stakeholders reference in board meetings and planning sessions",
    role: "Product Manager",
    confidence: "high",
    source_urls: ["https://linear.app/features"],
    artifact_type: "project roadmap",
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
      makeValidCandidate({ name: `Artifact ${i + 1}` })
    )
  );
}

describe("ARTIFACT_CREATION_SYSTEM_PROMPT", () => {
  it("asks the core question about artifact creation", () => {
    expect(ARTIFACT_CREATION_SYSTEM_PROMPT).toContain(
      "What tangible, shareable outputs do users create with value beyond the tool"
    );
  });

  it("specifies artifact_type field", () => {
    expect(ARTIFACT_CREATION_SYSTEM_PROMPT).toContain("artifact_type");
  });

  it("includes anti-patterns", () => {
    expect(ARTIFACT_CREATION_SYSTEM_PROMPT).toContain("Anti-patterns");
    expect(ARTIFACT_CREATION_SYSTEM_PROMPT).toContain("generates reports");
    expect(ARTIFACT_CREATION_SYSTEM_PROMPT).toContain("sets a status");
  });

  it("requests 8-20 candidates", () => {
    expect(ARTIFACT_CREATION_SYSTEM_PROMPT).toContain("8-20");
  });
});

describe("parseArtifactCreationResponse", () => {
  it("parses valid response with artifact_type populated", () => {
    const candidates = parseArtifactCreationResponse(makeValidResponse());
    expect(candidates).toHaveLength(2);
    expect(candidates[0].lens).toBe("artifact_creation");
    expect(candidates[0].artifact_type).toBe("project roadmap");
    expect(candidates[0].id).toBeTruthy();
  });

  it("validates shared fields", () => {
    const candidates = parseArtifactCreationResponse(
      makeValidResponse([makeValidCandidate()])
    );
    const c = candidates[0];
    expect(c.name).toBe("Project roadmap shared with stakeholders");
    expect(c.description).toContain("board meetings");
    expect(c.role).toBe("Product Manager");
    expect(c.source_urls).toEqual(["https://linear.app/features"]);
  });

  it("throws on missing name", () => {
    expect(() =>
      parseArtifactCreationResponse(
        JSON.stringify([makeValidCandidate({ name: "" })])
      )
    ).toThrow("missing required field: name");
  });

  it("throws on missing description", () => {
    expect(() =>
      parseArtifactCreationResponse(
        JSON.stringify([makeValidCandidate({ description: "" })])
      )
    ).toThrow("missing required field: description");
  });

  it("throws on missing role", () => {
    expect(() =>
      parseArtifactCreationResponse(
        JSON.stringify([makeValidCandidate({ role: "" })])
      )
    ).toThrow("missing required field: role");
  });

  it("throws on missing source_urls", () => {
    expect(() =>
      parseArtifactCreationResponse(
        JSON.stringify([makeValidCandidate({ source_urls: "not-array" })])
      )
    ).toThrow("missing required field: source_urls");
  });

  it("throws on missing artifact_type", () => {
    expect(() =>
      parseArtifactCreationResponse(
        JSON.stringify([makeValidCandidate({ artifact_type: undefined })])
      )
    ).toThrow("artifact_type");
  });

  it("throws on empty artifact_type", () => {
    expect(() =>
      parseArtifactCreationResponse(
        JSON.stringify([makeValidCandidate({ artifact_type: "" })])
      )
    ).toThrow("artifact_type");
  });

  it("throws on non-array response", () => {
    expect(() =>
      parseArtifactCreationResponse(JSON.stringify({ candidates: [] }))
    ).toThrow("Expected array");
  });

  it("handles code-fenced JSON", () => {
    const wrapped = "```json\n" + makeValidResponse() + "\n```";
    const candidates = parseArtifactCreationResponse(wrapped);
    expect(candidates).toHaveLength(2);
  });

  it("normalizes invalid confidence to medium", () => {
    const candidates = parseArtifactCreationResponse(
      JSON.stringify([makeValidCandidate({ confidence: "extreme" })])
    );
    expect(candidates[0].confidence).toBe("medium");
  });

  it("preserves valid confidence values", () => {
    const low = parseArtifactCreationResponse(
      JSON.stringify([makeValidCandidate({ confidence: "low" })])
    );
    expect(low[0].confidence).toBe("low");
  });
});
