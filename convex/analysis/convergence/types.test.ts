import { describe, it, expect } from "vitest";
import type {
  ValueMomentTier,
  ValidationStatus,
  ValidatedCandidate,
  ValueMoment,
  ConvergenceResult,
} from "./types";

describe("ValueMomentTier", () => {
  it("includes tiers 1, 2, 3", () => {
    const tiers: ValueMomentTier[] = [1, 2, 3];
    expect(tiers).toHaveLength(3);
    expect(tiers).toContain(1);
    expect(tiers).toContain(2);
    expect(tiers).toContain(3);
  });
});

describe("ValidationStatus", () => {
  it("includes valid, rewritten, removed", () => {
    const statuses: ValidationStatus[] = ["valid", "rewritten", "removed"];
    expect(statuses).toHaveLength(3);
    expect(statuses).toContain("valid");
    expect(statuses).toContain("rewritten");
    expect(statuses).toContain("removed");
  });
});

describe("ValidatedCandidate", () => {
  it("extends LensCandidate with validation_status", () => {
    const candidate: ValidatedCandidate = {
      id: "vc-001",
      lens: "capability_mapping",
      name: "Track team velocity",
      description: "Users can track team velocity across sprints",
      role: "Engineering Manager",
      confidence: "high",
      source_urls: ["https://example.com"],
      validation_status: "valid",
    };
    expect(candidate.validation_status).toBe("valid");
    expect(candidate.id).toBe("vc-001");
    expect(candidate.lens).toBe("capability_mapping");
    expect(candidate.name).toBe("Track team velocity");
  });

  it("supports optional validation_issue for flagged candidates", () => {
    const removed: ValidatedCandidate = {
      id: "vc-002",
      lens: "effort_elimination",
      name: "Use the dashboard",
      description: "Use the dashboard to view metrics",
      role: "User",
      confidence: "medium",
      source_urls: [],
      validation_status: "removed",
      validation_issue: "feature-as-value: starts with 'Use the'",
    };
    expect(removed.validation_status).toBe("removed");
    expect(removed.validation_issue).toBe("feature-as-value: starts with 'Use the'");
  });

  it("supports optional rewritten_from for rewritten candidates", () => {
    const rewritten: ValidatedCandidate = {
      id: "vc-003",
      lens: "info_asymmetry",
      name: "Gain visibility into team bottlenecks",
      description: "Teams identify blockers before they delay sprints",
      role: "Tech Lead",
      confidence: "high",
      source_urls: ["https://example.com"],
      validation_status: "rewritten",
      validation_issue: "vague: contained 'better visibility'",
      rewritten_from: {
        id: "vc-003",
        lens: "info_asymmetry",
        name: "Better visibility",
        description: "Provides better visibility into team performance",
        role: "Tech Lead",
        confidence: "high",
        source_urls: ["https://example.com"],
      },
    };
    expect(rewritten.validation_status).toBe("rewritten");
    expect(rewritten.rewritten_from).toBeDefined();
    expect(rewritten.rewritten_from!.name).toBe("Better visibility");
  });

  it("has undefined optional fields when not set", () => {
    const valid: ValidatedCandidate = {
      id: "vc-004",
      lens: "time_compression",
      name: "Instant feedback",
      description: "Reduces feedback loop from days to minutes",
      role: "Developer",
      confidence: "high",
      source_urls: [],
      validation_status: "valid",
    };
    expect(valid.validation_issue).toBeUndefined();
    expect(valid.rewritten_from).toBeUndefined();
  });
});

