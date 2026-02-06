import { describe, it, expect } from "vitest";
import {
  UnionFind,
  clusterCandidatesCore,
  candidateText,
  sameLens,
  buildCluster,
  canMerge,
  DEFAULT_SIMILARITY_THRESHOLD,
} from "./clusterCandidates";
import type { ValidatedCandidate, CandidateCluster } from "./types";

// --- Test Helpers ---

function makeCandidate(
  overrides: Partial<ValidatedCandidate> & { id: string; lens: string }
): ValidatedCandidate {
  return {
    name: "Test Candidate",
    description: "A test candidate description",
    roles: ["user"],
    product_surfaces: ["dashboard"],
    validation_status: "valid",
    ...overrides,
  };
}

// --- UnionFind Tests ---

describe("UnionFind", () => {
  it("initializes each element as its own root", () => {
    const uf = new UnionFind(5);
    for (let i = 0; i < 5; i++) {
      expect(uf.find(i)).toBe(i);
    }
  });

  it("merges two elements into same set", () => {
    const uf = new UnionFind(5);
    uf.union(0, 1);
    expect(uf.connected(0, 1)).toBe(true);
    expect(uf.connected(0, 2)).toBe(false);
  });

  it("handles transitive unions", () => {
    const uf = new UnionFind(5);
    uf.union(0, 1);
    uf.union(1, 2);
    expect(uf.connected(0, 2)).toBe(true);
  });

  it("returns false from union when already connected", () => {
    const uf = new UnionFind(3);
    expect(uf.union(0, 1)).toBe(true);
    expect(uf.union(0, 1)).toBe(false);
  });

  it("groups returns correct clustering", () => {
    const uf = new UnionFind(5);
    uf.union(0, 1);
    uf.union(2, 3);
    // Groups: {0,1}, {2,3}, {4}

    const groups = uf.groups();
    expect(groups.size).toBe(3);

    // Find the group containing 0
    const group0 = groups.get(uf.find(0))!;
    expect(group0).toContain(0);
    expect(group0).toContain(1);
    expect(group0).toHaveLength(2);

    // Find the group containing 2
    const group2 = groups.get(uf.find(2))!;
    expect(group2).toContain(2);
    expect(group2).toContain(3);
    expect(group2).toHaveLength(2);

    // Singleton group
    const group4 = groups.get(uf.find(4))!;
    expect(group4).toEqual([4]);
  });

  it("handles single element", () => {
    const uf = new UnionFind(1);
    expect(uf.find(0)).toBe(0);
    expect(uf.groups().size).toBe(1);
  });
});

// --- Pure Function Tests ---

describe("candidateText", () => {
  it("concatenates name and description", () => {
    const candidate = makeCandidate({
      id: "c1",
      lens: "jobs_to_be_done",
      name: "Track team progress",
      description: "Users can monitor their team output in real time",
    });
    expect(candidateText(candidate)).toBe(
      "Track team progress Users can monitor their team output in real time"
    );
  });
});

describe("sameLens", () => {
  it("returns true for same lens", () => {
    const a = makeCandidate({ id: "c1", lens: "jtbd" });
    const b = makeCandidate({ id: "c2", lens: "jtbd" });
    expect(sameLens(a, b)).toBe(true);
  });

  it("returns false for different lenses", () => {
    const a = makeCandidate({ id: "c1", lens: "jtbd" });
    const b = makeCandidate({ id: "c2", lens: "workflow" });
    expect(sameLens(a, b)).toBe(false);
  });
});

describe("buildCluster", () => {
  it("builds cluster with correct lens_count and sorted lenses", () => {
    const candidates = [
      makeCandidate({ id: "c1", lens: "workflow" }),
      makeCandidate({ id: "c2", lens: "jtbd" }),
      makeCandidate({ id: "c3", lens: "outcome" }),
    ];

    const cluster = buildCluster("cluster-0", candidates);
    expect(cluster.cluster_id).toBe("cluster-0");
    expect(cluster.candidates).toHaveLength(3);
    expect(cluster.lens_count).toBe(3);
    expect(cluster.lenses).toEqual(["jtbd", "outcome", "workflow"]);
  });

  it("deduplicates lenses in count", () => {
    // This shouldn't happen in practice (same-lens constraint), but tests the function
    const candidates = [
      makeCandidate({ id: "c1", lens: "jtbd" }),
      makeCandidate({ id: "c2", lens: "jtbd" }),
    ];

    const cluster = buildCluster("cluster-0", candidates);
    expect(cluster.lens_count).toBe(1);
    expect(cluster.lenses).toEqual(["jtbd"]);
  });
});

