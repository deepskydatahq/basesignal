import { describe, it, expect } from "vitest";
import { GENERATION_STEPS } from "./orchestrate";
import type { OutputGenerationResult, ICPProfile, ActivationMap, MeasurementSpec } from "./types";

function makeICPProfile(name: string): ICPProfile {
  return {
    id: crypto.randomUUID(),
    name,
    description: `Description for ${name}`,
    value_moment_priorities: [
      { moment_id: "vm-1", priority: 1, relevance_reason: "Primary use case" },
    ],
    activation_triggers: ["trigger-1"],
    pain_points: ["pain-1"],
    success_metrics: ["metric-1"],
    confidence: 0.85,
    sources: ["https://example.com"],
  };
}

function makeActivationMap(): ActivationMap {
  return {
    stages: [
      {
        level: 1,
        name: "Signup",
        signal_strength: "low",
        trigger_events: ["user_signed_up"],
        value_moments_unlocked: [],
        drop_off_risk: "high",
      },
      {
        level: 2,
        name: "Setup",
        signal_strength: "medium",
        trigger_events: ["workspace_created"],
        value_moments_unlocked: ["vm-1"],
        drop_off_risk: "medium",
      },
    ],
    transitions: [
      {
        from_level: 1,
        to_level: 2,
        trigger_events: ["workspace_created"],
        typical_timeframe: "1-3 days",
      },
    ],
    primary_activation_level: 2,
    confidence: 0.8,
    sources: ["https://example.com"],
  };
}

function makeMeasurementSpec(): MeasurementSpec {
  return {
    events: [
      {
        name: "workspace_created",
        description: "User creates their first workspace",
        properties: [
          { name: "workspace_id", type: "string", description: "Workspace ID", required: true },
        ],
        trigger_condition: "On first workspace creation",
        maps_to: { type: "activation_level", activation_level: 2 },
        category: "activation",
      },
    ],
    total_events: 1,
    coverage: {
      activation_levels_covered: [1, 2],
      value_moments_covered: ["vm-1"],
    },
    confidence: 0.75,
    sources: ["https://example.com"],
  };
}

describe("GENERATION_STEPS", () => {
  it("has exactly 3 elements", () => {
    expect(GENERATION_STEPS).toHaveLength(3);
  });

  it("first step is icp", () => {
    expect(GENERATION_STEPS[0]).toBe("icp");
  });

  it("second step is activation_map", () => {
    expect(GENERATION_STEPS[1]).toBe("activation_map");
  });

  it("third step is measurement_spec", () => {
    expect(GENERATION_STEPS[2]).toBe("measurement_spec");
  });

  it("equals the full expected array", () => {
    expect(GENERATION_STEPS).toEqual(["icp", "activation_map", "measurement_spec"]);
  });
});

describe("OutputGenerationResult type", () => {
  it("can be constructed with all fields populated (success case)", () => {
    const result: OutputGenerationResult = {
      productId: "product123",
      icp_profiles: [makeICPProfile("Growth PM"), makeICPProfile("Engineering Lead")],
      activation_map: makeActivationMap(),
      measurement_spec: makeMeasurementSpec(),
      generated_at: "2026-02-08T12:00:00.000Z",
      execution_time_ms: 15000,
    };

    expect(result.productId).toBe("product123");
    expect(result.icp_profiles).toHaveLength(2);
    expect(result.activation_map).not.toBeNull();
    expect(result.activation_map!.stages).toHaveLength(2);
    expect(result.measurement_spec).not.toBeNull();
    expect(result.measurement_spec!.events).toHaveLength(1);
    expect(result.errors).toBeUndefined();
    expect(result.execution_time_ms).toBe(15000);
  });

  it("can be constructed with nullable fields and errors (partial failure case)", () => {
    const result: OutputGenerationResult = {
      productId: "product456",
      icp_profiles: [makeICPProfile("Solo Founder")],
      activation_map: null,
      measurement_spec: null,
      errors: [
        { step: "activation_map", error: "API key missing" },
        { step: "measurement_spec", error: "No activation levels found" },
      ],
      generated_at: "2026-02-08T12:00:00.000Z",
      execution_time_ms: 5000,
    };

    expect(result.icp_profiles).toHaveLength(1);
    expect(result.activation_map).toBeNull();
    expect(result.measurement_spec).toBeNull();
    expect(result.errors).toHaveLength(2);
    expect(result.errors![0].step).toBe("activation_map");
    expect(result.errors![1].step).toBe("measurement_spec");
  });

  it("errors field is optional (omitted when no errors)", () => {
    const result: OutputGenerationResult = {
      productId: "product789",
      icp_profiles: [],
      activation_map: makeActivationMap(),
      measurement_spec: makeMeasurementSpec(),
      generated_at: "2026-02-08T12:00:00.000Z",
      execution_time_ms: 20000,
    };

    expect(result.errors).toBeUndefined();
    expect("errors" in result).toBe(false);
  });

  it("can be constructed with all generators failed (total failure case)", () => {
    const result: OutputGenerationResult = {
      productId: "product-fail",
      icp_profiles: [],
      activation_map: null,
      measurement_spec: null,
      errors: [
        { step: "icp", error: "Product profile not found" },
        { step: "activation_map", error: "Product profile not found" },
        { step: "measurement_spec", error: "Product profile not found" },
      ],
      generated_at: "2026-02-08T12:00:00.000Z",
      execution_time_ms: 500,
    };

    expect(result.icp_profiles).toHaveLength(0);
    expect(result.activation_map).toBeNull();
    expect(result.measurement_spec).toBeNull();
    expect(result.errors).toHaveLength(3);
    expect(result.errors!.map((e) => e.step)).toEqual(["icp", "activation_map", "measurement_spec"]);
  });
});
