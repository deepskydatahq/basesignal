import { describe, it, expect, vi } from "vitest";
import { buildEventVocabulary, collectTriggers, reconcileOutputs, parseReconciliationResponse, type EventVocabularyEntry } from "../../outputs/reconcile.js";
import type { MeasurementSpec, LifecycleStatesResult } from "@basesignal/core";
import type { LlmProvider } from "../../types.js";
import type { ActivationMapResult } from "../../outputs/activation-map.js";
import type { OutputsResult } from "../../outputs/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpec(overrides?: Partial<MeasurementSpec>): MeasurementSpec {
  return {
    perspectives: {
      product: { entities: [] },
      interaction: { entities: [] },
    },
    jsonSchemas: [],
    confidence: 0.8,
    sources: [],
    ...overrides,
  };
}

function makeActivationMap(overrides?: Partial<ActivationMapResult>): ActivationMapResult {
  return {
    stages: [
      {
        level: 1,
        name: "explorer",
        signal_strength: "weak",
        trigger_events: ["create_project"],
        value_moments_unlocked: [],
        drop_off_risk: { level: "low", reason: "Simple" },
      },
    ],
    transitions: [
      { from_level: 1, to_level: 2, trigger_events: ["complete_onboarding"] },
    ],
    primary_activation_level: 1,
    confidence: "medium",
    sources: [],
    ...overrides,
  };
}

function makeLifecycleStates(overrides?: Partial<LifecycleStatesResult>): LifecycleStatesResult {
  return {
    states: [
      {
        name: "new",
        definition: "Just signed up",
        entry_criteria: [{ event_name: "signup", condition: "account created" }],
        exit_triggers: [{ event_name: "create_project", condition: "first project" }],
        time_window: "7 days",
      },
      {
        name: "activated",
        definition: "Created project",
        entry_criteria: [{ event_name: "create_project", condition: "project created" }],
        exit_triggers: [{ event_name: "daily_use", condition: "3+ days" }],
        time_window: "14 days",
      },
    ],
    transitions: [],
    confidence: 0.75,
    sources: [],
    ...overrides,
  };
}

function makeOutputs(overrides?: Partial<OutputsResult>): OutputsResult {
  return {
    icp_profiles: [],
    value_moments: [],
    activation_map: makeActivationMap(),
    lifecycle_states: makeLifecycleStates(),
    measurement_spec: makeSpec({
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
              { name: "completed_onboarding", properties_supported: [], activity_properties: [] },
            ],
          }],
        },
        interaction: { entities: [] },
      },
    }),
    ...overrides,
  };
}

function mockLlm(response: string): LlmProvider {
  return {
    complete: async () => response,
  } as LlmProvider;
}

// ---------------------------------------------------------------------------
// parseReconciliationResponse
// ---------------------------------------------------------------------------

describe("parseReconciliationResponse", () => {
  it("parses a valid mapping object", () => {
    const result = parseReconciliationResponse(JSON.stringify({
      create_project: "project.created",
      signup: "project.created",
    }));
    expect(result).toEqual({
      create_project: "project.created",
      signup: "project.created",
    });
  });

  it("returns empty object for empty JSON object", () => {
    expect(parseReconciliationResponse("{}")).toEqual({});
  });

  it("throws on array input", () => {
    expect(() => parseReconciliationResponse("[]")).toThrow("Expected JSON object");
  });

  it("throws on non-string values", () => {
    expect(() => parseReconciliationResponse(JSON.stringify({
      create_project: 42,
    }))).toThrow('Expected string value for trigger "create_project"');
  });

  it("throws on nested object values", () => {
    expect(() => parseReconciliationResponse(JSON.stringify({
      create_project: { event: "project.created" },
    }))).toThrow('Expected string value for trigger "create_project"');
  });

  it("handles markdown-wrapped JSON", () => {
    const wrapped = "```json\n{\"a\": \"b\"}\n```";
    expect(parseReconciliationResponse(wrapped)).toEqual({ a: "b" });
  });
});

// ---------------------------------------------------------------------------
// buildEventVocabulary
// ---------------------------------------------------------------------------

