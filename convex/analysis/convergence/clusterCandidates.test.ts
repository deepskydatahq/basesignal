import { describe, it, expect } from "vitest";
import {
  UnionFind,
  candidateText,
  sameLens,
  canMerge,
  buildCluster,
  clusterCandidatesCore,
  DEFAULT_SIMILARITY_THRESHOLD,
  CLUSTERING_SYSTEM_PROMPT,
  buildClusteringPrompt,
  parseClusteringResponse,
} from "./clusterCandidates";
import type { ValidatedCandidate, LensType } from "./types";

// --- Test helpers ---

function makeCandidate(
  overrides: Partial<ValidatedCandidate> & { id: string; lens: LensType; name: string; description: string }
): ValidatedCandidate {
  return {
    confidence: 0.8,
    validation_status: "valid",
    ...overrides,
  };
}

// --- UnionFind tests ---

describe("UnionFind", () => {
  it("starts with each element in its own set", () => {
    const uf = new UnionFind(5);
    for (let i = 0; i < 5; i++) {
      expect(uf.find(i)).toBe(i);
    }
  });

  it("merges two elements", () => {
    const uf = new UnionFind(3);
    uf.union(0, 1);
    expect(uf.connected(0, 1)).toBe(true);
    expect(uf.connected(0, 2)).toBe(false);
  });

  it("handles transitive unions", () => {
    const uf = new UnionFind(4);
    uf.union(0, 1);
    uf.union(1, 2);
    expect(uf.connected(0, 2)).toBe(true);
    expect(uf.connected(0, 3)).toBe(false);
  });

  it("is idempotent on repeated union", () => {
    const uf = new UnionFind(2);
    uf.union(0, 1);
    uf.union(0, 1);
    expect(uf.connected(0, 1)).toBe(true);
  });
});

// --- Helper function tests ---

describe("candidateText", () => {
  it("concatenates name and description", () => {
    const c = makeCandidate({
      id: "1",
      lens: "jtbd",
      name: "Track tasks",
      description: "Manage team workflow",
    });
    expect(candidateText(c)).toBe("Track tasks Manage team workflow");
  });
});

describe("sameLens", () => {
  it("returns true for same lens", () => {
    const a = makeCandidate({ id: "1", lens: "jtbd", name: "A", description: "desc" });
    const b = makeCandidate({ id: "2", lens: "jtbd", name: "B", description: "desc" });
    expect(sameLens(a, b)).toBe(true);
  });

  it("returns false for different lenses", () => {
    const a = makeCandidate({ id: "1", lens: "jtbd", name: "A", description: "desc" });
    const b = makeCandidate({ id: "2", lens: "pains", name: "B", description: "desc" });
    expect(sameLens(a, b)).toBe(false);
  });
});

describe("canMerge", () => {
  it("allows merging when clusters have no lens overlap", () => {
    const candidates = [
      makeCandidate({ id: "1", lens: "jtbd", name: "A", description: "desc" }),
      makeCandidate({ id: "2", lens: "pains", name: "B", description: "desc" }),
    ];
    const uf = new UnionFind(2);
    expect(canMerge(uf, 0, 1, candidates)).toBe(true);
  });

  it("prevents merging when clusters would have lens overlap", () => {
    const candidates = [
      makeCandidate({ id: "1", lens: "jtbd", name: "A", description: "desc" }),
      makeCandidate({ id: "2", lens: "pains", name: "B", description: "desc" }),
      makeCandidate({ id: "3", lens: "jtbd", name: "C", description: "desc" }),
    ];
    const uf = new UnionFind(3);
    // Merge 0 and 1 into one cluster (jtbd + pains)
    uf.union(0, 1);
    // Now trying to merge candidate 2 (jtbd) into that cluster should fail
    expect(canMerge(uf, 1, 2, candidates)).toBe(false);
  });

  it("prevents transitive same-lens violations", () => {
    // A(jtbd) -- B(pains) -- C(jtbd)
    // A and B can merge, B and C can merge, but merging B-C would bring
    // C(jtbd) into a cluster with A(jtbd)
    const candidates = [
      makeCandidate({ id: "A", lens: "jtbd", name: "A", description: "desc" }),
      makeCandidate({ id: "B", lens: "pains", name: "B", description: "desc" }),
      makeCandidate({ id: "C", lens: "jtbd", name: "C", description: "desc" }),
    ];
    const uf = new UnionFind(3);
    uf.union(0, 1); // A-B merged
    expect(canMerge(uf, 1, 2, candidates)).toBe(false); // B-C should fail
  });
});

