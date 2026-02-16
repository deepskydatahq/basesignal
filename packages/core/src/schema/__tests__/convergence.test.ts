import { describe, it, expect } from "vitest";
import {
  ValidatedCandidateSchema,
  ValueMomentSchema,
  ConvergenceResultSchema,
  CandidateClusterSchema,
} from "../convergence";

const validCandidate = {
  id: "vc-1",
  lens: "jtbd" as const,
  name: "Task completion",
  description: "Complete a task efficiently",
  confidence: 0.85,
  validation_status: "valid" as const,
};

const validValueMoment = {
  id: "vm-1",
  name: "Efficient task completion",
  description: "Users complete tasks faster",
  tier: 1 as const,
  lenses: ["jtbd" as const, "outcomes" as const],
  lens_count: 2,
  roles: ["Manager"],
  product_surfaces: ["Dashboard"],
  contributing_candidates: ["vc-1"],
};

const validCluster = {
  cluster_id: "cl-1",
  candidates: [validCandidate],
  lens_count: 1,
  lenses: ["jtbd" as const],
};

const validStats = {
  total_candidates: 10,
  total_clusters: 3,
  total_moments: 5,
  tier_1_count: 2,
  tier_2_count: 2,
  tier_3_count: 1,
};

describe("ValidatedCandidateSchema", () => {
  it("accepts candidate with validation_status 'valid'", () => {
    expect(ValidatedCandidateSchema.safeParse(validCandidate).success).toBe(true);
  });

  it("accepts candidate with rewritten_from", () => {
    const data = {
      ...validCandidate,
      validation_status: "rewritten" as const,
      rewritten_from: { name: "Old name", description: "Old description" },
    };
    expect(ValidatedCandidateSchema.safeParse(data).success).toBe(true);
  });
});

describe("ValueMomentSchema", () => {
  it.each([1, 2, 3] as const)("accepts tier %d", (tier) => {
    expect(ValueMomentSchema.safeParse({ ...validValueMoment, tier }).success).toBe(true);
  });

  it("rejects invalid tier (4)", () => {
    expect(ValueMomentSchema.safeParse({ ...validValueMoment, tier: 4 }).success).toBe(false);
  });
});

describe("CandidateClusterSchema", () => {
  it("accepts valid cluster", () => {
    expect(CandidateClusterSchema.safeParse(validCluster).success).toBe(true);
  });
});

describe("ConvergenceResultSchema", () => {
  it("accepts result with stats", () => {
    const data = {
      value_moments: [validValueMoment],
      clusters: [validCluster],
      stats: validStats,
    };
    expect(ConvergenceResultSchema.safeParse(data).success).toBe(true);
  });

  it("accepts result with optional quality absent", () => {
    const data = {
      value_moments: [],
      clusters: [],
      stats: validStats,
    };
    expect(ConvergenceResultSchema.safeParse(data).success).toBe(true);
  });

  it("accepts result with quality report", () => {
    const data = {
      value_moments: [],
      clusters: [],
      stats: validStats,
      quality: {
        overall: "pass" as const,
        checks: [{ name: "coverage", status: "pass" as const, message: "Good coverage" }],
      },
    };
    expect(ConvergenceResultSchema.safeParse(data).success).toBe(true);
  });
});
