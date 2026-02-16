import { describe, it, expect } from "vitest";
import { clusterCandidatesLLM } from "../../convergence/cluster.js";
import { createMockLlm } from "../fixtures/mock-llm.js";
import type { ValidatedCandidate } from "@basesignal/core";

function makeCandidate(id: string, lens: string, name: string): ValidatedCandidate {
  return {
    id,
    lens: lens as ValidatedCandidate["lens"],
    name,
    description: `Description for ${name}`,
    confidence: 0,
    validation_status: "valid",
  };
}

describe("clusterCandidatesLLM", () => {
  it("returns empty array for empty candidates", async () => {
    const mockLlm = createMockLlm();
    const result = await clusterCandidatesLLM([], mockLlm);
    expect(result).toEqual([]);
    expect(mockLlm.callCount).toBe(0);
  });

  it("calls LLM with clustering prompt", async () => {
    const mockLlm = createMockLlm();
    const candidates = [
      makeCandidate("c-1", "jtbd", "Sprint planning"),
      makeCandidate("c-2", "outcomes", "Sprint velocity tracking"),
      makeCandidate("c-3", "pains", "Status reports"),
      makeCandidate("c-4", "gains", "Dashboard creation"),
      makeCandidate("c-5", "alternatives", "Team collaboration"),
    ];

    const result = await clusterCandidatesLLM(candidates, mockLlm);
    expect(mockLlm.callCount).toBe(1);

    // The mock returns 3 clusters
    expect(result.length).toBeGreaterThan(0);

    // Verify the LLM was called with the clustering system prompt
    const systemMsg = mockLlm.calls[0].messages.find((m) => m.role === "system");
    expect(systemMsg?.content).toContain("grouping value moment candidates");
  });
});
