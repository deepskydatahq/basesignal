import { describe, it, expect, vi } from "vitest";
import {
  assignTier,
  parseMergeResponse,
  directMerge,
  convergeAndTier,
  buildMergePrompt,
} from "./convergeAndTier";
import type { CandidateCluster, ValidatedCandidate, LensType } from "./types";

// --- Test helpers ---

function makeCandidate(
  overrides: Partial<ValidatedCandidate> & {
    id: string;
    lens: LensType;
    name: string;
    description: string;
  }
): ValidatedCandidate {
  return {
    confidence: 0.8,
    validation_status: "valid",
    ...overrides,
  };
}

function makeCluster(overrides: Partial<CandidateCluster> & { cluster_id: string }): CandidateCluster {
  const candidates = overrides.candidates ?? [
    makeCandidate({
      id: "c1",
      lens: "jtbd",
      name: "Track progress",
      description: "Users track project progress across teams",
    }),
    makeCandidate({
      id: "c2",
      lens: "outcomes",
      name: "Monitor velocity",
      description: "Teams monitor development velocity in real-time",
    }),
  ];
  return {
    candidates,
    lens_count: overrides.lens_count ?? new Set(candidates.map((c) => c.lens)).size,
    lenses: overrides.lenses ?? [...new Set(candidates.map((c) => c.lens))],
    ...overrides,
  };
}

function makeMockAnthropicResponse(jsonContent: Record<string, unknown>): unknown {
  return {
    content: [
      {
        type: "text",
        text: "```json\n" + JSON.stringify(jsonContent, null, 2) + "\n```",
      },
    ],
  };
}

function makeMockClient(responses: Array<Record<string, unknown>>): {
  messages: { create: ReturnType<typeof vi.fn> };
} {
  const createFn = vi.fn();
  responses.forEach((resp, i) => {
    createFn.mockResolvedValueOnce(makeMockAnthropicResponse(resp));
  });
  return { messages: { create: createFn } };
}

// --- assignTier tests ---

describe("assignTier", () => {
  it("assigns Tier 1 for 5 lenses", () => {
    expect(assignTier(5)).toBe(1);
  });

  it("assigns Tier 1 for 7 lenses", () => {
    expect(assignTier(7)).toBe(1);
  });

  it("assigns Tier 2 for 3 lenses", () => {
    expect(assignTier(3)).toBe(2);
  });

  it("assigns Tier 2 for 4 lenses", () => {
    expect(assignTier(4)).toBe(2);
  });

  it("assigns Tier 3 for 1 lens", () => {
    expect(assignTier(1)).toBe(3);
  });

  it("assigns Tier 3 for 2 lenses", () => {
    expect(assignTier(2)).toBe(3);
  });

  it("assigns Tier 1 for very high lens count", () => {
    expect(assignTier(10)).toBe(1);
  });
});

// --- parseMergeResponse tests ---

describe("parseMergeResponse", () => {
  it("parses JSON from code fences", () => {
    const text = '```json\n{"name": "Gain visibility into progress", "description": "desc", "roles": ["PM"], "product_surfaces": ["Dashboard"], "is_coherent": true}\n```';
    const result = parseMergeResponse(text);
    expect(result.name).toBe("Gain visibility into progress");
    expect(result.description).toBe("desc");
    expect(result.roles).toEqual(["PM"]);
    expect(result.product_surfaces).toEqual(["Dashboard"]);
    expect(result.is_coherent).toBe(true);
  });

  it("parses raw JSON without code fences", () => {
    const text = '{"name": "Reduce overhead", "description": "Less overhead", "roles": ["Engineer"], "product_surfaces": ["API"], "is_coherent": true}';
    const result = parseMergeResponse(text);
    expect(result.name).toBe("Reduce overhead");
  });

  it("throws on missing required field", () => {
    const text = '{"name": "Gain X", "description": "desc"}';
    expect(() => parseMergeResponse(text)).toThrow("Missing required field: roles");
  });

  it("throws on name not starting with verb (lowercase first char)", () => {
    const text = '{"name": "visibility into progress", "description": "d", "roles": [], "product_surfaces": [], "is_coherent": true}';
    expect(() => parseMergeResponse(text)).toThrow("Name must start with a verb");
  });

  it("accepts name starting with uppercase verb", () => {
    const text = '{"name": "Accelerate delivery", "description": "d", "roles": [], "product_surfaces": [], "is_coherent": true}';
    const result = parseMergeResponse(text);
    expect(result.name).toBe("Accelerate delivery");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseMergeResponse("not json")).toThrow();
  });

  it("coerces non-array roles to empty array", () => {
    const text = '{"name": "Gain X", "description": "d", "roles": "bad", "product_surfaces": [], "is_coherent": true}';
    const result = parseMergeResponse(text);
    expect(result.roles).toEqual([]);
  });
});