describe("ValueMoment", () => {
  it("defines all required fields: id, name, tier, convergence_count, contributing_lenses, description, roles, product_surfaces, contributing_candidates", () => {
    const moment: ValueMoment = {
      id: "vm-001",
      name: "Achieve deployment confidence",
      tier: 1,
      convergence_count: 5,
      contributing_lenses: [
        "capability_mapping",
        "effort_elimination",
        "time_compression",
        "state_transitions",
        "artifact_creation",
      ],
      description: "Teams deploy with confidence knowing automated checks validate everything",
      roles: ["DevOps Engineer", "Developer"],
      product_surfaces: ["CI/CD Pipeline", "Test Runner"],
      contributing_candidates: ["c-001", "c-003", "c-007", "c-012", "c-015"],
    };
    expect(moment.id).toBe("vm-001");
    expect(moment.name).toBe("Achieve deployment confidence");
    expect(moment.tier).toBe(1);
    expect(moment.convergence_count).toBe(5);
    expect(moment.contributing_lenses).toHaveLength(5);
    expect(moment.description).toContain("deploy with confidence");
    expect(moment.roles).toEqual(["DevOps Engineer", "Developer"]);
    expect(moment.product_surfaces).toEqual(["CI/CD Pipeline", "Test Runner"]);
    expect(moment.contributing_candidates).toHaveLength(5);
  });

  it("tier corresponds to convergence count ranges", () => {
    const tier1: ValueMoment = {
      id: "vm-t1",
      name: "High convergence moment",
      tier: 1,
      convergence_count: 5,
      contributing_lenses: ["capability_mapping", "effort_elimination", "time_compression", "state_transitions", "artifact_creation"],
      description: "Multiple lenses converge on this",
      roles: ["User"],
      product_surfaces: ["Feature A"],
      contributing_candidates: ["c-1", "c-2", "c-3", "c-4", "c-5"],
    };
    expect(tier1.tier).toBe(1);

    const tier2: ValueMoment = {
      id: "vm-t2",
      name: "Medium convergence moment",
      tier: 2,
      convergence_count: 3,
      contributing_lenses: ["capability_mapping", "effort_elimination", "time_compression"],
      description: "Some lenses converge",
      roles: ["User"],
      product_surfaces: ["Feature B"],
      contributing_candidates: ["c-6", "c-7", "c-8"],
    };
    expect(tier2.tier).toBe(2);

    const tier3: ValueMoment = {
      id: "vm-t3",
      name: "Low convergence moment",
      tier: 3,
      convergence_count: 1,
      contributing_lenses: ["artifact_creation"],
      description: "Single lens only",
      roles: ["User"],
      product_surfaces: ["Feature C"],
      contributing_candidates: ["c-9"],
    };
    expect(tier3.tier).toBe(3);
  });
});

describe("ConvergenceResult", () => {
  it("wraps array of ValueMoments with metadata", () => {
    const result: ConvergenceResult = {
      productId: "products:abc123" as any,
      value_moments: [
        {
          id: "vm-001",
          name: "Achieve deployment confidence",
          tier: 1,
          convergence_count: 5,
          contributing_lenses: ["capability_mapping", "effort_elimination", "time_compression", "state_transitions", "artifact_creation"],
          description: "Teams deploy with confidence",
          roles: ["DevOps"],
          product_surfaces: ["CI/CD"],
          contributing_candidates: ["c-1", "c-2", "c-3", "c-4", "c-5"],
        },
      ],
      tier_1_count: 1,
      tier_2_count: 0,
      tier_3_count: 0,
      total_moments: 1,
      execution_time_ms: 5432,
      validation_stats: {
        total_candidates: 20,
        valid: 15,
        rewritten: 3,
        removed: 2,
      },
    };
    expect(result.value_moments).toHaveLength(1);
    expect(result.tier_1_count).toBe(1);
    expect(result.tier_2_count).toBe(0);
    expect(result.tier_3_count).toBe(0);
    expect(result.total_moments).toBe(1);
    expect(result.execution_time_ms).toBe(5432);
    expect(result.validation_stats.total_candidates).toBe(20);
    expect(result.validation_stats.valid).toBe(15);
    expect(result.validation_stats.rewritten).toBe(3);
    expect(result.validation_stats.removed).toBe(2);
  });

  it("productId references the products table", () => {
    const result: ConvergenceResult = {
      productId: "products:xyz789" as any,
      value_moments: [],
      tier_1_count: 0,
      tier_2_count: 0,
      tier_3_count: 0,
      total_moments: 0,
      execution_time_ms: 100,
      validation_stats: {
        total_candidates: 0,
        valid: 0,
        rewritten: 0,
        removed: 0,
      },
    };
    expect(result.productId).toBe("products:xyz789");
  });
});
