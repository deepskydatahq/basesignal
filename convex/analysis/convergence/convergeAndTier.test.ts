import { describe, it, expect, vi } from "vitest";
import {
  assignTier,
  parseMergeResponse,
  directMerge,
  convergeAndTier,
  buildMergePrompt,
  capTierDistribution,
  validateConvergenceQuality,
} from "./convergeAndTier";
import type { CandidateCluster, ValidatedCandidate, LensType, ConvergenceResult } from "./types";

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
  it("assigns Tier 1 for 4 lenses", () => {
    expect(assignTier(4)).toBe(1);
  });

  it("assigns Tier 1 for 5 lenses", () => {
    expect(assignTier(5)).toBe(1);
  });

  it("assigns Tier 1 for 7 lenses", () => {
    expect(assignTier(7)).toBe(1);
  });

  it("assigns Tier 2 for 2 lenses", () => {
    expect(assignTier(2)).toBe(2);
  });

  it("assigns Tier 2 for 3 lenses", () => {
    expect(assignTier(3)).toBe(2);
  });

  it("assigns Tier 3 for 1 lens", () => {
    expect(assignTier(1)).toBe(3);
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
    expect(moments[1].tier).toBe(2); // 2 lenses → Tier 2
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

// --- capTierDistribution tests ---

import type { ValueMoment, ValueMomentTier } from "./types";

function makeMoment(
  overrides: Partial<ValueMoment> & { id: string; tier: ValueMomentTier }
): ValueMoment {
  return {
    name: `Moment ${overrides.id}`,
    description: "desc",
    lenses: ["jtbd"],
    lens_count: 1,
    roles: [],
    product_surfaces: [],
    contributing_candidates: ["c1"],
    ...overrides,
  };
}

describe("capTierDistribution", () => {
  it("passes through when within limits", () => {
    const moments = [
      makeMoment({ id: "m1", tier: 1, contributing_candidates: ["a", "b", "c", "d"] }),
      makeMoment({ id: "m2", tier: 2, contributing_candidates: ["e", "f"] }),
      makeMoment({ id: "m3", tier: 3, contributing_candidates: ["g"] }),
    ];
    const result = capTierDistribution(moments);
    expect(result).toHaveLength(3);
    expect(result.map((m) => m.tier)).toEqual([1, 2, 3]);
  });

  it("demotes excess T1 to T2 (lowest contributing_candidates first)", () => {
    const moments = [
      makeMoment({ id: "m1", tier: 1, contributing_candidates: ["a", "b", "c", "d", "e"] }), // 5 candidates — keep
      makeMoment({ id: "m2", tier: 1, contributing_candidates: ["a", "b", "c", "d"] }), // 4 — keep
      makeMoment({ id: "m3", tier: 1, contributing_candidates: ["a", "b", "c"] }), // 3 — keep
      makeMoment({ id: "m4", tier: 1, contributing_candidates: ["a", "b"] }), // 2 — demote
      makeMoment({ id: "m5", tier: 1, contributing_candidates: ["a"] }), // 1 — demote
    ];
    const result = capTierDistribution(moments);
    expect(result).toHaveLength(5); // all still present
    const t1 = result.filter((m) => m.tier === 1);
    const t2 = result.filter((m) => m.tier === 2);
    expect(t1).toHaveLength(3);
    expect(t2).toHaveLength(2);
    // m4 and m5 should be demoted (fewest candidates)
    expect(t2.map((m) => m.id).sort()).toEqual(["m4", "m5"]);
  });

  it("drops excess T3 (lowest contributing_candidates first)", () => {
    // Create 22 T3 moments with varying candidate counts
    const moments: ValueMoment[] = [];
    for (let i = 0; i < 22; i++) {
      const candidateCount = i + 1; // 1 to 22 candidates
      moments.push(
        makeMoment({
          id: `m${i}`,
          tier: 3,
          contributing_candidates: Array.from({ length: candidateCount }, (_, j) => `c${j}`),
        })
      );
    }
    const result = capTierDistribution(moments);
    expect(result).toHaveLength(20); // dropped 2
    // The two with fewest candidates (m0=1, m1=2) should be dropped
    const ids = result.map((m) => m.id);
    expect(ids).not.toContain("m0");
    expect(ids).not.toContain("m1");
    expect(ids).toContain("m2"); // kept (3 candidates)
  });

  it("applies both T1 demotion and T3 dropping together", () => {
    const moments = [
      // 5 T1 moments
      makeMoment({ id: "t1-a", tier: 1, contributing_candidates: ["a", "b", "c", "d", "e"] }),
      makeMoment({ id: "t1-b", tier: 1, contributing_candidates: ["a", "b", "c", "d"] }),
      makeMoment({ id: "t1-c", tier: 1, contributing_candidates: ["a", "b", "c"] }),
      makeMoment({ id: "t1-d", tier: 1, contributing_candidates: ["a", "b"] }),
      makeMoment({ id: "t1-e", tier: 1, contributing_candidates: ["a"] }),
      // 21 T3 moments
      ...Array.from({ length: 21 }, (_, i) =>
        makeMoment({
          id: `t3-${i}`,
          tier: 3,
          contributing_candidates: Array.from({ length: i + 1 }, (_, j) => `c${j}`),
        })
      ),
    ];
    const result = capTierDistribution(moments);
    const t1 = result.filter((m) => m.tier === 1);
    const t3 = result.filter((m) => m.tier === 3);
    expect(t1).toHaveLength(3); // 2 demoted
    expect(t3).toHaveLength(20); // 1 dropped
  });

  it("handles empty input", () => {
    expect(capTierDistribution([])).toEqual([]);
  });
});

// --- validateConvergenceQuality tests ---

function makeConvergenceResult(overrides: Partial<ConvergenceResult> = {}): ConvergenceResult {
  const defaultMoments = [
    ...Array.from({ length: 3 }, (_, i) =>
      makeMoment({ id: `t1-${i}`, tier: 1, contributing_candidates: ["a", "b", "c", "d"] })
    ),
    ...Array.from({ length: 5 }, (_, i) =>
      makeMoment({ id: `t2-${i}`, tier: 2, contributing_candidates: ["a", "b"] })
    ),
    ...Array.from({ length: 7 }, (_, i) =>
      makeMoment({ id: `t3-${i}`, tier: 3, contributing_candidates: ["a"] })
    ),
  ];
  const moments = overrides.value_moments ?? defaultMoments;
  return {
    value_moments: moments,
    clusters: [],
    stats: overrides.stats ?? {
      total_candidates: 50,
      total_clusters: 15,
      total_moments: moments.length,
      tier_1_count: moments.filter((m) => m.tier === 1).length,
      tier_2_count: moments.filter((m) => m.tier === 2).length,
      tier_3_count: moments.filter((m) => m.tier === 3).length,
    },
    ...overrides,
  };
}

describe("validateConvergenceQuality", () => {
  it("returns pass for a healthy result", () => {
    const result = makeConvergenceResult();
    const report = validateConvergenceQuality(result);
    expect(report.overall).toBe("pass");
    expect(report.checks).toHaveLength(3);
    expect(report.checks.every((c) => c.status === "pass")).toBe(true);
  });

  it("fails when T1 count is 0", () => {
    const moments = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeMoment({ id: `t2-${i}`, tier: 2, contributing_candidates: ["a", "b"] })
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        makeMoment({ id: `t3-${i}`, tier: 3, contributing_candidates: ["a"] })
      ),
    ];
    const result = makeConvergenceResult({ value_moments: moments });
    const report = validateConvergenceQuality(result);
    expect(report.overall).toBe("fail");
    const tierCheck = report.checks.find((c) => c.name === "tier_distribution");
    expect(tierCheck?.status).toBe("fail");
    expect(tierCheck?.message).toContain("T1 count 0 below minimum 1");
  });

  it("warns when T1 count exceeds 5", () => {
    const moments = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeMoment({ id: `t1-${i}`, tier: 1, contributing_candidates: ["a", "b", "c", "d"] })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeMoment({ id: `t2-${i}`, tier: 2, contributing_candidates: ["a", "b"] })
      ),
    ];
    const result = makeConvergenceResult({ value_moments: moments });
    const report = validateConvergenceQuality(result);
    const tierCheck = report.checks.find((c) => c.name === "tier_distribution");
    expect(tierCheck?.status).toBe("warn");
    expect(tierCheck?.message).toContain("T1 count 6 above recommended 5");
  });

  it("warns when T2 count is below 2", () => {
    const moments = [
      ...Array.from({ length: 3 }, (_, i) =>
        makeMoment({ id: `t1-${i}`, tier: 1, contributing_candidates: ["a", "b", "c", "d"] })
      ),
      makeMoment({ id: "t2-0", tier: 2, contributing_candidates: ["a", "b"] }),
      ...Array.from({ length: 7 }, (_, i) =>
        makeMoment({ id: `t3-${i}`, tier: 3, contributing_candidates: ["a"] })
      ),
    ];
    const result = makeConvergenceResult({ value_moments: moments });
    const report = validateConvergenceQuality(result);
    const tierCheck = report.checks.find((c) => c.name === "tier_distribution");
    expect(tierCheck?.status).toBe("warn");
    expect(tierCheck?.message).toContain("T2 count 1 below minimum 2");
  });

  it("fails when total moments below 10", () => {
    const moments = [
      makeMoment({ id: "t1-0", tier: 1, contributing_candidates: ["a", "b", "c", "d"] }),
      ...Array.from({ length: 3 }, (_, i) =>
        makeMoment({ id: `t2-${i}`, tier: 2, contributing_candidates: ["a", "b"] })
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        makeMoment({ id: `t3-${i}`, tier: 3, contributing_candidates: ["a"] })
      ),
    ];
    const result = makeConvergenceResult({ value_moments: moments });
    const report = validateConvergenceQuality(result);
    expect(report.overall).toBe("fail");
    const countCheck = report.checks.find((c) => c.name === "total_count");
    expect(countCheck?.status).toBe("fail");
    expect(countCheck?.message).toContain("6 moments below minimum 10");
  });

  it("warns when total moments above 35", () => {
    const moments = [
      ...Array.from({ length: 3 }, (_, i) =>
        makeMoment({ id: `t1-${i}`, tier: 1, contributing_candidates: ["a", "b", "c", "d"] })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeMoment({ id: `t2-${i}`, tier: 2, contributing_candidates: ["a", "b"] })
      ),
      ...Array.from({ length: 25 }, (_, i) =>
        makeMoment({ id: `t3-${i}`, tier: 3, contributing_candidates: ["a"] })
      ),
    ];
    const result = makeConvergenceResult({ value_moments: moments });
    const report = validateConvergenceQuality(result);
    const countCheck = report.checks.find((c) => c.name === "total_count");
    expect(countCheck?.status).toBe("warn");
    expect(countCheck?.message).toContain("38 moments above recommended 35");
  });

  it("warns when moments have empty names or descriptions", () => {
    const moments = [
      ...Array.from({ length: 3 }, (_, i) =>
        makeMoment({ id: `t1-${i}`, tier: 1, contributing_candidates: ["a", "b", "c", "d"] })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeMoment({ id: `t2-${i}`, tier: 2, contributing_candidates: ["a", "b"] })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makeMoment({ id: `t3-${i}`, tier: 3, contributing_candidates: ["a"] })
      ),
      makeMoment({ id: "empty-name", tier: 3, name: "", contributing_candidates: ["a"] }),
      makeMoment({ id: "empty-desc", tier: 3, description: "  ", contributing_candidates: ["a"] }),
    ];
    const result = makeConvergenceResult({ value_moments: moments });
    const report = validateConvergenceQuality(result);
    const emptyCheck = report.checks.find((c) => c.name === "empty_fields");
    expect(emptyCheck?.status).toBe("warn");
    expect(emptyCheck?.message).toContain("1 empty name(s)");
    expect(emptyCheck?.message).toContain("1 empty description(s)");
  });

  it("overall is worst status across all checks", () => {
    // 0 T1 → fail, <10 total → fail, no empty → pass
    const moments = [
      ...Array.from({ length: 3 }, (_, i) =>
        makeMoment({ id: `t2-${i}`, tier: 2, contributing_candidates: ["a", "b"] })
      ),
    ];
    const result = makeConvergenceResult({ value_moments: moments });
    const report = validateConvergenceQuality(result);
    expect(report.overall).toBe("fail");
    // Should have at least one fail check
    expect(report.checks.some((c) => c.status === "fail")).toBe(true);
  });
});