// --- directMerge tests ---

describe("directMerge", () => {
  it("produces a valid ValueMoment from a cluster", () => {
    const cluster = makeCluster({ cluster_id: "cluster-0" });
    const moment = directMerge(cluster);

    expect(moment.id).toBe("moment-cluster-0");
    expect(moment.name).toMatch(/^Achieve /);
    expect(moment.tier).toBe(assignTier(cluster.lens_count));
    expect(moment.lenses).toEqual(cluster.lenses);
    expect(moment.lens_count).toBe(cluster.lens_count);
    expect(moment.contributing_candidates).toEqual(["c1", "c2"]);
  });

  it("joins candidate names with separator in the name", () => {
    const cluster = makeCluster({ cluster_id: "cluster-1" });
    const moment = directMerge(cluster);
    expect(moment.name).toContain("Track progress");
    expect(moment.name).toContain("Monitor velocity");
    expect(moment.name).toContain(" / ");
  });

  it("joins candidate descriptions into description", () => {
    const cluster = makeCluster({ cluster_id: "cluster-2" });
    const moment = directMerge(cluster);
    expect(moment.description).toContain("Users track project progress");
    expect(moment.description).toContain("Teams monitor development velocity");
  });

  it("assigns correct tier based on lens count", () => {
    const cluster5 = makeCluster({
      cluster_id: "c5",
      lens_count: 5,
      lenses: ["jtbd", "outcomes", "pains", "gains", "alternatives"],
      candidates: [
        makeCandidate({ id: "1", lens: "jtbd", name: "A", description: "a" }),
        makeCandidate({ id: "2", lens: "outcomes", name: "B", description: "b" }),
        makeCandidate({ id: "3", lens: "pains", name: "C", description: "c" }),
        makeCandidate({ id: "4", lens: "gains", name: "D", description: "d" }),
        makeCandidate({ id: "5", lens: "alternatives", name: "E", description: "e" }),
      ],
    });
    expect(directMerge(cluster5).tier).toBe(1);

    const cluster3 = makeCluster({
      cluster_id: "c3",
      lens_count: 3,
      lenses: ["jtbd", "outcomes", "pains"],
      candidates: [
        makeCandidate({ id: "1", lens: "jtbd", name: "A", description: "a" }),
        makeCandidate({ id: "2", lens: "outcomes", name: "B", description: "b" }),
        makeCandidate({ id: "3", lens: "pains", name: "C", description: "c" }),
      ],
    });
    expect(directMerge(cluster3).tier).toBe(2);

    const cluster1 = makeCluster({
      cluster_id: "c1",
      lens_count: 1,
      lenses: ["jtbd"],
      candidates: [
        makeCandidate({ id: "1", lens: "jtbd", name: "A", description: "a" }),
      ],
    });
    expect(directMerge(cluster1).tier).toBe(3);
  });

  it("collects all candidate ids in contributing_candidates", () => {
    const candidates = [
      makeCandidate({ id: "id-a", lens: "jtbd", name: "A", description: "a" }),
      makeCandidate({ id: "id-b", lens: "outcomes", name: "B", description: "b" }),
      makeCandidate({ id: "id-c", lens: "pains", name: "C", description: "c" }),
    ];
    const cluster = makeCluster({
      cluster_id: "test",
      candidates,
      lens_count: 3,
      lenses: ["jtbd", "outcomes", "pains"],
    });
    const moment = directMerge(cluster);
    expect(moment.contributing_candidates).toEqual(["id-a", "id-b", "id-c"]);
  });
});

