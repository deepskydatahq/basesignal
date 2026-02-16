import { describe, it, expect } from "vitest";
import type {
  AnalyticalLensType,
  LensCandidate,
  LensResult,
  AllLensesResult,
} from "../lenses";

describe("AnalyticalLensType", () => {
  it("includes all 7 lens types", () => {
    const allTypes: AnalyticalLensType[] = [
      "capability_mapping",
      "effort_elimination",
      "info_asymmetry",
      "decision_enablement",
      "state_transitions",
      "time_compression",
      "artifact_creation",
    ];
    expect(allTypes).toHaveLength(7);
  });
});

describe("LensCandidate", () => {
  it("has all shared fields", () => {
    const candidate: LensCandidate = {
      id: "abc-123",
      lens: "capability_mapping",
      name: "Cross-team visibility",
      description: "Teams can see each other's progress in real-time",
      role: "Engineering Manager",
      confidence: "high",
      source_urls: ["https://example.com/features"],
    };
    expect(candidate.id).toBe("abc-123");
    expect(candidate.lens).toBe("capability_mapping");
    expect(candidate.confidence).toBe("high");
    expect(candidate.source_urls).toHaveLength(1);
  });

  it("supports lens-specific optional fields", () => {
    const candidate: LensCandidate = {
      id: "1",
      lens: "capability_mapping",
      name: "test",
      description: "test",
      role: "user",
      confidence: "medium",
      source_urls: [],
      enabling_features: ["Feature A"],
      effort_eliminated: "Manual work",
      information_gained: "Team velocity",
      decision_enabled: "Sprint planning",
      state_transition: "Draft to Published",
      time_compression: "Hours to minutes",
      artifact_type: "Report",
    };
    expect(candidate.enabling_features).toEqual(["Feature A"]);
    expect(candidate.effort_eliminated).toBe("Manual work");
    expect(candidate.artifact_type).toBe("Report");
  });

  it("works with no optional fields", () => {
    const candidate: LensCandidate = {
      id: "1",
      lens: "info_asymmetry",
      name: "test",
      description: "test",
      role: "user",
      confidence: "low",
      source_urls: [],
    };
    expect(candidate.enabling_features).toBeUndefined();
    expect(candidate.effort_eliminated).toBeUndefined();
  });
});

describe("LensResult", () => {
  it("has lens, candidates, candidate_count, execution_time_ms", () => {
    const result: LensResult = {
      lens: "effort_elimination",
      candidates: [],
      candidate_count: 0,
      execution_time_ms: 1500,
    };
    expect(result.lens).toBe("effort_elimination");
    expect(result.candidate_count).toBe(0);
    expect(result.execution_time_ms).toBe(1500);
  });
});

describe("AllLensesResult", () => {
  it("aggregates results across all lenses", () => {
    const result: AllLensesResult = {
      productId: "products:abc123",
      candidates: [],
      per_lens: [
        { lens: "capability_mapping", candidate_count: 3, execution_time_ms: 500 },
        { lens: "effort_elimination", candidate_count: 2, execution_time_ms: 400 },
      ],
      total_candidates: 5,
      execution_time_ms: 900,
      errors: [{ lens: "time_compression", error: "Timeout" }],
    };
    expect(result.productId).toBe("products:abc123");
    expect(result.per_lens).toHaveLength(2);
    expect(result.total_candidates).toBe(5);
    expect(result.errors).toHaveLength(1);
  });
});
