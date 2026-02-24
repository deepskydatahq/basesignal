import { describe, it, expect, vi } from "vitest";
import {
  assignTier,
  parseMergeResponse,
  directMerge,
  converge,
  runConvergence,
  buildMergePrompt,
  capTierDistribution,
  validateConvergenceQuality,
  BUSINESS_VERBS,
  USER_ACTION_VERBS,
  isBusinessVerb,
  MERGE_SYSTEM_PROMPT,
} from "./convergence";
import type { LlmProvider } from "../llm/types";
import type {
  CandidateCluster,
  ValueMoment,
  ValueMomentTier,
  ConvergenceResult,
} from "./convergence-types";
import type { ValidatedCandidate, ExperientialLensType } from "../types/convergence";

// --- Test helpers ---

function makeCandidate(
  overrides: Partial<ValidatedCandidate> & {
    id: string;
    lens: ExperientialLensType;
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

function makeMockLlmProvider(
  responses: Array<Record<string, unknown>>
): { provider: LlmProvider; calls: Array<{ prompt: string; system: string }> } {
  const calls: Array<{ prompt: string; system: string }> = [];
  let callIndex = 0;

  const provider: LlmProvider = {
    complete: async (messages) => {
      const system = messages.find((m) => m.role === "system")?.content ?? "";
      const prompt = messages.find((m) => m.role === "user")?.content ?? "";
      calls.push({ prompt, system });
      const response = responses[callIndex++];
      if (!response) throw new Error("No more mock responses");
      return "```json\n" + JSON.stringify(response, null, 2) + "\n```";
    },
  };

  return { provider, calls };
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

    // ID is now slugified from the name (e.g., "Achieve Track progress / Monitor velocity")
    expect(moment.id).toMatch(/^moment-achieve-/);
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

// --- converge tests ---

describe("converge", () => {
  it("returns one ValueMoment per cluster using directMerge when no LLM", async () => {
    const clusters = [
      makeCluster({ cluster_id: "cluster-0" }),
      makeCluster({ cluster_id: "cluster-1" }),
    ];

    const moments = await converge(clusters);
    expect(moments).toHaveLength(2);
    expect(moments[0].name).toMatch(/^Achieve /);
    expect(moments[1].name).toMatch(/^Achieve /);
  });

  it("returns one ValueMoment per cluster with LLM provider", async () => {
    const clusters = [
      makeCluster({ cluster_id: "cluster-0" }),
      makeCluster({ cluster_id: "cluster-1" }),
    ];

    const { provider } = makeMockLlmProvider([
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

    const moments = await converge(clusters, { llmProvider: provider });
    expect(moments).toHaveLength(2);
    expect(moments[0].name).toBe("Gain project visibility");
    expect(moments[1].name).toBe("Reduce manual tracking effort");
  });

  it("makes one LLM call per cluster", async () => {
    const clusters = [
      makeCluster({ cluster_id: "c0" }),
      makeCluster({ cluster_id: "c1" }),
      makeCluster({ cluster_id: "c2" }),
    ];

    const { provider, calls } = makeMockLlmProvider([
      { name: "Gain A", description: "d", roles: [], product_surfaces: [], is_coherent: true },
      { name: "Gain B", description: "d", roles: [], product_surfaces: [], is_coherent: true },
      { name: "Gain C", description: "d", roles: [], product_surfaces: [], is_coherent: true },
    ]);

    await converge(clusters, { llmProvider: provider });
    expect(calls).toHaveLength(3);
  });

  it("passes MERGE_SYSTEM_PROMPT as system parameter", async () => {
    const clusters = [makeCluster({ cluster_id: "c0" })];

    const { provider, calls } = makeMockLlmProvider([
      { name: "Gain A", description: "d", roles: [], product_surfaces: [], is_coherent: true },
    ]);

    await converge(clusters, { llmProvider: provider });
    expect(calls[0].system).toBe(MERGE_SYSTEM_PROMPT);
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

    const { provider } = makeMockLlmProvider([
      { name: "Gain A", description: "d", roles: [], product_surfaces: [], is_coherent: true },
      { name: "Gain B", description: "d", roles: [], product_surfaces: [], is_coherent: true },
    ]);

    const moments = await converge([cluster5, cluster2], { llmProvider: provider });
    expect(moments[0].tier).toBe(1); // 5 lenses -> Tier 1
    expect(moments[1].tier).toBe(2); // 2 lenses -> Tier 2
  });

  it("includes contributing_candidates from cluster", async () => {
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

    const { provider } = makeMockLlmProvider([
      { name: "Gain visibility", description: "multi-lens", roles: ["PM"], product_surfaces: ["Board"], is_coherent: true },
    ]);

    const moments = await converge([cluster], { llmProvider: provider });
    expect(moments[0].contributing_candidates).toEqual(["cand-x", "cand-y", "cand-z"]);
  });

  it("preserves LLM description referencing lens insights", async () => {
    const cluster = makeCluster({ cluster_id: "insight-test" });

    const { provider } = makeMockLlmProvider([
      {
        name: "Gain real-time progress visibility",
        description: "From the JTBD lens: users need to track progress. From the outcomes lens: teams measure velocity to improve delivery cadence.",
        roles: ["PM"],
        product_surfaces: ["Dashboard"],
        is_coherent: true,
      },
    ]);

    const moments = await converge([cluster], { llmProvider: provider });
    expect(moments[0].description).toContain("JTBD lens");
    expect(moments[0].description).toContain("outcomes lens");
  });

  it("falls back to directMerge when LLM provider throws", async () => {
    const cluster = makeCluster({ cluster_id: "fail-test" });

    const failingProvider: LlmProvider = {
      complete: async () => { throw new Error("API rate limited"); },
    };

    const moments = await converge([cluster], { llmProvider: failingProvider });
    expect(moments).toHaveLength(1);
    expect(moments[0].name).toMatch(/^Achieve /);
    expect(moments[0].contributing_candidates).toEqual(["c1", "c2"]);
  });

  it("falls back to directMerge when response parsing fails", async () => {
    const cluster = makeCluster({ cluster_id: "parse-fail" });

    const badProvider: LlmProvider = {
      complete: async () => "This is not JSON at all",
    };

    const moments = await converge([cluster], { llmProvider: badProvider });
    expect(moments).toHaveLength(1);
    expect(moments[0].name).toMatch(/^Achieve /);
  });

  it("handles mixed success and failure across clusters", async () => {
    const cluster1 = makeCluster({ cluster_id: "ok" });
    const cluster2 = makeCluster({ cluster_id: "fail" });

    let callCount = 0;
    const mixedProvider: LlmProvider = {
      complete: async () => {
        callCount++;
        if (callCount === 1) {
          return "```json\n" + JSON.stringify({
            name: "Gain visibility",
            description: "good",
            roles: ["PM"],
            product_surfaces: ["Board"],
            is_coherent: true,
          }, null, 2) + "\n```";
        }
        throw new Error("API error");
      },
    };

    const moments = await converge([cluster1, cluster2], { llmProvider: mixedProvider });
    expect(moments).toHaveLength(2);
    expect(moments[0].name).toBe("Gain visibility"); // LLM succeeded
    expect(moments[1].name).toMatch(/^Achieve /); // Fallback
  });

  it("returns empty array for empty clusters input", async () => {
    const moments = await converge([]);
    expect(moments).toEqual([]);
  });

  it("returns empty array for empty clusters with LLM provider", async () => {
    const { provider } = makeMockLlmProvider([]);
    const moments = await converge([], { llmProvider: provider });
    expect(moments).toEqual([]);
  });

  it("deduplicates moment IDs when clusters produce the same slugified name (no LLM)", async () => {
    const cluster1 = makeCluster({
      cluster_id: "dup-1",
      candidates: [
        makeCandidate({ id: "c1", lens: "jtbd", name: "Foo", description: "First foo" }),
      ],
      lens_count: 1,
      lenses: ["jtbd"],
    });
    const cluster2 = makeCluster({
      cluster_id: "dup-2",
      candidates: [
        makeCandidate({ id: "c2", lens: "outcomes", name: "Foo", description: "Second foo" }),
      ],
      lens_count: 1,
      lenses: ["outcomes"],
    });

    const moments = await converge([cluster1, cluster2]);
    expect(moments).toHaveLength(2);
    expect(moments[0].id).toBe("moment-achieve-foo");
    expect(moments[1].id).toBe("moment-achieve-foo-2");
  });

  it("deduplicates moment IDs when LLM returns the same name for multiple clusters", async () => {
    const cluster1 = makeCluster({ cluster_id: "llm-dup-1" });
    const cluster2 = makeCluster({ cluster_id: "llm-dup-2" });

    const { provider } = makeMockLlmProvider([
      { name: "Gain visibility", description: "d1", roles: ["PM"], product_surfaces: ["Board"], is_coherent: true },
      { name: "Gain visibility", description: "d2", roles: ["Lead"], product_surfaces: ["Dashboard"], is_coherent: true },
    ]);

    const moments = await converge([cluster1, cluster2], { llmProvider: provider });
    expect(moments).toHaveLength(2);
    expect(moments[0].id).toBe("moment-gain-visibility");
    expect(moments[1].id).toBe("moment-gain-visibility-2");
  });
});

// --- capTierDistribution tests ---

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

describe("validateConvergenceQuality", () => {
  it("returns pass for a healthy result", () => {
    const result = makeConvergenceResult();
    const report = validateConvergenceQuality(result);
    expect(report.overall).toBe("pass");
    expect(report.checks).toHaveLength(4);
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
    // 0 T1 -> fail, <10 total -> fail, no empty -> pass
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

  it("warns when moment names use business verbs (experiential_names check)", () => {
    const moments = [
      ...Array.from({ length: 3 }, (_, i) =>
        makeMoment({ id: `t1-${i}`, tier: 1, name: "View a heatmap of team workload", contributing_candidates: ["a", "b", "c", "d"] })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeMoment({ id: `t2-${i}`, tier: 2, name: "Create a project dashboard", contributing_candidates: ["a", "b"] })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeMoment({ id: `t3-${i}`, tier: 3, name: "Filter results by date", contributing_candidates: ["a"] })
      ),
      // Business verb moment
      makeMoment({ id: "biz-1", tier: 3, name: "Gain visibility into workload", contributing_candidates: ["a"] }),
    ];
    const result = makeConvergenceResult({ value_moments: moments });
    const report = validateConvergenceQuality(result);
    const nameCheck = report.checks.find((c) => c.name === "experiential_names");
    expect(nameCheck?.status).toBe("warn");
    expect(nameCheck?.message).toContain("1 moment(s) use business verbs");
    expect(nameCheck?.message).toContain("Gain visibility into workload");
  });

  it("passes when all moment names use user-action verbs", () => {
    const moments = [
      ...Array.from({ length: 3 }, (_, i) =>
        makeMoment({ id: `t1-${i}`, tier: 1, name: "View a heatmap of team workload", contributing_candidates: ["a", "b", "c", "d"] })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeMoment({ id: `t2-${i}`, tier: 2, name: "Create a project dashboard", contributing_candidates: ["a", "b"] })
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        makeMoment({ id: `t3-${i}`, tier: 3, name: "Filter results by date", contributing_candidates: ["a"] })
      ),
    ];
    const result = makeConvergenceResult({ value_moments: moments });
    const report = validateConvergenceQuality(result);
    const nameCheck = report.checks.find((c) => c.name === "experiential_names");
    expect(nameCheck?.status).toBe("pass");
    expect(nameCheck?.message).toBe("All names use experiential verbs");
  });

  it("warns for 'Automate protection of sensitive data'", () => {
    const moments = [
      ...Array.from({ length: 3 }, (_, i) =>
        makeMoment({ id: `t1-${i}`, tier: 1, name: "View dashboard", contributing_candidates: ["a", "b", "c", "d"] })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeMoment({ id: `t2-${i}`, tier: 2, name: "Create report", contributing_candidates: ["a", "b"] })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makeMoment({ id: `t3-${i}`, tier: 3, name: "Filter items", contributing_candidates: ["a"] })
      ),
      makeMoment({ id: "biz-auto", tier: 3, name: "Automate protection of sensitive data", contributing_candidates: ["a"] }),
    ];
    const result = makeConvergenceResult({ value_moments: moments });
    const report = validateConvergenceQuality(result);
    const nameCheck = report.checks.find((c) => c.name === "experiential_names");
    expect(nameCheck?.status).toBe("warn");
    expect(nameCheck?.message).toContain("Automate protection of sensitive data");
  });

  it("experiential_names check is non-blocking (warn, not fail)", () => {
    const moments = [
      ...Array.from({ length: 3 }, (_, i) =>
        makeMoment({ id: `t1-${i}`, tier: 1, name: "Gain visibility", contributing_candidates: ["a", "b", "c", "d"] })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeMoment({ id: `t2-${i}`, tier: 2, name: "Reduce overhead", contributing_candidates: ["a", "b"] })
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        makeMoment({ id: `t3-${i}`, tier: 3, name: "Accelerate delivery", contributing_candidates: ["a"] })
      ),
    ];
    const result = makeConvergenceResult({ value_moments: moments });
    const report = validateConvergenceQuality(result);
    const nameCheck = report.checks.find((c) => c.name === "experiential_names");
    // All names use business verbs, but status should be warn, never fail
    expect(nameCheck?.status).toBe("warn");
    expect(nameCheck?.status).not.toBe("fail");
  });
});

// --- isBusinessVerb tests ---

describe("isBusinessVerb", () => {
  it("returns true for business verbs", () => {
    expect(isBusinessVerb("Gain visibility into workload")).toBe(true);
    expect(isBusinessVerb("Reduce time spent on reporting")).toBe(true);
    expect(isBusinessVerb("Accelerate delivery of features")).toBe(true);
    expect(isBusinessVerb("Optimize resource allocation")).toBe(true);
    expect(isBusinessVerb("Automate protection of sensitive data")).toBe(true);
    expect(isBusinessVerb("Leverage existing integrations")).toBe(true);
    expect(isBusinessVerb("Enable cross-team collaboration")).toBe(true);
    expect(isBusinessVerb("Enhance user experience")).toBe(true);
    expect(isBusinessVerb("Empower teams to self-serve")).toBe(true);
    expect(isBusinessVerb("Transform workflow efficiency")).toBe(true);
    expect(isBusinessVerb("Revolutionize data processing")).toBe(true);
    expect(isBusinessVerb("Streamline onboarding flow")).toBe(true);
  });

  it("returns false for user-action verbs", () => {
    expect(isBusinessVerb("View a heatmap of team workload")).toBe(false);
    expect(isBusinessVerb("Create a project dashboard")).toBe(false);
    expect(isBusinessVerb("Share report with stakeholders")).toBe(false);
    expect(isBusinessVerb("Export data as CSV")).toBe(false);
    expect(isBusinessVerb("Filter results by date")).toBe(false);
    expect(isBusinessVerb("Upload a file")).toBe(false);
    expect(isBusinessVerb("Configure notification settings")).toBe(false);
  });

  it("returns false for unknown verbs", () => {
    expect(isBusinessVerb("Discover new patterns")).toBe(false);
    expect(isBusinessVerb("Monitor team velocity")).toBe(false);
  });

  it("handles empty and whitespace strings", () => {
    expect(isBusinessVerb("")).toBe(false);
    expect(isBusinessVerb("  ")).toBe(false);
  });
});

// --- BUSINESS_VERBS and USER_ACTION_VERBS constants ---

describe("verb constants", () => {
  it("BUSINESS_VERBS contains all 12 expected verbs", () => {
    expect(BUSINESS_VERBS).toHaveLength(12);
    expect(BUSINESS_VERBS).toContain("Gain");
    expect(BUSINESS_VERBS).toContain("Reduce");
    expect(BUSINESS_VERBS).toContain("Accelerate");
    expect(BUSINESS_VERBS).toContain("Optimize");
    expect(BUSINESS_VERBS).toContain("Streamline");
    expect(BUSINESS_VERBS).toContain("Automate");
    expect(BUSINESS_VERBS).toContain("Leverage");
    expect(BUSINESS_VERBS).toContain("Enable");
    expect(BUSINESS_VERBS).toContain("Enhance");
    expect(BUSINESS_VERBS).toContain("Empower");
    expect(BUSINESS_VERBS).toContain("Transform");
    expect(BUSINESS_VERBS).toContain("Revolutionize");
  });

  it("USER_ACTION_VERBS contains all 16 expected verbs", () => {
    expect(USER_ACTION_VERBS).toHaveLength(16);
    expect(USER_ACTION_VERBS).toContain("Create");
    expect(USER_ACTION_VERBS).toContain("Share");
    expect(USER_ACTION_VERBS).toContain("Export");
    expect(USER_ACTION_VERBS).toContain("Build");
    expect(USER_ACTION_VERBS).toContain("Drag");
    expect(USER_ACTION_VERBS).toContain("Invite");
    expect(USER_ACTION_VERBS).toContain("Comment");
    expect(USER_ACTION_VERBS).toContain("Vote");
    expect(USER_ACTION_VERBS).toContain("Upload");
    expect(USER_ACTION_VERBS).toContain("Filter");
    expect(USER_ACTION_VERBS).toContain("Tag");
    expect(USER_ACTION_VERBS).toContain("Open");
    expect(USER_ACTION_VERBS).toContain("View");
    expect(USER_ACTION_VERBS).toContain("Configure");
    expect(USER_ACTION_VERBS).toContain("Set");
    expect(USER_ACTION_VERBS).toContain("Move");
  });

  it("BUSINESS_VERBS and USER_ACTION_VERBS have no overlap", () => {
    const businessSet = new Set(BUSINESS_VERBS);
    const overlap = USER_ACTION_VERBS.filter((v) => businessSet.has(v as any));
    expect(overlap).toHaveLength(0);
  });
});

// --- runConvergence tests ---

describe("runConvergence", () => {
  it("produces ConvergenceResult with stats and quality report", async () => {
    const clusters = [
      makeCluster({
        cluster_id: "c0",
        lens_count: 4,
        lenses: ["jtbd", "outcomes", "pains", "gains"],
        candidates: [
          makeCandidate({ id: "1", lens: "jtbd", name: "A", description: "a" }),
          makeCandidate({ id: "2", lens: "outcomes", name: "B", description: "b" }),
          makeCandidate({ id: "3", lens: "pains", name: "C", description: "c" }),
          makeCandidate({ id: "4", lens: "gains", name: "D", description: "d" }),
        ],
      }),
      makeCluster({
        cluster_id: "c1",
        lens_count: 2,
        lenses: ["jtbd", "outcomes"],
      }),
    ];

    const result = await runConvergence(clusters, 50);
    expect(result.stats.total_candidates).toBe(50);
    expect(result.stats.total_clusters).toBe(2);
    expect(result.stats.total_moments).toBe(2);
    expect(result.value_moments).toHaveLength(2);
    expect(result.quality).toBeDefined();
    expect(result.quality!.checks.length).toBeGreaterThan(0);
  });

  it("applies tier capping", async () => {
    // 5 clusters all with lens_count >= 4 (all T1)
    const clusters = Array.from({ length: 5 }, (_, i) =>
      makeCluster({
        cluster_id: `c${i}`,
        lens_count: 4,
        lenses: ["jtbd", "outcomes", "pains", "gains"],
        candidates: [
          makeCandidate({ id: `${i}-1`, lens: "jtbd", name: "A", description: "a" }),
          makeCandidate({ id: `${i}-2`, lens: "outcomes", name: "B", description: "b" }),
          makeCandidate({ id: `${i}-3`, lens: "pains", name: "C", description: "c" }),
          makeCandidate({ id: `${i}-4`, lens: "gains", name: "D", description: "d" }),
        ],
      })
    );

    const result = await runConvergence(clusters, 20);
    // Max 3 remain T1 after capping
    expect(result.stats.tier_1_count).toBeLessThanOrEqual(3);
    expect(result.stats.total_moments).toBe(5); // all still present, just re-tiered
  });

  it("includes quality report with overall status", async () => {
    const clusters = [
      makeCluster({ cluster_id: "c0" }),
    ];

    const result = await runConvergence(clusters, 10);
    expect(result.quality).toBeDefined();
    expect(result.quality!.overall).toBeDefined();
    expect(result.quality!.checks).toHaveLength(4);
  });

  it("works with LLM provider", async () => {
    const clusters = [
      makeCluster({ cluster_id: "c0" }),
      makeCluster({ cluster_id: "c1" }),
    ];

    const { provider } = makeMockLlmProvider([
      { name: "View project dashboard", description: "d", roles: ["PM"], product_surfaces: ["Dashboard"], is_coherent: true },
      { name: "Create weekly report", description: "d", roles: ["Lead"], product_surfaces: ["Reports"], is_coherent: true },
    ]);

    const result = await runConvergence(clusters, 30, { llmProvider: provider });
    expect(result.value_moments[0].name).toBe("View project dashboard");
    expect(result.value_moments[1].name).toBe("Create weekly report");
  });
});