describe("buildEventVocabulary", () => {
  it("extracts product entity events as entity_id.activity_name", () => {
    const spec = makeSpec({
      perspectives: {
        product: {
          entities: [{
            id: "board",
            name: "Board",
            description: "A whiteboard",
            isHeartbeat: true,
            properties: [],
            activities: [
              { name: "created", properties_supported: [], activity_properties: [] },
              { name: "shared", properties_supported: [], activity_properties: [] },
            ],
          }],
        },
        interaction: { entities: [] },
      },
    });

    const vocab = buildEventVocabulary(spec);
    expect(vocab).toEqual([
      { event: "board.created", entity: "board", activity: "created", perspective: "product" },
      { event: "board.shared", entity: "board", activity: "shared", perspective: "product" },
    ]);
  });

  it("excludes interaction perspective entities", () => {
    const spec = makeSpec({
      perspectives: {
        product: { entities: [] },
        interaction: {
          entities: [{
            name: "Interaction",
            properties: [],
            activities: [
              { name: "element_clicked", properties_supported: [] },
            ],
          }],
        },
      },
    });

    expect(buildEventVocabulary(spec)).toEqual([]);
  });

  it("returns only product entries from a mixed spec", () => {
    const spec = makeSpec({
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
            ],
          }],
        },
        interaction: {
          entities: [{
            name: "Interaction",
            properties: [],
            activities: [{ name: "element_clicked", properties_supported: [] }],
          }],
        },
      },
    });

    const vocab = buildEventVocabulary(spec);
    expect(vocab).toHaveLength(1);
    expect(vocab.map((e: EventVocabularyEntry) => e.event)).toEqual([
      "project.created",
    ]);
  });

  it("returns empty array when spec has no entities", () => {
    expect(buildEventVocabulary(makeSpec())).toEqual([]);
  });

  it("returns empty array when entities have no activities", () => {
    const spec = makeSpec({
      perspectives: {
        product: {
          entities: [{
            id: "board",
            name: "Board",
            description: "A whiteboard",
            isHeartbeat: true,
            properties: [],
            activities: [],
          }],
        },
        interaction: { entities: [] },
      },
    });
    expect(buildEventVocabulary(spec)).toEqual([]);
  });

  it("handles multiple product entities", () => {
    const spec = makeSpec({
      perspectives: {
        product: {
          entities: [
            {
              id: "board",
              name: "Board",
              description: "A whiteboard",
              isHeartbeat: true,
              properties: [],
              activities: [{ name: "created", properties_supported: [], activity_properties: [] }],
            },
            {
              id: "asset",
              name: "Asset",
              description: "A media asset",
              isHeartbeat: false,
              properties: [],
              activities: [
                { name: "uploaded", properties_supported: [], activity_properties: [] },
                { name: "deleted", properties_supported: [], activity_properties: [] },
              ],
            },
          ],
        },
        interaction: { entities: [] },
      },
    });

    expect(buildEventVocabulary(spec).map((e: EventVocabularyEntry) => e.event)).toEqual([
      "board.created",
      "asset.uploaded",
      "asset.deleted",
    ]);
  });
});

// ---------------------------------------------------------------------------
// collectTriggers
// ---------------------------------------------------------------------------