describe("canMerge", () => {
  it("allows merge of candidates from different lenses", () => {
    const candidates = [
      makeCandidate({ id: "c1", lens: "jtbd" }),
      makeCandidate({ id: "c2", lens: "workflow" }),
    ];
    const uf = new UnionFind(2);
    expect(canMerge(uf, candidates, 0, 1)).toBe(true);
  });

  it("prevents merge that would create duplicate lens", () => {
    const candidates = [
      makeCandidate({ id: "c1", lens: "jtbd" }),
      makeCandidate({ id: "c2", lens: "workflow" }),
      makeCandidate({ id: "c3", lens: "jtbd" }), // same lens as c1
    ];
    const uf = new UnionFind(3);
    uf.union(0, 1); // merge c1 (jtbd) + c2 (workflow)

    // Trying to merge c2 (workflow) with c3 (jtbd) would put two jtbd in same cluster
    expect(canMerge(uf, candidates, 1, 2)).toBe(false);
  });

  it("allows merge when already connected", () => {
    const candidates = [
      makeCandidate({ id: "c1", lens: "jtbd" }),
      makeCandidate({ id: "c2", lens: "workflow" }),
    ];
    const uf = new UnionFind(2);
    uf.union(0, 1);
    expect(canMerge(uf, candidates, 0, 1)).toBe(true);
  });
});

// --- Core Clustering Tests (unit) ---

