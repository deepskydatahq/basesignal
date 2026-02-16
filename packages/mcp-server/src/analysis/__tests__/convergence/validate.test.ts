import { describe, it, expect } from "vitest";
import { parseLlmResponse, applyLlmReview } from "../../convergence/validate.js";
import { createMockLlm, createFailingMockLlm } from "../fixtures/mock-llm.js";
import type { ValidatedCandidate } from "@basesignal/core";

describe("parseLlmResponse", () => {
  it("parses valid JSON array", () => {
    const input = JSON.stringify([
      {
        id: "c-1",
        action: "confirm_flag",
        rewritten_name: "New Name",
        rewritten_description: "New Description",
        validation_issue: "Was feature-as-value",
      },
    ]);
    const result = parseLlmResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("confirm_flag");
    expect(result[0].rewritten_name).toBe("New Name");
  });

  it("handles code fences", () => {
    const json = JSON.stringify([
      { id: "c-1", action: "override_valid", validation_issue: "Actually valid" },
    ]);
    const result = parseLlmResponse("```json\n" + json + "\n```");
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("override_valid");
  });

  it("rejects non-array response", () => {
    expect(() => parseLlmResponse('{"not":"array"}')).toThrow("Expected JSON array");
  });

  it("rejects invalid JSON", () => {
    expect(() => parseLlmResponse("not json")).toThrow();
  });
});

describe("applyLlmReview", () => {
  function makeCandidate(id: string, name: string): ValidatedCandidate {
    return {
      id,
      lens: "jtbd",
      name,
      description: `Description for ${name}`,
      confidence: 0,
      validation_status: "flagged",
      validation_flags: ["feature_as_value"],
    };
  }

  it("applies confirm_flag rewrites", async () => {
    const mockLlm = createMockLlm();
    const results: ValidatedCandidate[] = [makeCandidate("test-1", "Use the dashboard")];
    const flagged = [
      {
        id: "test-1",
        name: "Use the dashboard",
        description: "Use the dashboard feature",
        lens: "jtbd",
        flags: ["feature_as_value"],
      },
    ];

    const updated = await applyLlmReview(results, flagged, new Set(), mockLlm);
    expect(updated[0].validation_status).toBe("rewritten");
    expect(updated[0].name).toBe("Achieve automated status tracking");
    expect(updated[0].rewritten_from?.name).toBe("Use the dashboard");
  });

  it("returns results unchanged if no flagged candidates", async () => {
    const mockLlm = createMockLlm();
    const results: ValidatedCandidate[] = [makeCandidate("c-1", "Test")];
    const updated = await applyLlmReview(results, [], new Set(), mockLlm);
    expect(updated[0].validation_status).toBe("flagged"); // unchanged
    expect(mockLlm.callCount).toBe(0); // no LLM call made
  });

  it("gracefully degrades when LLM fails", async () => {
    const mockLlm = createFailingMockLlm("Review flagged");
    const results: ValidatedCandidate[] = [makeCandidate("c-1", "Test")];
    const flagged = [
      { id: "c-1", name: "Test", description: "Desc", lens: "jtbd", flags: ["vague"] },
    ];

    const updated = await applyLlmReview(results, flagged, new Set(), mockLlm);
    // Should keep original status (graceful degradation)
    expect(updated[0].validation_status).toBe("flagged");
  });
});