describe("buildCluster", () => {
  it("computes lens count and unique lenses", () => {
    const candidates = [
      makeCandidate({ id: "1", lens: "jtbd", name: "A", description: "desc" }),
      makeCandidate({ id: "2", lens: "pains", name: "B", description: "desc" }),
      makeCandidate({ id: "3", lens: "gains", name: "C", description: "desc" }),
    ];
    const cluster = buildCluster("test-cluster", candidates);
    expect(cluster.cluster_id).toBe("test-cluster");
    expect(cluster.candidates).toHaveLength(3);
    expect(cluster.lens_count).toBe(3);
    expect(cluster.lenses).toContain("jtbd");
    expect(cluster.lenses).toContain("pains");
    expect(cluster.lenses).toContain("gains");
  });

  it("deduplicates lenses (should not happen but is safe)", () => {
    const candidates = [
      makeCandidate({ id: "1", lens: "jtbd", name: "A", description: "desc" }),
    ];
    const cluster = buildCluster("single", candidates);
    expect(cluster.lens_count).toBe(1);
    expect(cluster.lenses).toEqual(["jtbd"]);
  });
});

// --- Core clustering tests (acceptance criteria) ---

describe("clusterCandidatesCore", () => {
  it("accepts ValidatedCandidate[] and returns CandidateCluster[]", () => {
    const candidates = [
      makeCandidate({
        id: "1",
        lens: "jtbd",
        name: "Track sprint velocity",
        description: "Monitor team sprint velocity and burndown charts",
      }),
    ];
    const result = clusterCandidatesCore(candidates);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("cluster_id");
    expect(result[0]).toHaveProperty("candidates");
    expect(result[0]).toHaveProperty("lens_count");
    expect(result[0]).toHaveProperty("lenses");
  });

  it("groups candidates with high similarity into same cluster", () => {
    const candidates = [
      makeCandidate({
        id: "1",
        lens: "jtbd",
        name: "Track sprint velocity and burndown",
        description: "Monitor team sprint velocity metrics and burndown charts for agile teams",
      }),
      makeCandidate({
        id: "2",
        lens: "outcomes",
        name: "Monitor sprint velocity metrics",
        description: "Track team sprint velocity and burndown progress for agile workflow",
      }),
    ];
    const clusters = clusterCandidatesCore(candidates, 0.3); // Lower threshold for test reliability
    // With high overlap, these should be in the same cluster
    expect(clusters.length).toBe(1);
    expect(clusters[0].candidates).toHaveLength(2);
  });

  it("keeps dissimilar candidates in separate clusters", () => {
    const candidates = [
      makeCandidate({
        id: "1",
        lens: "jtbd",
        name: "Track sprint velocity",
        description: "Monitor agile team sprint velocity metrics and burndown charts",
      }),
      makeCandidate({
        id: "2",
        lens: "outcomes",
        name: "Manage billing invoices",
        description: "Handle customer billing subscription payment processing invoices",
      }),
    ];
    const clusters = clusterCandidatesCore(candidates);
    expect(clusters.length).toBe(2);
  });

  it("never places same-lens candidates in the same cluster", () => {
    // Two very similar candidates from the same lens
    const candidates = [
      makeCandidate({
        id: "1",
        lens: "jtbd",
        name: "Track sprint velocity",
        description: "Monitor team sprint velocity and burndown",
      }),
      makeCandidate({
        id: "2",
        lens: "jtbd",
        name: "Track sprint velocity metrics",
        description: "Monitor team sprint velocity and burndown charts",
      }),
    ];
    const clusters = clusterCandidatesCore(candidates);
    // Despite high similarity, they must be in separate clusters
    expect(clusters.length).toBe(2);
    for (const cluster of clusters) {
      const lenses = cluster.candidates.map((c) => c.lens);
      const uniqueLenses = new Set(lenses);
      expect(uniqueLenses.size).toBe(lenses.length);
    }
  });

  it("enforces same-lens constraint even when similarity is high across transitive chain", () => {
    // A(jtbd) similar to B(pains) similar to C(jtbd)
    // A and C should never end up in the same cluster
    const candidates = [
      makeCandidate({
        id: "A",
        lens: "jtbd",
        name: "Reduce deployment time through automation",
        description: "Automate CI/CD pipeline to reduce deployment duration time",
      }),
      makeCandidate({
        id: "B",
        lens: "pains",
        name: "Slow deployment time painful process",
        description: "Deployment process takes too long time causing pain delays",
      }),
      makeCandidate({
        id: "C",
        lens: "jtbd",
        name: "Accelerate deployment time with automation",
        description: "Speed up deployment time through automated CI/CD process",
      }),
    ];
    const clusters = clusterCandidatesCore(candidates, 0.3);

    // Verify no cluster has duplicate lenses
    for (const cluster of clusters) {
      const lenses = cluster.candidates.map((c) => c.lens);
      const uniqueLenses = new Set(lenses);
      expect(uniqueLenses.size).toBe(lenses.length);
    }
  });

  it("returns empty array for empty input", () => {
    expect(clusterCandidatesCore([])).toEqual([]);
  });

  it("uses DEFAULT_SIMILARITY_THRESHOLD of 0.7", () => {
    expect(DEFAULT_SIMILARITY_THRESHOLD).toBe(0.7);
  });
});

