import { describe, it, expect } from "vitest";
import { enrichValueMoments } from "../../outputs/enrich-value-moments.js";
import type { MeasurementSpec, LifecycleStatesResult, ValueMoment } from "@basesignal/core";
import type { LlmProvider } from "../../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValueMoment(overrides?: Partial<ValueMoment>): ValueMoment {
  return {
    id: "vm-1",
    name: "Quick setup",
    description: "Set up a project in seconds",
    tier: 1,
    lenses: ["jtbd"],
    lens_count: 1,
    roles: ["Developer"],
    product_surfaces: ["Onboarding"],
    contributing_candidates: ["vc-1"],
    ...overrides,
  };
}

function makeSpec(overrides?: Partial<MeasurementSpec>): MeasurementSpec {
  return {
    perspectives: {
      product: {
        entities: [{
          id: "project",
          name: "Project",
          description: "A project",
          isHeartbeat: true,
          properties: [],
          activities: [
            { name: "created", properties_supported: [], activity_properties: [] },
            { name: "shared", properties_supported: [], activity_properties: [] },
          ],
        }],
      },
      customer: {
        entities: [{
          name: "Customer",
          properties: [],
          activities: [
            { name: "activated", derivation_rule: "Project created (first time)", properties_used: [] },
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

function makeLifecycleStates(): LifecycleStatesResult {
  return {
    states: [
      { name: "new", definition: "Just signed up", entry_criteria: [], exit_triggers: [], time_window: "7 days" },
      { name: "activated", definition: "Created project", entry_criteria: [], exit_triggers: [], time_window: "14 days" },
      { name: "engaged", definition: "Regular user", entry_criteria: [], exit_triggers: [], time_window: "30 days" },
    ],
    transitions: [],
    confidence: 0.75,
    sources: [],
  };
}

function mockLlm(response: string): LlmProvider {
  return {
    complete: async () => response,
  } as LlmProvider;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("enrichValueMoments", () => {
  it("enriches value moments with measurement references, lifecycle relevance, and metrics", async () => {
    const vm = makeValueMoment();
    const enrichmentResponse = JSON.stringify([{
      id: "vm-1",
      measurement_references: [{ entity: "project", activity: "created" }],
      lifecycle_relevance: ["new", "activated"],
      suggested_metrics: ["projects_created_per_user", "time_to_first_project"],
    }]);

    const result = await enrichValueMoments([vm], makeSpec(), makeLifecycleStates(), mockLlm(enrichmentResponse));

    expect(result).toHaveLength(1);
    expect(result[0].measurement_references).toEqual([{ entity: "project", activity: "created" }]);
    expect(result[0].lifecycle_relevance).toEqual(["new", "activated"]);
    expect(result[0].suggested_metrics).toEqual(["projects_created_per_user", "time_to_first_project"]);
  });

  it("preserves all original fields after enrichment", async () => {
    const vm = makeValueMoment();
    const enrichmentResponse = JSON.stringify([{
      id: "vm-1",
      measurement_references: [{ entity: "project", activity: "created" }],
      lifecycle_relevance: ["activated"],
      suggested_metrics: ["setup_rate"],
    }]);

    const result = await enrichValueMoments([vm], makeSpec(), makeLifecycleStates(), mockLlm(enrichmentResponse));

    expect(result[0].id).toBe("vm-1");
    expect(result[0].name).toBe("Quick setup");
    expect(result[0].description).toBe("Set up a project in seconds");
    expect(result[0].tier).toBe(1);
    expect(result[0].lenses).toEqual(["jtbd"]);
    expect(result[0].roles).toEqual(["Developer"]);
    expect(result[0].product_surfaces).toEqual(["Onboarding"]);
  });

  it("does not mutate input value moments", async () => {
    const vm = makeValueMoment();
    const enrichmentResponse = JSON.stringify([{
      id: "vm-1",
      measurement_references: [{ entity: "project", activity: "created" }],
      lifecycle_relevance: ["activated"],
      suggested_metrics: ["setup_rate"],
    }]);

    await enrichValueMoments([vm], makeSpec(), makeLifecycleStates(), mockLlm(enrichmentResponse));

    expect(vm.measurement_references).toBeUndefined();
    expect(vm.lifecycle_relevance).toBeUndefined();
    expect(vm.suggested_metrics).toBeUndefined();
  });

  it("enriches multiple value moments", async () => {
    const vms = [
      makeValueMoment({ id: "vm-1", name: "Quick setup" }),
      makeValueMoment({ id: "vm-2", name: "Team sharing", tier: 2 }),
    ];
    const enrichmentResponse = JSON.stringify([
      {
        id: "vm-1",
        measurement_references: [{ entity: "project", activity: "created" }],
        lifecycle_relevance: ["new"],
        suggested_metrics: ["setup_rate"],
      },
      {
        id: "vm-2",
        measurement_references: [{ entity: "project", activity: "shared" }],
        lifecycle_relevance: ["engaged"],
        suggested_metrics: ["share_rate"],
      },
    ]);

    const result = await enrichValueMoments(vms, makeSpec(), makeLifecycleStates(), mockLlm(enrichmentResponse));

    expect(result).toHaveLength(2);
    expect(result[0].measurement_references).toEqual([{ entity: "project", activity: "created" }]);
    expect(result[1].measurement_references).toEqual([{ entity: "project", activity: "shared" }]);
  });

  it("returns original value moments when measurement spec is null", async () => {
    const vm = makeValueMoment();
    const result = await enrichValueMoments([vm], null, null, mockLlm("should not be called"));

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(vm); // same reference — no copy made
  });

  it("returns original value moments when vocabulary is empty", async () => {
    const vm = makeValueMoment();
    const emptySpec = makeSpec({
      perspectives: {
        product: { entities: [] },
        customer: { entities: [] },
        interaction: { entities: [] },
      },
    });

    const result = await enrichValueMoments([vm], emptySpec, null, mockLlm("should not be called"));

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(vm);
  });

  it("returns empty array when no value moments provided", async () => {
    const result = await enrichValueMoments([], makeSpec(), null, mockLlm("should not be called"));
    expect(result).toEqual([]);
  });

  it("preserves unenriched value moments when LLM response misses some ids", async () => {
    const vms = [
      makeValueMoment({ id: "vm-1" }),
      makeValueMoment({ id: "vm-2" }),
    ];
    // Only enrich vm-1
    const enrichmentResponse = JSON.stringify([{
      id: "vm-1",
      measurement_references: [{ entity: "project", activity: "created" }],
      lifecycle_relevance: ["activated"],
      suggested_metrics: ["setup_rate"],
    }]);

    const result = await enrichValueMoments(vms, makeSpec(), makeLifecycleStates(), mockLlm(enrichmentResponse));

    expect(result[0].measurement_references).toEqual([{ entity: "project", activity: "created" }]);
    // vm-2 unchanged — same reference
    expect(result[1]).toBe(vms[1]);
    expect(result[1].measurement_references).toBeUndefined();
  });

  it("works without lifecycle states (passes null)", async () => {
    const vm = makeValueMoment();
    const enrichmentResponse = JSON.stringify([{
      id: "vm-1",
      measurement_references: [{ entity: "project", activity: "created" }],
      lifecycle_relevance: [],
      suggested_metrics: ["setup_rate"],
    }]);

    const result = await enrichValueMoments([vm], makeSpec(), null, mockLlm(enrichmentResponse));

    expect(result[0].measurement_references).toEqual([{ entity: "project", activity: "created" }]);
    expect(result[0].lifecycle_relevance).toEqual([]);
  });
});
