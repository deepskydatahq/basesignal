import { describe, it, expect } from "vitest";
import {
  LensTypeSchema,
  ConfidenceLevelSchema,
  LensCandidateSchema,
  LensResultSchema,
  AllLensesResultSchema,
} from "../lenses";

const validCandidate = {
  id: "lc-1",
  lens: "capability_mapping" as const,
  name: "Data Export",
  description: "Export data to CSV",
  role: "Data Analyst",
  confidence: "high" as const,
  source_urls: ["https://example.com"],
};

describe("LensTypeSchema", () => {
  it.each([
    "capability_mapping",
    "effort_elimination",
    "info_asymmetry",
    "decision_enablement",
    "state_transitions",
    "time_compression",
    "artifact_creation",
  ])("accepts '%s'", (val) => {
    expect(LensTypeSchema.safeParse(val).success).toBe(true);
  });

  it("rejects invalid lens type", () => {
    expect(LensTypeSchema.safeParse("invalid").success).toBe(false);
  });
});

describe("ConfidenceLevelSchema", () => {
  it.each(["high", "medium", "low"])("accepts '%s'", (val) => {
    expect(ConfidenceLevelSchema.safeParse(val).success).toBe(true);
  });
});

describe("LensCandidateSchema", () => {
  it("accepts candidate with only required fields", () => {
    expect(LensCandidateSchema.safeParse(validCandidate).success).toBe(true);
  });

  it("accepts candidate with all optional fields", () => {
    const data = {
      ...validCandidate,
      enabling_features: ["Export button"],
      effort_eliminated: "Manual copy",
      information_gained: "Data insights",
      decision_enabled: "Resource allocation",
      state_transition: "Draft to Published",
      time_compression: "Hours to minutes",
      artifact_type: "Report",
    };
    expect(LensCandidateSchema.safeParse(data).success).toBe(true);
  });
});

describe("LensResultSchema", () => {
  it("accepts valid lens result", () => {
    const data = {
      lens: "capability_mapping" as const,
      candidates: [validCandidate],
      candidate_count: 1,
      execution_time_ms: 500,
    };
    expect(LensResultSchema.safeParse(data).success).toBe(true);
  });
});

describe("AllLensesResultSchema", () => {
  it("accepts valid all lenses result", () => {
    const data = {
      productId: "prod-1",
      candidates: [validCandidate],
      per_lens: [{ lens: "capability_mapping" as const, candidate_count: 1, execution_time_ms: 500 }],
      total_candidates: 1,
      execution_time_ms: 1000,
      errors: [],
    };
    expect(AllLensesResultSchema.safeParse(data).success).toBe(true);
  });
});
