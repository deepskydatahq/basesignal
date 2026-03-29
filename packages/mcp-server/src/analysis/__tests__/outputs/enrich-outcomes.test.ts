import { describe, it, expect } from "vitest";
import { enrichOutcomes, parseOutcomeEnrichmentResponse } from "../../outputs/enrich-outcomes.js";
import type { MeasurementSpec, OutcomeItem } from "@basesignal/core";
import type { LlmProvider } from "../../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOutcome(overrides?: Partial<OutcomeItem>): OutcomeItem {
  return {
    description: "Increase team velocity",
    type: "business",
    linkedFeatures: ["sprint-planning"],
    ...overrides,
  };
}

function makeSpec(overrides?: Partial<MeasurementSpec>): MeasurementSpec {
  return {
    perspectives: {
      product: {
        entities: [{
          id: "sprint",
          name: "Sprint",
          description: "A sprint",
          isHeartbeat: true,
          properties: [],
          activities: [
            { name: "created", properties_supported: [], activity_properties: [] },
            { name: "completed", properties_supported: [], activity_properties: [] },
          ],
        }],
      },
      interaction: { entities: [] },
    },
    jsonSchemas: [],
    confidence: 0.8,
    sources: [],
    ...overrides,
  };
}

function mockLlm(response: string): LlmProvider {
  return {
    complete: async () => response,
  } as LlmProvider;
}

// ---------------------------------------------------------------------------
// Tests: parseOutcomeEnrichmentResponse
// ---------------------------------------------------------------------------

describe("parseOutcomeEnrichmentResponse", () => {
  it("parses a valid enrichment array", () => {
    const result = parseOutcomeEnrichmentResponse(JSON.stringify([{
      description: "Increase team velocity",
      measurement_references: [{ entity: "sprint", activity: "completed" }],
      suggested_metrics: ["velocity_per_sprint"],
    }]));
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Increase team velocity");
    expect(result[0].measurement_references).toEqual([{ entity: "sprint", activity: "completed" }]);
  });

  it("returns empty array for empty JSON array", () => {
    expect(parseOutcomeEnrichmentResponse("[]")).toEqual([]);
  });

  it("throws on non-array input", () => {
    expect(() => parseOutcomeEnrichmentResponse("{}")).toThrow("Expected JSON array");
  });

  it("throws on entries missing description field", () => {
    expect(() => parseOutcomeEnrichmentResponse(JSON.stringify([{
      measurement_references: [],
      suggested_metrics: [],
    }]))).toThrow("entry 0 missing required field: description");
  });

  it("throws on entries with empty description", () => {
    expect(() => parseOutcomeEnrichmentResponse(JSON.stringify([{
      description: "",
      measurement_references: [],
      suggested_metrics: [],
    }]))).toThrow("entry 0 missing required field: description");
  });

  it("defaults missing arrays to empty", () => {
    const result = parseOutcomeEnrichmentResponse(JSON.stringify([{
      description: "Some outcome",
    }]));
    expect(result[0].measurement_references).toEqual([]);
    expect(result[0].suggested_metrics).toEqual([]);
  });

  it("filters invalid measurement_references entries", () => {
    const result = parseOutcomeEnrichmentResponse(JSON.stringify([{
      description: "Some outcome",
      measurement_references: [
        { entity: "sprint", activity: "completed" },
        { entity: 42 },
        "invalid",
      ],
      suggested_metrics: [],
    }]));
    expect(result[0].measurement_references).toEqual([{ entity: "sprint", activity: "completed" }]);
  });

  it("filters non-string suggested_metrics entries", () => {
    const result = parseOutcomeEnrichmentResponse(JSON.stringify([{
      description: "Some outcome",
      measurement_references: [],
      suggested_metrics: ["valid_metric", 42, null],
    }]));
    expect(result[0].suggested_metrics).toEqual(["valid_metric"]);
  });

  it("handles markdown-wrapped JSON", () => {
    const wrapped = '```json\n[{"description": "Some outcome"}]\n```';
    const result = parseOutcomeEnrichmentResponse(wrapped);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Some outcome");
  });
});

// ---------------------------------------------------------------------------
// Tests: enrichOutcomes
// ---------------------------------------------------------------------------