// --- Integration-style tests ---

describe("integration: multi-lens clustering", () => {
  it("clusters correctly identify multi-lens value moments", () => {
    // 5 candidates across 3 lenses, all describing the same value moment
    const candidates = [
      makeCandidate({
        id: "1",
        lens: "jtbd",
        name: "Reduce deployment time through CI/CD automation",
        description: "Automate deployment pipeline to reduce deployment time from hours to minutes",
      }),
      makeCandidate({
        id: "2",
        lens: "pains",
        name: "Slow deployment time causes release delays",
        description: "Manual deployment time process causes delays and release bottlenecks",
      }),
      makeCandidate({
        id: "3",
        lens: "outcomes",
        name: "Faster deployment time with automated pipeline",
        description: "Achieve faster deployment time through automated CI/CD deployment pipeline",
      }),
      makeCandidate({
        id: "4",
        lens: "gains",
        name: "Quick deployment time enables rapid iteration",
        description: "Fast deployment time enables teams to iterate and release more quickly",
      }),
      makeCandidate({
        id: "5",
        lens: "workflows",
        name: "Automated deployment time workflow streamlines releases",
        description: "Automated deployment time workflow reduces manual steps in release process",
      }),
    ];

    const clusters = clusterCandidatesCore(candidates, 0.3);

    // Find the largest cluster
    const sorted = [...clusters].sort((a, b) => b.candidates.length - a.candidates.length);
    const largest = sorted[0];

    // The largest cluster should have candidates from multiple lenses
    expect(largest.lens_count).toBeGreaterThanOrEqual(3);
    expect(largest.candidates.length).toBeGreaterThanOrEqual(3);

    // Verify no duplicate lenses in any cluster
    for (const cluster of clusters) {
      const lenses = cluster.candidates.map((c) => c.lens);
      expect(new Set(lenses).size).toBe(lenses.length);
    }
  });

  it("single-lens candidates remain as singleton clusters", () => {
    // One candidate from a unique lens that doesn't match anything
    const candidates = [
      makeCandidate({
        id: "1",
        lens: "jtbd",
        name: "Track sprint velocity and burndown",
        description: "Monitor agile team sprint velocity metrics",
      }),
      makeCandidate({
        id: "2",
        lens: "emotions",
        name: "Customer billing anxiety about pricing transparency",
        description: "Users feel anxiety about unclear billing pricing charges",
      }),
    ];

    const clusters = clusterCandidatesCore(candidates);

    // Both should be in their own cluster since they're unrelated
    expect(clusters.length).toBe(2);
    for (const cluster of clusters) {
      expect(cluster.candidates).toHaveLength(1);
      expect(cluster.lens_count).toBe(1);
    }
  });

  it("each cluster includes candidate IDs for traceability", () => {
    const candidates = [
      makeCandidate({
        id: "trace-1",
        lens: "jtbd",
        name: "Reduce deployment time automation",
        description: "Automate deployment pipeline to reduce deployment time",
      }),
      makeCandidate({
        id: "trace-2",
        lens: "pains",
        name: "Slow deployment time painful delays",
        description: "Manual deployment time process causes delays bottlenecks",
      }),
    ];

    const clusters = clusterCandidatesCore(candidates, 0.3);

    // Collect all candidate IDs across all clusters
    const allIds = clusters.flatMap((c) => c.candidates.map((cand) => cand.id));
    expect(allIds).toContain("trace-1");
    expect(allIds).toContain("trace-2");

    // Each candidate object should be fully present
    for (const cluster of clusters) {
      for (const candidate of cluster.candidates) {
        expect(candidate).toHaveProperty("id");
        expect(candidate).toHaveProperty("lens");
        expect(candidate).toHaveProperty("name");
        expect(candidate).toHaveProperty("description");
        expect(candidate).toHaveProperty("confidence");
        expect(candidate).toHaveProperty("validation_status");
      }
    }
  });

  it("handles a realistic set of 20 candidates without duplicate IDs in output", () => {
    const lenses: LensType[] = ["jtbd", "outcomes", "pains", "gains", "workflows"];
    const topics = [
      { name: "deployment automation", desc: "automated CI/CD deployment pipeline process" },
      { name: "team collaboration workspace", desc: "real-time team collaboration workspace tools" },
      { name: "customer billing management", desc: "customer billing subscription payment management" },
      { name: "sprint velocity tracking", desc: "agile sprint velocity burndown tracking metrics" },
    ];

    const candidates: ValidatedCandidate[] = [];
    let id = 0;
    for (const topic of topics) {
      for (const lens of lenses) {
        candidates.push(
          makeCandidate({
            id: `cand-${id++}`,
            lens,
            name: `${topic.name} ${lens}`,
            description: `${topic.desc} from ${lens} lens perspective`,
          })
        );
      }
    }

    const clusters = clusterCandidatesCore(candidates, 0.3);

    // All candidate IDs should appear exactly once
    const allIds = clusters.flatMap((c) => c.candidates.map((cand) => cand.id));
    expect(allIds).toHaveLength(20);
    expect(new Set(allIds).size).toBe(20);

    // No cluster should have duplicate lenses
    for (const cluster of clusters) {
      const lensesInCluster = cluster.candidates.map((c) => c.lens);
      expect(new Set(lensesInCluster).size).toBe(lensesInCluster.length);
    }
  });

  it("no cluster in any test output contains duplicate lenses", () => {
    // Broad test with diverse candidates
    const candidates = [
      makeCandidate({ id: "a1", lens: "jtbd", name: "project management tracking", description: "manage projects and track team progress" }),
      makeCandidate({ id: "a2", lens: "jtbd", name: "customer billing invoices", description: "handle customer billing and invoicing" }),
      makeCandidate({ id: "b1", lens: "pains", name: "project management pain", description: "struggling with project management tracking" }),
      makeCandidate({ id: "b2", lens: "pains", name: "billing confusion", description: "confusing billing process causes errors" }),
      makeCandidate({ id: "c1", lens: "outcomes", name: "project management success", description: "successful project management and tracking" }),
      makeCandidate({ id: "c2", lens: "outcomes", name: "billing clarity", description: "clear billing process reduces errors" }),
      makeCandidate({ id: "d1", lens: "gains", name: "project efficiency", description: "efficient project management tracking workflow" }),
      makeCandidate({ id: "d2", lens: "gains", name: "billing accuracy", description: "accurate billing reduces revenue leakage" }),
    ];

    const clusters = clusterCandidatesCore(candidates, 0.3);

    for (const cluster of clusters) {
      const lenses = cluster.candidates.map((c) => c.lens);
      const unique = new Set(lenses);
      expect(unique.size).toBe(lenses.length);
    }
  });
});

