import { describe, it, expect } from "vitest";
import {
  buildBatch1ContextSummary,
  processSettledResults,
  BATCH1_LENSES,
  BATCH2_LENSES,
} from "./orchestrate";
import type { LensResult, LensCandidate, AllLensesResult, LensType } from "./types";

function makeLensCandidate(
  lens: LensType,
  name: string,
  overrides: Partial<LensCandidate> = {},
): LensCandidate {
  return {
    id: crypto.randomUUID(),
    lens,
    name,
    description: `Description for ${name}`,
    role: "Engineer",
    confidence: "high",
    source_urls: ["https://example.com/features"],
    ...overrides,
  };
}

function makeLensResult(
  lens: LensType,
  candidateCount: number = 3,
  overrides: Partial<LensResult> = {},
): LensResult {
  return {
    lens,
    candidates: Array.from({ length: candidateCount }, (_, i) =>
      makeLensCandidate(lens, `${lens} candidate ${i + 1}`),
    ),
    candidate_count: candidateCount,
    execution_time_ms: 1000 + Math.floor(Math.random() * 2000),
    ...overrides,
  };
}

describe("BATCH1_LENSES and BATCH2_LENSES", () => {
  it("Batch 1 contains capability_mapping, effort_elimination, time_compression, artifact_creation", () => {
    expect(BATCH1_LENSES).toEqual([
      "capability_mapping",
      "effort_elimination",
      "time_compression",
      "artifact_creation",
    ]);
  });

  it("Batch 2 contains info_asymmetry, decision_enablement, state_transitions", () => {
    expect(BATCH2_LENSES).toEqual([
      "info_asymmetry",
      "decision_enablement",
      "state_transitions",
    ]);
  });

  it("all 7 lenses are covered between both batches", () => {
    const allLenses = [...BATCH1_LENSES, ...BATCH2_LENSES];
    expect(allLenses).toHaveLength(7);
    expect(new Set(allLenses).size).toBe(7);
  });
});

describe("buildBatch1ContextSummary", () => {
  it("creates context object from batch 1 results", () => {
    const results: LensResult[] = [
      makeLensResult("capability_mapping", 3),
      makeLensResult("effort_elimination", 2),
    ];

    const context = buildBatch1ContextSummary(results);

    expect(Object.keys(context)).toEqual(["capability_mapping", "effort_elimination"]);
    expect(context["capability_mapping"].candidates).toHaveLength(3);
    expect(context["effort_elimination"].candidates).toHaveLength(2);
  });

  it("limits to top 5 candidates per lens", () => {
    const results: LensResult[] = [
      makeLensResult("capability_mapping", 15),
    ];

    const context = buildBatch1ContextSummary(results);
    expect(context["capability_mapping"].candidates).toHaveLength(5);
  });

  it("includes only name and description per candidate", () => {
    const results: LensResult[] = [
      makeLensResult("effort_elimination", 1),
    ];

    const context = buildBatch1ContextSummary(results);
    const candidate = context["effort_elimination"].candidates[0];

    expect(candidate).toHaveProperty("name");
    expect(candidate).toHaveProperty("description");
    expect(Object.keys(candidate)).toEqual(["name", "description"]);
  });

  it("returns empty object for empty results", () => {
    const context = buildBatch1ContextSummary([]);
    expect(context).toEqual({});
  });
});

describe("processSettledResults", () => {
  it("extracts fulfilled results", () => {
    const result1 = makeLensResult("capability_mapping", 5);
    const result2 = makeLensResult("effort_elimination", 3);

    const settled: PromiseSettledResult<LensResult>[] = [
      { status: "fulfilled", value: result1 },
      { status: "fulfilled", value: result2 },
    ];

    const { results, errors } = processSettledResults(
      settled,
      ["capability_mapping", "effort_elimination"],
    );

    expect(results).toHaveLength(2);
    expect(results[0].lens).toBe("capability_mapping");
    expect(results[1].lens).toBe("effort_elimination");
    expect(errors).toHaveLength(0);
  });

  it("captures rejected results as errors", () => {
    const settled: PromiseSettledResult<LensResult>[] = [
      { status: "fulfilled", value: makeLensResult("capability_mapping") },
      { status: "rejected", reason: new Error("API key missing") },
      { status: "fulfilled", value: makeLensResult("time_compression") },
    ];

    const { results, errors } = processSettledResults(
      settled,
      ["capability_mapping", "effort_elimination", "time_compression"],
    );

    expect(results).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      lens: "effort_elimination",
      error: "API key missing",
    });
  });

  it("handles non-Error rejection reasons", () => {
    const settled: PromiseSettledResult<LensResult>[] = [
      { status: "rejected", reason: "string error" },
    ];

    const { results, errors } = processSettledResults(
      settled,
      ["capability_mapping"],
    );

    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe("string error");
  });

  it("handles all rejected", () => {
    const settled: PromiseSettledResult<LensResult>[] = [
      { status: "rejected", reason: new Error("fail 1") },
      { status: "rejected", reason: new Error("fail 2") },
    ];

    const { results, errors } = processSettledResults(
      settled,
      ["capability_mapping", "effort_elimination"],
    );

    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(2);
    expect(errors[0].lens).toBe("capability_mapping");
    expect(errors[1].lens).toBe("effort_elimination");
  });

  it("handles empty settled array", () => {
    const { results, errors } = processSettledResults([], []);
    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

describe("AllLensesResult type", () => {
  it("can be constructed with all required fields", () => {
    const result: AllLensesResult = {
      productId: "product123",
      candidates: [makeLensCandidate("capability_mapping", "Test")],
      per_lens: [
        { lens: "capability_mapping", candidate_count: 1, execution_time_ms: 500 },
      ],
      total_candidates: 1,
      execution_time_ms: 2000,
      errors: [],
    };

    expect(result.productId).toBe("product123");
    expect(result.candidates).toHaveLength(1);
    expect(result.per_lens).toHaveLength(1);
    expect(result.total_candidates).toBe(1);
    expect(result.execution_time_ms).toBe(2000);
    expect(result.errors).toHaveLength(0);
  });

  it("supports error entries", () => {
    const result: AllLensesResult = {
      productId: "product123",
      candidates: [],
      per_lens: [],
      total_candidates: 0,
      execution_time_ms: 100,
      errors: [
        { lens: "capability_mapping", error: "timeout" },
        { lens: "info_asymmetry", error: "no pages" },
      ],
    };

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].lens).toBe("capability_mapping");
    expect(result.errors[0].error).toBe("timeout");
  });

  it("supports mixed success and error results", () => {
    const candidates = [
      makeLensCandidate("capability_mapping", "Cap 1"),
      makeLensCandidate("effort_elimination", "Eff 1"),
    ];

    const result: AllLensesResult = {
      productId: "product456",
      candidates,
      per_lens: [
        { lens: "capability_mapping", candidate_count: 1, execution_time_ms: 1000 },
        { lens: "effort_elimination", candidate_count: 1, execution_time_ms: 800 },
      ],
      total_candidates: 2,
      execution_time_ms: 3000,
      errors: [
        { lens: "time_compression", error: "failed" },
      ],
    };

    expect(result.candidates).toHaveLength(2);
    expect(result.per_lens).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.total_candidates).toBe(2);
  });
});