describe("enrichOutcomes", () => {
  it("returns original outcomes when measurement spec is null", async () => {
    const outcome = makeOutcome();
    const result = await enrichOutcomes([outcome], null, mockLlm("should not be called"));

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(outcome); // same reference — no copy made
  });

  it("returns original outcomes when vocabulary is empty", async () => {
    const outcome = makeOutcome();
    const emptySpec = makeSpec({
      perspectives: {
        product: { entities: [] },
        interaction: { entities: [] },
      },
    });

    const result = await enrichOutcomes([outcome], emptySpec, mockLlm("should not be called"));

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(outcome);
  });

  it("returns original outcomes when outcomes array is empty", async () => {
    const result = await enrichOutcomes([], makeSpec(), mockLlm("should not be called"));
    expect(result).toEqual([]);
  });

  it("adds measurement_references and suggested_metrics from LLM response", async () => {
    const outcome = makeOutcome();
    const enrichmentResponse = JSON.stringify([{
      description: "Increase team velocity",
      measurement_references: [{ entity: "sprint", activity: "completed" }],
      suggested_metrics: ["velocity_per_sprint", "sprints_completed_per_week"],
    }]);

    const result = await enrichOutcomes([outcome], makeSpec(), mockLlm(enrichmentResponse));

    expect(result).toHaveLength(1);
    expect(result[0].measurement_references).toEqual([{ entity: "sprint", activity: "completed" }]);
    expect(result[0].suggested_metrics).toEqual(["velocity_per_sprint", "sprints_completed_per_week"]);
  });

  it("does not mutate input outcomes", async () => {
    const outcome = makeOutcome();
    const enrichmentResponse = JSON.stringify([{
      description: "Increase team velocity",
      measurement_references: [{ entity: "sprint", activity: "completed" }],
      suggested_metrics: ["velocity_per_sprint"],
    }]);

    await enrichOutcomes([outcome], makeSpec(), mockLlm(enrichmentResponse));

    expect(outcome.measurement_references).toBeUndefined();
    expect(outcome.suggested_metrics).toBeUndefined();
  });

  it("preserves all original fields after enrichment", async () => {
    const outcome = makeOutcome();
    const enrichmentResponse = JSON.stringify([{
      description: "Increase team velocity",
      measurement_references: [{ entity: "sprint", activity: "completed" }],
      suggested_metrics: ["velocity_per_sprint"],
    }]);

    const result = await enrichOutcomes([outcome], makeSpec(), mockLlm(enrichmentResponse));

    expect(result[0].description).toBe("Increase team velocity");
    expect(result[0].type).toBe("business");
    expect(result[0].linkedFeatures).toEqual(["sprint-planning"]);
  });

  it("enriches multiple outcomes", async () => {
    const outcomes = [
      makeOutcome({ description: "Increase team velocity" }),
      makeOutcome({ description: "Reduce churn rate", type: "retention" }),
    ];
    const enrichmentResponse = JSON.stringify([
      {
        description: "Increase team velocity",
        measurement_references: [{ entity: "sprint", activity: "completed" }],
        suggested_metrics: ["velocity_per_sprint"],
      },
      {
        description: "Reduce churn rate",
        measurement_references: [{ entity: "sprint", activity: "created" }],
        suggested_metrics: ["churn_rate"],
      },
    ]);

    const result = await enrichOutcomes(outcomes, makeSpec(), mockLlm(enrichmentResponse));

    expect(result).toHaveLength(2);
    expect(result[0].measurement_references).toEqual([{ entity: "sprint", activity: "completed" }]);
    expect(result[1].measurement_references).toEqual([{ entity: "sprint", activity: "created" }]);
  });

  it("preserves unenriched outcomes when LLM response misses some descriptions", async () => {
    const outcomes = [
      makeOutcome({ description: "Increase team velocity" }),
      makeOutcome({ description: "Reduce churn rate" }),
    ];
    // Only enrich the first outcome
    const enrichmentResponse = JSON.stringify([{
      description: "Increase team velocity",
      measurement_references: [{ entity: "sprint", activity: "completed" }],
      suggested_metrics: ["velocity_per_sprint"],
    }]);

    const result = await enrichOutcomes(outcomes, makeSpec(), mockLlm(enrichmentResponse));

    expect(result[0].measurement_references).toEqual([{ entity: "sprint", activity: "completed" }]);
    // Second outcome unchanged — same reference
    expect(result[1]).toBe(outcomes[1]);
    expect(result[1].measurement_references).toBeUndefined();
  });
});