// --- LLM clustering tests ---

describe("CLUSTERING_SYSTEM_PROMPT", () => {
  it("includes same-lens constraint rule", () => {
    expect(CLUSTERING_SYSTEM_PROMPT).toContain("NEVER place two candidates from the SAME lens");
  });

  it("requests 15-30 clusters as target range", () => {
    expect(CLUSTERING_SYSTEM_PROMPT).toContain("15-30 clusters");
  });
});

describe("buildClusteringPrompt", () => {
  it("lists all candidates with IDs and lens labels", () => {
    const candidates = [
      makeCandidate({ id: "c1", lens: "jtbd", name: "Track tasks", description: "Manage workflow" }),
      makeCandidate({ id: "c2", lens: "pains", name: "Slow process", description: "Too many steps" }),
    ];
    const prompt = buildClusteringPrompt(candidates);
    expect(prompt).toContain("[c1]");
    expect(prompt).toContain("[c2]");
    expect(prompt).toContain("(jtbd)");
    expect(prompt).toContain("(pains)");
    expect(prompt).toContain("Track tasks");
    expect(prompt).toContain("Slow process");
    expect(prompt).toContain("2 candidates");
  });

  it("returns empty listing for empty candidates", () => {
    const prompt = buildClusteringPrompt([]);
    expect(prompt).toContain("0 candidates");
  });
});