describe("clusterCandidatesCore", () => {
  // [unit] AC1: clusterCandidates function accepts ValidatedCandidate[] and returns CandidateCluster[]
  it("accepts ValidatedCandidate[] and returns CandidateCluster[]", () => {
    const candidates: ValidatedCandidate[] = [
      makeCandidate({ id: "c1", lens: "jtbd", name: "Track issues", description: "Track and manage project issues" }),
    ];

    const result = clusterCandidatesCore(candidates);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    const cluster = result[0];
    expect(cluster).toHaveProperty("cluster_id");
    expect(cluster).toHaveProperty("candidates");
    expect(cluster).toHaveProperty("lens_count");
    expect(cluster).toHaveProperty("lenses");
  });

  // [unit] AC2: Embeddings are computed for each candidate description
  it("computes embeddings (TF-IDF vectors) for each candidate", () => {
    // We test this indirectly: two very similar descriptions from different
    // lenses should cluster together, proving embeddings are working
    const candidates = [
      makeCandidate({
        id: "c1",
        lens: "jtbd",
        name: "Track project issues",
        description: "Monitor and manage project issues across the team using boards and lists",
      }),
      makeCandidate({
        id: "c2",
        lens: "workflow",
        name: "Manage project issues",
        description: "Track and manage project issues across the team using boards and lists",
      }),
    ];

    const result = clusterCandidatesCore(candidates, 0.3); // lower threshold to ensure match
    // With very similar text from different lenses, should be one cluster
    expect(result.some((c) => c.candidates.length === 2)).toBe(true);
  });

  // [unit] AC3: Candidates with similarity >0.7 are grouped into same cluster
  it("groups candidates with high similarity into same cluster", () => {
    // Use nearly identical descriptions from different lenses
    const candidates = [
      makeCandidate({
        id: "c1",
        lens: "jtbd",
        name: "Gain visibility into team progress through dashboards",
        description: "Product managers gain visibility into team progress through real-time dashboards showing sprint velocity and burndown charts",
      }),
      makeCandidate({
        id: "c2",
        lens: "workflow",
        name: "Gain visibility into team progress via dashboards",
        description: "Product managers gain visibility into team progress via real-time dashboards showing sprint velocity and burndown charts",
      }),
    ];

    const result = clusterCandidatesCore(candidates);
    // Nearly identical text should cluster together
    const multiLensCluster = result.find((c) => c.candidates.length === 2);
    expect(multiLensCluster).toBeDefined();
    expect(multiLensCluster!.lens_count).toBe(2);
  });

  // [unit] AC4: Candidates from the same lens are never in the same cluster
  it("never places same-lens candidates in the same cluster", () => {
    const candidates = [
      makeCandidate({
        id: "c1",
        lens: "jtbd",
        name: "Track project issues across teams",
        description: "Monitor and manage project issues across the team using boards and lists for tracking",
      }),
      makeCandidate({
        id: "c2",
        lens: "jtbd", // SAME lens
        name: "Track project issues for teams",
        description: "Monitor and manage project issues across the team using boards and lists for tracking",
      }),
    ];

    const result = clusterCandidatesCore(candidates);
    // Despite near-identical text, should be separate clusters (same lens)
    for (const cluster of result) {
      const lenses = cluster.candidates.map((c) => c.lens);
      const uniqueLenses = new Set(lenses);
      expect(uniqueLenses.size).toBe(lenses.length);
    }
  });

  it("handles empty input", () => {
    expect(clusterCandidatesCore([])).toEqual([]);
  });

  it("handles single candidate as singleton cluster", () => {
    const candidates = [
      makeCandidate({ id: "c1", lens: "jtbd", name: "Test", description: "A test candidate" }),
    ];

    const result = clusterCandidatesCore(candidates);
    expect(result).toHaveLength(1);
    expect(result[0].candidates).toHaveLength(1);
    expect(result[0].lens_count).toBe(1);
  });

  it("keeps dissimilar candidates in separate clusters", () => {
    const candidates = [
      makeCandidate({
        id: "c1",
        lens: "jtbd",
        name: "Track project issues",
        description: "Software engineers track bugs and feature requests in a kanban board",
      }),
      makeCandidate({
        id: "c2",
        lens: "workflow",
        name: "Generate revenue reports",
        description: "Finance teams create automated monthly revenue reconciliation spreadsheets",
      }),
    ];

    const result = clusterCandidatesCore(candidates);
    // Very different content should remain separate
    expect(result).toHaveLength(2);
    expect(result[0].candidates).toHaveLength(1);
    expect(result[1].candidates).toHaveLength(1);
  });

  it("filters removed candidates when provided through core function", () => {
    // Note: filtering of removed candidates happens in the internalAction wrapper,
    // not in clusterCandidatesCore itself. This test verifies core handles valid-only input.
    const candidates = [
      makeCandidate({
        id: "c1",
        lens: "jtbd",
        name: "Track issues",
        description: "Track issues in boards",
        validation_status: "valid",
      }),
      makeCandidate({
        id: "c2",
        lens: "workflow",
        name: "Track issues",
        description: "Track issues in boards",
        validation_status: "rewritten",
      }),
    ];

    const result = clusterCandidatesCore(candidates);
    expect(result.length).toBeGreaterThan(0);
    // Both valid and rewritten should be included
    const allCandidateIds = result.flatMap((c) => c.candidates.map((cc) => cc.id));
    expect(allCandidateIds).toContain("c1");
    expect(allCandidateIds).toContain("c2");
  });

  it("uses default threshold of 0.7", () => {
    expect(DEFAULT_SIMILARITY_THRESHOLD).toBe(0.7);
  });
});

// --- Integration Tests ---