describe("collectTriggers", () => {
  it("collects from activation map stages and transitions", () => {
    const triggers = collectTriggers(makeActivationMap(), null);
    expect(triggers).toContain("create_project");
    expect(triggers).toContain("complete_onboarding");
  });

  it("collects from lifecycle state entry_criteria and exit_triggers", () => {
    const triggers = collectTriggers(null, makeLifecycleStates());
    expect(triggers).toContain("signup");
    expect(triggers).toContain("create_project");
    expect(triggers).toContain("daily_use");
  });

  it("deduplicates across sources", () => {
    const triggers = collectTriggers(makeActivationMap(), makeLifecycleStates());
    // "create_project" appears in both activation map and lifecycle states
    const count = triggers.filter((t) => t === "create_project").length;
    expect(count).toBe(1);
  });

  it("returns empty array when both are null", () => {
    expect(collectTriggers(null, null)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// reconcileOutputs
// ---------------------------------------------------------------------------

describe("reconcileOutputs", () => {
  it("maps triggers using LLM response", async () => {
    const outputs = makeOutputs();
    const mapping = JSON.stringify({
      create_project: "project.created",
      complete_onboarding: "project.completed_onboarding",
      signup: "project.created",
      daily_use: "project.completed_onboarding",
    });

    const result = await reconcileOutputs(outputs, mockLlm(mapping));

    // Activation map stages
    expect(result.activation_map!.stages[0].trigger_events).toEqual(["project.created"]);
    // Activation map transitions
    expect(result.activation_map!.transitions[0].trigger_events).toEqual(["project.completed_onboarding"]);
    // Lifecycle state entry_criteria
    expect(result.lifecycle_states!.states[0].entry_criteria[0].event_name).toBe("project.created");
    // Lifecycle state exit_triggers
    expect(result.lifecycle_states!.states[1].exit_triggers[0].event_name).toBe("project.completed_onboarding");
  });

  it("does not mutate the input outputs", async () => {
    const outputs = makeOutputs();
    const originalTrigger = outputs.activation_map!.stages[0].trigger_events[0];
    const mapping = JSON.stringify({ create_project: "project.created" });

    await reconcileOutputs(outputs, mockLlm(mapping));

    expect(outputs.activation_map!.stages[0].trigger_events[0]).toBe(originalTrigger);
  });

  it("returns outputs unchanged when measurement_spec is null", async () => {
    const outputs = makeOutputs({ measurement_spec: null });
    const result = await reconcileOutputs(outputs, mockLlm("{}"));
    expect(result).toBe(outputs); // Same reference — early return
  });

  it("returns outputs unchanged when vocabulary is empty", async () => {
    const outputs = makeOutputs({
      measurement_spec: makeSpec(), // No entities
    });
    const result = await reconcileOutputs(outputs, mockLlm("{}"));
    expect(result).toBe(outputs);
  });

  it("preserves unmapped triggers", async () => {
    const outputs = makeOutputs();
    // Only map some triggers — the rest should keep their original text
    const mapping = JSON.stringify({
      create_project: "project.created",
    });

    const result = await reconcileOutputs(outputs, mockLlm(mapping));

    // Mapped trigger
    expect(result.activation_map!.stages[0].trigger_events).toEqual(["project.created"]);
    // Unmapped trigger preserved
    expect(result.activation_map!.transitions[0].trigger_events).toEqual(["complete_onboarding"]);
  });

  it("preserves lifecycle state conditions and other fields", async () => {
    const outputs = makeOutputs();
    const mapping = JSON.stringify({
      signup: "project.created",
      create_project: "project.created",
      daily_use: "project.completed_onboarding",
      complete_onboarding: "project.completed_onboarding",
    });

    const result = await reconcileOutputs(outputs, mockLlm(mapping));

    // Conditions are preserved
    expect(result.lifecycle_states!.states[0].entry_criteria[0].condition).toBe("account created");
    expect(result.lifecycle_states!.states[0].entry_criteria[0].event_name).toBe("project.created");
    expect(result.lifecycle_states!.states[0].definition).toBe("Just signed up");
    expect(result.lifecycle_states!.confidence).toBe(0.75);
  });

  it("returns outputs unchanged when no triggers exist", async () => {
    const outputs = makeOutputs({
      activation_map: makeActivationMap({
        stages: [{ level: 1, name: "explorer", signal_strength: "weak", trigger_events: [], value_moments_unlocked: [], drop_off_risk: { level: "low", reason: "Simple" } }],
        transitions: [],
      }),
      lifecycle_states: makeLifecycleStates({
        states: [
          { name: "new", definition: "New", entry_criteria: [], exit_triggers: [], time_window: "7 days" },
        ],
      }),
    });

    const completeSpy = vi.fn();
    const llm = { complete: completeSpy } as unknown as LlmProvider;
    const result = await reconcileOutputs(outputs, llm);
    expect(result).toBe(outputs);
    expect(completeSpy).not.toHaveBeenCalled();
  });
});