// --- buildMergePrompt tests ---

describe("buildMergePrompt", () => {
  it("includes all candidates with lens labels", () => {
    const cluster = makeCluster({ cluster_id: "test" });
    const prompt = buildMergePrompt(cluster);
    expect(prompt).toContain("jtbd lens");
    expect(prompt).toContain("outcomes lens");
    expect(prompt).toContain("Track progress");
    expect(prompt).toContain("Monitor velocity");
    expect(prompt).toContain("2 candidates");
    expect(prompt).toContain("2 different lenses");
  });
});

// --- convergeAndTier tests ---

describe("convergeAndTier", () => {
  it("returns one ValueMoment per cluster", async () => {
    const clusters = [
      makeCluster({ cluster_id: "cluster-0" }),
      makeCluster({ cluster_id: "cluster-1" }),
    ];

    const mockClient = makeMockClient([
      {
        name: "Gain project visibility",
        description: "Combined insight from jtbd and outcomes lenses",
        roles: ["PM", "Engineering Lead"],
        product_surfaces: ["Dashboard", "Reports"],
        is_coherent: true,
      },
      {
        name: "Reduce manual tracking effort",
        description: "Combined from jtbd and outcomes perspectives",
        roles: ["Developer"],
        product_surfaces: ["Board"],
        is_coherent: true,
      },
    ]);

    const moments = await convergeAndTier(clusters, mockClient as any);
    expect(moments).toHaveLength(2);
    expect(moments[0].name).toBe("Gain project visibility");
    expect(moments[1].name).toBe("Reduce manual tracking effort");
  });

  it("makes one LLM call per cluster (AC2)", async () => {
    const clusters = [
      makeCluster({ cluster_id: "c0" }),
      makeCluster({ cluster_id: "c1" }),
      makeCluster({ cluster_id: "c2" }),
    ];

    const mockClient = makeMockClient([
      { name: "Gain A", description: "d", roles: [], product_surfaces: [], is_coherent: true },
      { name: "Gain B", description: "d", roles: [], product_surfaces: [], is_coherent: true },
      { name: "Gain C", description: "d", roles: [], product_surfaces: [], is_coherent: true },
    ]);

    await convergeAndTier(clusters, mockClient as any);
    expect(mockClient.messages.create).toHaveBeenCalledTimes(3);
  });

  it("assigns correct tier based on cluster lens_count", async () => {
    const cluster5 = makeCluster({
      cluster_id: "c5",
      lens_count: 5,
      lenses: ["jtbd", "outcomes", "pains", "gains", "alternatives"],
      candidates: [
        makeCandidate({ id: "1", lens: "jtbd", name: "A", description: "a" }),
        makeCandidate({ id: "2", lens: "outcomes", name: "B", description: "b" }),
        makeCandidate({ id: "3", lens: "pains", name: "C", description: "c" }),
        makeCandidate({ id: "4", lens: "gains", name: "D", description: "d" }),
        makeCandidate({ id: "5", lens: "alternatives", name: "E", description: "e" }),
      ],
    });

    const cluster2 = makeCluster({
      cluster_id: "c2",
      lens_count: 2,
      lenses: ["jtbd", "outcomes"],
    });

    const mockClient = makeMockClient([
      { name: "Gain A", description: "d", roles: [], product_surfaces: [], is_coherent: true },
      { name: "Gain B", description: "d", roles: [], product_surfaces: [], is_coherent: true },
    ]);

    const moments = await convergeAndTier([cluster5, cluster2], mockClient as any);
    expect(moments[0].tier).toBe(1); // 5 lenses → Tier 1
    expect(moments[1].tier).toBe(3); // 2 lenses → Tier 3
  });

  it("includes contributing_candidates from cluster (AC10)", async () => {
    const candidates = [
      makeCandidate({ id: "cand-x", lens: "jtbd", name: "X", description: "x" }),
      makeCandidate({ id: "cand-y", lens: "outcomes", name: "Y", description: "y" }),
      makeCandidate({ id: "cand-z", lens: "pains", name: "Z", description: "z" }),
    ];
    const cluster = makeCluster({
      cluster_id: "test",
      candidates,
      lens_count: 3,
      lenses: ["jtbd", "outcomes", "pains"],
    });

    const mockClient = makeMockClient([
      { name: "Gain visibility", description: "multi-lens", roles: ["PM"], product_surfaces: ["Board"], is_coherent: true },
    ]);

    const moments = await convergeAndTier([cluster], mockClient as any);
    expect(moments[0].contributing_candidates).toEqual(["cand-x", "cand-y", "cand-z"]);
  });

  it("preserves LLM description referencing lens insights (AC9)", async () => {
    const cluster = makeCluster({ cluster_id: "insight-test" });

    const mockClient = makeMockClient([
      {
        name: "Gain real-time progress visibility",
        description: "From the JTBD lens: users need to track progress. From the outcomes lens: teams measure velocity to improve delivery cadence.",
        roles: ["PM"],
        product_surfaces: ["Dashboard"],
        is_coherent: true,
      },
    ]);

    const moments = await convergeAndTier([cluster], mockClient as any);
    expect(moments[0].description).toContain("JTBD lens");
    expect(moments[0].description).toContain("outcomes lens");
  });

  it("falls back to directMerge when LLM fails", async () => {
    const cluster = makeCluster({ cluster_id: "fail-test" });

    const mockClient = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error("API rate limited")),
      },
    };

    const moments = await convergeAndTier([cluster], mockClient as any);
    expect(moments).toHaveLength(1);
    expect(moments[0].name).toMatch(/^Achieve /);
    expect(moments[0].contributing_candidates).toEqual(["c1", "c2"]);
  });

  it("falls back to directMerge when response parsing fails", async () => {
    const cluster = makeCluster({ cluster_id: "parse-fail" });

    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "This is not JSON at all" }],
        }),
      },
    };

    const moments = await convergeAndTier([cluster], mockClient as any);
    expect(moments).toHaveLength(1);
    expect(moments[0].name).toMatch(/^Achieve /);
  });

  it("handles mixed success and failure across clusters", async () => {
    const cluster1 = makeCluster({ cluster_id: "ok" });
    const cluster2 = makeCluster({ cluster_id: "fail" });

    const mockClient = {
      messages: {
        create: vi
          .fn()
          .mockResolvedValueOnce(
            makeMockAnthropicResponse({
              name: "Gain visibility",
              description: "good",
              roles: ["PM"],
              product_surfaces: ["Board"],
              is_coherent: true,
            })
          )
          .mockRejectedValueOnce(new Error("API error")),
      },
    };

    const moments = await convergeAndTier([cluster1, cluster2], mockClient as any);
    expect(moments).toHaveLength(2);
    expect(moments[0].name).toBe("Gain visibility"); // LLM succeeded
    expect(moments[1].name).toMatch(/^Achieve /); // Fallback
  });

  it("returns empty array for empty clusters input", async () => {
    const mockClient = makeMockClient([]);
    const moments = await convergeAndTier([], mockClient as any);
    expect(moments).toEqual([]);
  });
});