describe("parseClusteringResponse", () => {
  const candidates = [
    makeCandidate({ id: "c1", lens: "jtbd", name: "A", description: "desc A" }),
    makeCandidate({ id: "c2", lens: "pains", name: "B", description: "desc B" }),
    makeCandidate({ id: "c3", lens: "outcomes", name: "C", description: "desc C" }),
    makeCandidate({ id: "c4", lens: "gains", name: "D", description: "desc D" }),
  ];

  it("parses JSON in code fences", () => {
    const response = '```json\n[{"label": "Group 1", "candidate_ids": ["c1", "c2"]}, {"label": "Group 2", "candidate_ids": ["c3", "c4"]}]\n```';
    const clusters = parseClusteringResponse(response, candidates);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].candidates.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(clusters[1].candidates.map((c) => c.id)).toEqual(["c3", "c4"]);
  });

  it("parses raw JSON without code fences", () => {
    const response = '[{"label": "Group 1", "candidate_ids": ["c1", "c3"]}, {"label": "Group 2", "candidate_ids": ["c2", "c4"]}]';
    const clusters = parseClusteringResponse(response, candidates);
    expect(clusters).toHaveLength(2);
  });

  it("repairs same-lens violations by ejecting duplicates as singletons", () => {
    // LLM puts two jtbd candidates in same cluster (shouldn't happen but handle it)
    const sameLensCandidates = [
      makeCandidate({ id: "s1", lens: "jtbd", name: "A", description: "desc" }),
      makeCandidate({ id: "s2", lens: "jtbd", name: "B", description: "desc" }),
      makeCandidate({ id: "s3", lens: "pains", name: "C", description: "desc" }),
    ];
    const response = '[{"label": "Bad cluster", "candidate_ids": ["s1", "s2", "s3"]}]';
    const clusters = parseClusteringResponse(response, sameLensCandidates);

    // Should split: s1+s3 in one cluster, s2 as singleton
    for (const cluster of clusters) {
      const lenses = cluster.candidates.map((c) => c.lens);
      expect(new Set(lenses).size).toBe(lenses.length);
    }
    // All candidates should still be present
    const allIds = clusters.flatMap((c) => c.candidates.map((cand) => cand.id));
    expect(allIds.sort()).toEqual(["s1", "s2", "s3"].sort());
  });

  it("adds orphaned candidates as singleton clusters", () => {
    // LLM only mentions c1 and c2, leaving c3 and c4 as orphans
    const response = '[{"label": "Only group", "candidate_ids": ["c1", "c2"]}]';
    const clusters = parseClusteringResponse(response, candidates);

    const allIds = clusters.flatMap((c) => c.candidates.map((cand) => cand.id));
    expect(allIds.sort()).toEqual(["c1", "c2", "c3", "c4"].sort());
    // c3 and c4 should each be in their own cluster
    const orphanClusters = clusters.filter((c) =>
      c.candidates.some((cand) => cand.id === "c3" || cand.id === "c4")
    );
    expect(orphanClusters).toHaveLength(2);
    for (const oc of orphanClusters) {
      expect(oc.candidates).toHaveLength(1);
    }
  });

  it("ignores unknown candidate IDs from LLM response", () => {
    const response = '[{"label": "Group", "candidate_ids": ["c1", "unknown-id", "c2"]}]';
    const clusters = parseClusteringResponse(response, candidates);
    const mainCluster = clusters.find((c) =>
      c.candidates.some((cand) => cand.id === "c1")
    )!;
    expect(mainCluster.candidates.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("throws on non-array response", () => {
    expect(() =>
      parseClusteringResponse('{"not": "an array"}', candidates)
    ).toThrow("Expected array of clusters");
  });

  it("skips empty clusters from LLM", () => {
    const response = '[{"label": "Empty", "candidate_ids": []}, {"label": "Real", "candidate_ids": ["c1"]}]';
    const clusters = parseClusteringResponse(response, candidates);
    // Empty cluster should be skipped, orphans added
    const allIds = clusters.flatMap((c) => c.candidates.map((cand) => cand.id));
    expect(allIds.sort()).toEqual(["c1", "c2", "c3", "c4"].sort());
  });

  it("assigns sequential cluster IDs", () => {
    const response = '[{"label": "A", "candidate_ids": ["c1"]}, {"label": "B", "candidate_ids": ["c2"]}]';
    const clusters = parseClusteringResponse(response, candidates);
    expect(clusters[0].cluster_id).toBe("cluster-0");
    expect(clusters[1].cluster_id).toBe("cluster-1");
  });

  it("no cluster contains two candidates from the same lens", () => {
    // Comprehensive check: LLM tries to put multiple same-lens candidates together
    const mixedCandidates = [
      makeCandidate({ id: "x1", lens: "jtbd", name: "A", description: "desc" }),
      makeCandidate({ id: "x2", lens: "jtbd", name: "B", description: "desc" }),
      makeCandidate({ id: "x3", lens: "pains", name: "C", description: "desc" }),
      makeCandidate({ id: "x4", lens: "pains", name: "D", description: "desc" }),
      makeCandidate({ id: "x5", lens: "outcomes", name: "E", description: "desc" }),
    ];
    const response = '[{"label": "All", "candidate_ids": ["x1", "x2", "x3", "x4", "x5"]}]';
    const clusters = parseClusteringResponse(response, mixedCandidates);

    for (const cluster of clusters) {
      const lenses = cluster.candidates.map((c) => c.lens);
      expect(new Set(lenses).size).toBe(lenses.length);
    }
    // All candidates preserved
    const allIds = clusters.flatMap((c) => c.candidates.map((cand) => cand.id));
    expect(allIds.sort()).toEqual(["x1", "x2", "x3", "x4", "x5"].sort());
  });

  it("prevents duplicate assignment when LLM lists same ID in multiple clusters", () => {
    const response = '[{"label": "A", "candidate_ids": ["c1", "c2"]}, {"label": "B", "candidate_ids": ["c1", "c3"]}]';
    const clusters = parseClusteringResponse(response, candidates);
    // c1 should only appear once (first assignment wins)
    const allIds = clusters.flatMap((c) => c.candidates.map((cand) => cand.id));
    const idCounts = allIds.reduce((acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    expect(idCounts["c1"]).toBe(1);
  });
});
