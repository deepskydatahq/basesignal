import { describe, it, expect } from "vitest";
import type {
  ExperientialLensType,
  ValidationStatus,
  ValidatedCandidate,
  CandidateCluster,
  ValueMomentTier,
  ValueMoment,
  QualityStatus,
  QualityCheck,
  QualityReport,
  ConvergenceResult,
} from "../convergence";

describe("ExperientialLensType", () => {
  it("includes all 7 experiential lens types", () => {
    const allTypes: ExperientialLensType[] = [
      "jtbd",
      "outcomes",
      "pains",
      "gains",
      "alternatives",
      "workflows",
      "emotions",
    ];
    expect(allTypes).toHaveLength(7);
  });
});

describe("ValidationStatus", () => {
  it("includes valid, rewritten, removed", () => {
    const statuses: ValidationStatus[] = ["valid", "rewritten", "removed"];
    expect(statuses).toHaveLength(3);
  });
});

describe("ValidatedCandidate", () => {
  it("has all required fields", () => {
    const candidate: ValidatedCandidate = {
      id: "vc-001",
      lens: "jtbd",
      name: "Track team velocity",
      description: "Users can track team velocity across sprints",
      confidence: 0.85,
      validation_status: "valid",
    };
    expect(candidate.id).toBe("vc-001");
    expect(candidate.lens).toBe("jtbd");
    expect(candidate.confidence).toBe(0.85);
    expect(candidate.validation_status).toBe("valid");
  });

  it("supports optional validation_issue", () => {
    const candidate: ValidatedCandidate = {
      id: "vc-002",
      lens: "pains",
      name: "Use the dashboard",
      description: "Use the dashboard to view metrics",
      confidence: 0.5,
      validation_status: "removed",
      validation_issue: "feature-as-value: starts with 'Use the'",
    };
    expect(candidate.validation_issue).toContain("feature-as-value");
  });

  it("supports optional rewritten_from", () => {
    const candidate: ValidatedCandidate = {
      id: "vc-003",
      lens: "outcomes",
      name: "Gain visibility into team bottlenecks",
      description: "Teams identify blockers before they delay sprints",
      confidence: 0.9,
      validation_status: "rewritten",
      rewritten_from: {
        name: "Better visibility",
        description: "Provides better visibility into team performance",
      },
    };
    expect(candidate.rewritten_from?.name).toBe("Better visibility");
  });
});

describe("CandidateCluster", () => {
  it("groups candidates by cluster", () => {
    const cluster: CandidateCluster = {
      cluster_id: "cluster-1",
      candidates: [
        {
          id: "vc-001",
          lens: "jtbd",
          name: "Test",
          description: "Test",
          confidence: 0.8,
          validation_status: "valid",
        },
      ],
      lens_count: 1,
      lenses: ["jtbd"],
    };
    expect(cluster.cluster_id).toBe("cluster-1");
    expect(cluster.candidates).toHaveLength(1);
    expect(cluster.lens_count).toBe(1);
  });
});

describe("ValueMomentTier", () => {
  it("includes tiers 1, 2, 3", () => {
    const tiers: ValueMomentTier[] = [1, 2, 3];
    expect(tiers).toHaveLength(3);
  });
});

describe("ValueMoment", () => {
  it("has all required fields", () => {
    const moment: ValueMoment = {
      id: "vm-001",
      name: "Achieve deployment confidence",
      description: "Teams deploy with confidence",
      tier: 1,
      lenses: ["jtbd", "outcomes", "pains"],
      lens_count: 3,
      roles: ["DevOps Engineer", "Developer"],
      product_surfaces: ["CI/CD Pipeline"],
      contributing_candidates: ["c-001", "c-003", "c-007"],
    };
    expect(moment.id).toBe("vm-001");
    expect(moment.tier).toBe(1);
    expect(moment.lenses).toHaveLength(3);
    expect(moment.roles).toHaveLength(2);
  });
});

describe("QualityReport", () => {
  it("has overall status and checks", () => {
    const check: QualityCheck = {
      name: "minimum_moments",
      status: "pass",
      message: "At least 3 value moments found",
    };
    const report: QualityReport = {
      overall: "pass",
      checks: [check],
    };
    expect(report.overall).toBe("pass");
    expect(report.checks).toHaveLength(1);
  });

  it("supports all quality statuses", () => {
    const statuses: QualityStatus[] = ["pass", "warn", "fail"];
    expect(statuses).toHaveLength(3);
  });
});

describe("ConvergenceResult", () => {
  it("has value_moments, clusters, stats, and optional quality", () => {
    const result: ConvergenceResult = {
      value_moments: [
        {
          id: "vm-001",
          name: "Deploy with confidence",
          description: "Teams deploy with confidence",
          tier: 1,
          lenses: ["jtbd", "outcomes"],
          lens_count: 2,
          roles: ["DevOps"],
          product_surfaces: ["CI/CD"],
          contributing_candidates: ["c-1", "c-2"],
        },
      ],
      clusters: [
        {
          cluster_id: "cluster-1",
          candidates: [],
          lens_count: 2,
          lenses: ["jtbd", "outcomes"],
        },
      ],
      stats: {
        total_candidates: 20,
        total_clusters: 5,
        total_moments: 3,
        tier_1_count: 1,
        tier_2_count: 1,
        tier_3_count: 1,
      },
      quality: {
        overall: "pass",
        checks: [{ name: "test", status: "pass", message: "All good" }],
      },
    };
    expect(result.value_moments).toHaveLength(1);
    expect(result.clusters).toHaveLength(1);
    expect(result.stats.total_candidates).toBe(20);
    expect(result.stats.tier_1_count).toBe(1);
    expect(result.quality?.overall).toBe("pass");
  });

  it("works without optional quality field", () => {
    const result: ConvergenceResult = {
      value_moments: [],
      clusters: [],
      stats: {
        total_candidates: 0,
        total_clusters: 0,
        total_moments: 0,
        tier_1_count: 0,
        tier_2_count: 0,
        tier_3_count: 0,
      },
    };
    expect(result.quality).toBeUndefined();
  });
});