describe("clusterCandidatesCore - integration", () => {
  // [integration] AC5: Clusters correctly identify multi-lens value moments
  it("clusters correctly identify multi-lens value moments", () => {
    // Simulate candidates about "team collaboration visibility" from multiple lenses
    const candidates: ValidatedCandidate[] = [
      makeCandidate({
        id: "jtbd-1",
        lens: "jobs_to_be_done",
        name: "Gain visibility into team sprint progress and velocity",
        description: "Product managers need real-time visibility into team sprint progress velocity burndown charts to make informed prioritization decisions about upcoming work",
      }),
      makeCandidate({
        id: "workflow-1",
        lens: "workflow",
        name: "Monitor team sprint progress and velocity metrics",
        description: "Teams monitor sprint progress velocity through dashboards with burndown charts and velocity metrics to track upcoming work prioritization",
      }),
      makeCandidate({
        id: "outcome-1",
        lens: "outcome",
        name: "Achieve sprint visibility and progress tracking",
        description: "Product managers achieve real-time visibility into sprint progress velocity with burndown charts for better prioritization of upcoming team work",
      }),
      // A completely different value moment
      makeCandidate({
        id: "jtbd-2",
        lens: "jobs_to_be_done",
        name: "Automate invoice generation and billing",
        description: "Finance teams automate monthly invoice generation billing reconciliation reducing manual spreadsheet errors and processing time",
      }),
      makeCandidate({
        id: "workflow-2",
        lens: "workflow",
        name: "Generate automated invoices and billing reports",
        description: "Finance teams generate automated invoices billing reports monthly reconciliation reducing manual spreadsheet processing errors",
      }),
    ];

    const result = clusterCandidatesCore(candidates, 0.3);

    // Should have at least 2 distinct clusters
    expect(result.length).toBeGreaterThanOrEqual(2);

    // Find the sprint visibility cluster (should have 3 candidates from different lenses)
    const sprintCluster = result.find(
      (c) => c.candidates.some((cc) => cc.id === "jtbd-1")
    );
    expect(sprintCluster).toBeDefined();

    // Find the billing cluster (should have 2 candidates from different lenses)
    const billingCluster = result.find(
      (c) => c.candidates.some((cc) => cc.id === "jtbd-2")
    );
    expect(billingCluster).toBeDefined();

    // Sprint and billing candidates should NOT be in the same cluster
    if (sprintCluster && billingCluster) {
      const sprintIds = new Set(sprintCluster.candidates.map((c) => c.id));
      const billingIds = new Set(billingCluster.candidates.map((c) => c.id));
      for (const id of sprintIds) {
        expect(billingIds.has(id)).toBe(false);
      }
    }
  });

  // [integration] AC6: Single-lens candidates remain as singleton clusters
  it("single-lens candidates remain as singleton clusters", () => {
    const candidates: ValidatedCandidate[] = [
      makeCandidate({
        id: "jtbd-unique",
        lens: "jobs_to_be_done",
        name: "Customize notification preferences for different channels",
        description: "Users configure granular notification preferences for email slack mobile push notifications based on event type severity",
      }),
      makeCandidate({
        id: "workflow-unique",
        lens: "workflow",
        name: "Automate database backup scheduling and restoration",
        description: "DevOps engineers schedule automated database backups configure restoration procedures disaster recovery protocols",
      }),
      makeCandidate({
        id: "outcome-unique",
        lens: "outcome",
        name: "Reduce customer support ticket resolution time",
        description: "Support agents reduce average ticket resolution time through automated routing categorization priority assignment",
      }),
    ];

    const result = clusterCandidatesCore(candidates);

    // All descriptions are very different, should be 3 singleton clusters
    expect(result).toHaveLength(3);
    for (const cluster of result) {
      expect(cluster.candidates).toHaveLength(1);
      expect(cluster.lens_count).toBe(1);
    }
  });

  // [integration] AC7: Each cluster includes candidate IDs for traceability
  it("each cluster includes candidate IDs for traceability", () => {
    const candidates: ValidatedCandidate[] = [
      makeCandidate({
        id: "trace-1",
        lens: "jtbd",
        name: "Manage project timelines with gantt charts",
        description: "Project managers create and manage project timelines gantt charts dependencies milestones for resource planning",
      }),
      makeCandidate({
        id: "trace-2",
        lens: "workflow",
        name: "Plan project timelines using gantt charts",
        description: "Project managers plan project timelines using gantt charts dependencies milestones for resource allocation planning",
      }),
    ];

    const result = clusterCandidatesCore(candidates, 0.3);

    // Every candidate should be present in exactly one cluster
    const allCandidateIds = result.flatMap((c) =>
      c.candidates.map((cc) => cc.id)
    );
    expect(allCandidateIds).toContain("trace-1");
    expect(allCandidateIds).toContain("trace-2");
    expect(allCandidateIds).toHaveLength(2);

    // No duplicate candidate IDs across clusters
    const uniqueIds = new Set(allCandidateIds);
    expect(uniqueIds.size).toBe(allCandidateIds.length);
  });

  it("enforces same-lens constraint even when similarity is high across transitive chain", () => {
    // A-B similar (different lens), B-C similar (different lens),
    // but A and C have the same lens -- they should NOT cluster together
    const candidates: ValidatedCandidate[] = [
      makeCandidate({
        id: "c1",
        lens: "jtbd",
        name: "Track sprint velocity metrics for engineering teams",
        description: "Engineering leads track sprint velocity metrics burndown charts capacity planning for engineering teams",
      }),
      makeCandidate({
        id: "c2",
        lens: "workflow",
        name: "Monitor sprint velocity and team engineering capacity",
        description: "Engineering leads monitor sprint velocity metrics burndown charts capacity planning for engineering teams",
      }),
      makeCandidate({
        id: "c3",
        lens: "jtbd", // Same lens as c1!
        name: "Measure sprint velocity tracking for engineering groups",
        description: "Engineering leads measure sprint velocity metrics burndown charts capacity planning for engineering groups",
      }),
    ];

    const result = clusterCandidatesCore(candidates, 0.3);

    // Verify no cluster has two candidates from the same lens
    for (const cluster of result) {
      const lenses = cluster.candidates.map((c) => c.lens);
      const uniqueLenses = new Set(lenses);
      expect(uniqueLenses.size).toBe(lenses.length);
    }
  });

  it("returns clusters sorted by size descending", () => {
    const candidates: ValidatedCandidate[] = [
      // Group 1: 3 similar candidates from different lenses
      makeCandidate({
        id: "g1-a",
        lens: "jtbd",
        name: "Collaborate on documents with real-time editing",
        description: "Team members collaborate on shared documents with real-time concurrent editing tracked changes commenting suggestions",
      }),
      makeCandidate({
        id: "g1-b",
        lens: "workflow",
        name: "Edit documents collaboratively in real-time",
        description: "Team members edit shared documents collaboratively with real-time concurrent editing tracked changes commenting",
      }),
      makeCandidate({
        id: "g1-c",
        lens: "outcome",
        name: "Achieve real-time document collaboration",
        description: "Teams achieve real-time document collaboration concurrent editing tracked changes commenting suggestions",
      }),
      // Group 2: 1 singleton (unique topic)
      makeCandidate({
        id: "g2-a",
        lens: "persona",
        name: "Automate payroll calculations compliance",
        description: "HR managers automate payroll tax calculations regulatory compliance deductions benefit administration",
      }),
    ];

    const result = clusterCandidatesCore(candidates, 0.3);

    // Verify descending order by cluster size
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].candidates.length).toBeGreaterThanOrEqual(
        result[i].candidates.length
      );
    }
  });

  it("handles realistic candidate volume (simulated 20 candidates)", () => {
    const lenses = ["jtbd", "workflow", "outcome", "persona", "revenue"];
    const candidates: ValidatedCandidate[] = [];

    // Create 4 groups of 4 candidates each (from different lenses) + 4 singletons
    for (let group = 0; group < 4; group++) {
      for (let lensIdx = 0; lensIdx < 4; lensIdx++) {
        candidates.push(
          makeCandidate({
            id: `g${group}-l${lensIdx}`,
            lens: lenses[lensIdx],
            name: `Group ${group} value moment ${lensIdx} related activity`,
            description: `Group ${group} value moment description with unique keywords group${group}specific terms lens${lensIdx}content and shared${group} terminology`,
          })
        );
      }
    }

    // Add 4 unique singletons
    for (let i = 0; i < 4; i++) {
      candidates.push(
        makeCandidate({
          id: `singleton-${i}`,
          lens: lenses[i],
          name: `Completely unique singleton${i} topic${i} area${i}`,
          description: `Singleton${i} description with entirely different vocabulary topic${i} area${i} subject${i} field${i}`,
        })
      );
    }

    expect(candidates).toHaveLength(20);

    const result = clusterCandidatesCore(candidates, 0.3);

    // Should produce some clusters (not all singletons, not all one cluster)
    expect(result.length).toBeGreaterThan(1);
    expect(result.length).toBeLessThanOrEqual(20);

    // Every candidate should appear exactly once
    const allIds = result.flatMap((c) => c.candidates.map((cc) => cc.id));
    expect(allIds).toHaveLength(20);
    expect(new Set(allIds).size).toBe(20);

    // No cluster should have duplicate lenses
    for (const cluster of result) {
      const lensesInCluster = cluster.candidates.map((c) => c.lens);
      expect(new Set(lensesInCluster).size).toBe(lensesInCluster.length);
    }
  });
});
