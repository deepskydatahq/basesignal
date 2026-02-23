import { describe, it, expect } from "vitest";
import { convergeAndTier, assignTier, parseMergeResponse, directMerge } from "../../convergence/converge.js";
import type { CandidateCluster, ExperientialLensType } from "@basesignal/core";
import { createMockLlm, createFailingMockLlm } from "../fixtures/mock-llm.js";

function makeCluster(id: string, lensCount: number): CandidateCluster {
  const lenses: ExperientialLensType[] = ["jtbd", "outcomes", "pains", "gains", "alternatives", "workflows", "emotions"].slice(0, lensCount) as ExperientialLensType[];
  return {
    cluster_id: id,
    candidates: lenses.map((lens, i) => ({
      id: `${id}-c${i}`,
      lens,
      name: `Candidate ${i}`,
      description: `Description ${i}`,
      confidence: 0,
      validation_status: "valid" as const,
    })),
    lens_count: lensCount,
    lenses,
  };
}

describe("assignTier", () => {
  it("assigns Tier 1 for 4+ lenses", () => {
    expect(assignTier(4)).toBe(1);
    expect(assignTier(7)).toBe(1);
  });

  it("assigns Tier 2 for 2-3 lenses", () => {
    expect(assignTier(2)).toBe(2);
    expect(assignTier(3)).toBe(2);
  });

  it("assigns Tier 3 for 1 lens", () => {
    expect(assignTier(1)).toBe(3);
  });
});

describe("parseMergeResponse", () => {
  it("parses valid merge JSON", () => {
    const input = JSON.stringify({
      name: "Create dashboard",
      description: "User creates a dashboard",
      roles: ["PM"],
      product_surfaces: ["Dashboard"],
      is_coherent: true,
    });
    const result = parseMergeResponse(input);
    expect(result.name).toBe("Create dashboard");
    expect(result.roles).toEqual(["PM"]);
  });

  it("handles code fences", () => {
    const json = JSON.stringify({
      name: "View analytics",
      description: "User views analytics",
      roles: ["Analyst"],
      product_surfaces: ["Analytics"],
      is_coherent: true,
    });
    const result = parseMergeResponse("```json\n" + json + "\n```");
    expect(result.name).toBe("View analytics");
  });

  it("rejects missing required fields", () => {
    expect(() => parseMergeResponse(JSON.stringify({ name: "Test" })))
      .toThrow("Missing required field");
  });
});

describe("directMerge", () => {
  it("produces a fallback ValueMoment", () => {
    const cluster = makeCluster("test", 2);
    const result = directMerge(cluster);
    // ID is now slugified from the name (e.g., "Achieve Candidate 0 / Candidate 1")
    expect(result.id).toMatch(/^moment-achieve-/);
    expect(result.tier).toBe(2);
    expect(result.lens_count).toBe(2);
    expect(result.contributing_candidates).toHaveLength(2);
  });
});

describe("convergeAndTier", () => {
  it("merges clusters using LLM", async () => {
    const mockLlm = createMockLlm();
    const clusters = [makeCluster("c0", 3), makeCluster("c1", 1)];
    const result = await convergeAndTier(clusters, mockLlm);
    expect(result).toHaveLength(2);
    // ID is now slugified from the LLM-generated name
    expect(result[0].id).toBe("moment-create-sprint-plan-from-capacity-data");
    expect(result[0].name).toBe("Create sprint plan from capacity data");
  });

  it("falls back to directMerge when LLM throws", async () => {
    const mockLlm = createFailingMockLlm("merging value moment candidates");
    const clusters = [makeCluster("c0", 2)];
    const result = await convergeAndTier(clusters, mockLlm);
    expect(result).toHaveLength(1);
    // directMerge name starts with "Achieve "
    expect(result[0].name).toContain("Achieve ");
  });
});
