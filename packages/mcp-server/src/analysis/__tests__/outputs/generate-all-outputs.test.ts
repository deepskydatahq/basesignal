import { describe, it, expect, vi } from "vitest";
import { generateAllOutputs } from "../../outputs/index.js";
import type {
  LlmProvider,
  ConvergenceResult,
  IdentityResult,
  ActivationLevelsResult,
  ProgressEvent,
  PipelineError,
} from "../../types.js";

// --- Minimal fixtures ---

const sampleIdentity: IdentityResult = {
  productName: "TestApp",
  description: "A test application",
  targetCustomer: "Developers",
  businessModel: "B2B SaaS",
  industry: "DevTools",
  confidence: 0.8,
  evidence: [],
};

const sampleActivationLevels: ActivationLevelsResult = {
  levels: [
    {
      level: 1,
      name: "explorer",
      signalStrength: "weak",
      criteria: [{ action: "create_project", count: 1 }],
      reasoning: "Initial setup",
      confidence: 0.7,
      evidence: [],
    },
  ],
  primaryActivation: 1,
  overallConfidence: 0.7,
};

const sampleConvergence: ConvergenceResult = {
  value_moments: [
    {
      id: "vm-1",
      name: "Quick setup",
      description: "Set up project in seconds",
      tier: 1,
      lens_count: 3,
      lenses: ["jtbd"],
      roles: ["Developer"],
      product_surfaces: ["Onboarding"],
      contributing_candidates: [],
    },
  ],
  clusters: [],
  stats: {
    total_candidates: 1,
    total_clusters: 1,
    total_moments: 1,
    tier_1_count: 1,
    tier_2_count: 0,
    tier_3_count: 0,
  },
};

// Valid JSON responses for the generators
const validICPResponse = JSON.stringify([
  {
    id: "icp-1",
    name: "Dev Lead",
    description: "Leads a dev team",
    value_moment_priorities: [{ moment_id: "vm-1", priority: 1, relevance_reason: "Core" }],
    activation_triggers: ["create_project"],
    pain_points: ["Slow setup"],
    success_metrics: ["Setup < 1 min"],
    confidence: 0.8,
    sources: [],
  },
]);

const validActivationMapResponse = JSON.stringify({
  stages: [
    {
      level: 1,
      name: "explorer",
      signal_strength: "weak",
      trigger_events: ["create_project"],
      value_moments_unlocked: ["Quick setup"],
      drop_off_risk: { level: "low", reason: "Simple action" },
    },
  ],
  transitions: [],
  primary_activation_level: 1,
  confidence: "medium",
  sources: ["activation_levels"],
});

const validLifecycleStatesResponse = JSON.stringify({
  states: [
    { name: "new", definition: "Just signed up", entry_criteria: [{ event_name: "signup", condition: "account created" }], exit_triggers: [{ event_name: "create_project", condition: "first project" }], time_window: "7 days" },
    { name: "activated", definition: "Created project", entry_criteria: [{ event_name: "create_project", condition: "project created" }], exit_triggers: [{ event_name: "daily_use", condition: "3+ days" }], time_window: "14 days" },
    { name: "engaged", definition: "Regular user", entry_criteria: [{ event_name: "daily_use", condition: "3+ days/week" }], exit_triggers: [{ event_name: "session_gap", condition: "7 days" }], time_window: "30 days" },
    { name: "at_risk", definition: "Declining", entry_criteria: [{ event_name: "session_gap", condition: "7 days" }], exit_triggers: [{ event_name: "session_gap", condition: "30 days" }], time_window: "14 days" },
    { name: "dormant", definition: "Stopped", entry_criteria: [{ event_name: "session_gap", condition: "30 days" }], exit_triggers: [{ event_name: "session_gap", condition: "60 days" }], time_window: "30 days" },
    { name: "churned", definition: "Gone", entry_criteria: [{ event_name: "session_gap", condition: "60 days" }], exit_triggers: [{ event_name: "session_started", condition: "returns" }] },
    { name: "resurrected", definition: "Returned", entry_criteria: [{ event_name: "create_project", condition: "new project after churn" }], exit_triggers: [{ event_name: "daily_use", condition: "regular use" }], time_window: "14 days" },
  ],
  transitions: [
    { from_state: "new", to_state: "activated", trigger_conditions: ["Creates first project"], typical_timeframe: "1-3 days" },
  ],
  confidence: 0.75,
  sources: ["activation_levels", "value_moments"],
});

const validMeasurementSpecResponse = JSON.stringify({
  perspectives: {
    product: {
      entities: [{
        id: "project",
        name: "Project",
        description: "A project",
        isHeartbeat: true,
        properties: [
          { name: "project_id", type: "id", description: "Project ID", isRequired: true },
        ],
        activities: [
          { name: "created", properties_supported: ["project_id"], activity_properties: [] },
        ],
      }],
    },
    customer: {
      entities: [{
        name: "Customer",
        properties: [
          { name: "customer_id", type: "id", description: "Customer ID", isRequired: true },
        ],
        activities: [
          { name: "first_value_created", derivation_rule: "Project created (first time)", properties_used: ["customer_id"] },
        ],
      }],
    },
    interaction: {
      entities: [{
        name: "Interaction",
        properties: [
          { name: "element_type", type: "string", description: "Element type", isRequired: true },
        ],
        activities: [
          { name: "element_clicked", properties_supported: ["element_type"] },
        ],
      }],
    },
  },
  confidence: 0.7,
});

// Reconciliation mapping: maps free-text triggers to entity.activity vocabulary
const validReconciliationResponse = JSON.stringify({
  create_project: "project.created",
  signup: "customer.first_value_created",
  daily_use: "daily_use",
  session_gap: "session_gap",
  session_started: "session_started",
});

// Value moment enrichment response
const validEnrichmentResponse = JSON.stringify([{
  id: "vm-1",
  measurement_references: [{ entity: "project", activity: "created" }],
  lifecycle_relevance: ["new", "activated"],
  suggested_metrics: ["projects_created_per_user", "time_to_first_project"],
}]);

// The LLM gets called in order: ICP, activation map, lifecycle states, measurement spec
// We track call index to return the right response
function createSequentialMockLlm(responses: string[]): LlmProvider {
  let callIndex = 0;
  return {
    complete: async () => {
      const response = responses[callIndex] ?? "";
      callIndex++;
      return response;
    },
  } as LlmProvider;
}

function createFailingLlm(failOnCall: number): LlmProvider {
  let callIndex = 0;
  return {
    complete: async () => {
      const current = callIndex++;
      if (current === failOnCall) {
        throw new Error(`LLM call ${current} failed`);
      }
      // Return appropriate responses for other calls
      const responses = [validICPResponse, validActivationMapResponse, validLifecycleStatesResponse, validMeasurementSpecResponse, validReconciliationResponse, validEnrichmentResponse];
      return responses[current] ?? "";
    },
  } as LlmProvider;
}

// --- Tests ---

describe("generateAllOutputs — lifecycle states wiring", () => {
  it("calls generateLifecycleStates when all guards pass", async () => {
    const llm = createSequentialMockLlm([
      validICPResponse,
      validActivationMapResponse,
      validLifecycleStatesResponse,
      validMeasurementSpecResponse,
      validReconciliationResponse,
      validEnrichmentResponse,
    ]);

    const result = await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
    );

    expect(result.lifecycle_states).not.toBeNull();
    expect(result.lifecycle_states!.states).toHaveLength(7);
    expect(result.lifecycle_states!.transitions).toHaveLength(1);
    expect(result.lifecycle_states!.confidence).toBe(0.75);
  });

  it("skips lifecycle states when activationLevels is null", async () => {
    const llm = createSequentialMockLlm([validICPResponse]);

    const result = await generateAllOutputs(
      sampleConvergence,
      null,
      sampleIdentity,
      llm,
    );

    expect(result.lifecycle_states).toBeNull();
  });

  it("skips lifecycle states when identity is null", async () => {
    const llm = createSequentialMockLlm([
      validICPResponse,
      validActivationMapResponse,
      validMeasurementSpecResponse,
      validReconciliationResponse,
      validEnrichmentResponse,
    ]);

    const result = await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      null,
      llm,
    );

    // activation_map is generated (only needs activationLevels)
    expect(result.activation_map).not.toBeNull();
    // lifecycle_states skipped because identity is null
    expect(result.lifecycle_states).toBeNull();
  });

  it("skips lifecycle states when activation map generation fails", async () => {
    // Fail on activation map call (call index 1)
    const llm = createFailingLlm(1);
    const errors: PipelineError[] = [];

    const result = await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
      undefined,
      errors,
    );

    // Activation map failed, so result.activation_map is null
    expect(result.activation_map).toBeNull();
    // Lifecycle states skipped because activation_map is null
    expect(result.lifecycle_states).toBeNull();
  });

  it("fires progress callbacks for lifecycle states on success", async () => {
    const events: ProgressEvent[] = [];
    const progress = (event: ProgressEvent) => events.push(event);
    const llm = createSequentialMockLlm([
      validICPResponse,
      validActivationMapResponse,
      validLifecycleStatesResponse,
      validMeasurementSpecResponse,
      validReconciliationResponse,
      validEnrichmentResponse,
    ]);

    await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
      progress,
    );

    const lifecycleEvents = events.filter(e => e.phase === "outputs_lifecycle_states");
    expect(lifecycleEvents).toHaveLength(2);
    expect(lifecycleEvents[0].status).toBe("started");
    expect(lifecycleEvents[1].status).toBe("completed");
  });

  it("fires progress 'failed' and pushes error when lifecycle states generator throws", async () => {
    const events: ProgressEvent[] = [];
    const errors: PipelineError[] = [];
    const progress = (event: ProgressEvent) => events.push(event);
    // Fail on lifecycle states call (call index 2)
    const llm = createFailingLlm(2);

    const result = await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
      progress,
      errors,
    );

    expect(result.lifecycle_states).toBeNull();

    const lifecycleEvents = events.filter(e => e.phase === "outputs_lifecycle_states");
    expect(lifecycleEvents).toHaveLength(2);
    expect(lifecycleEvents[0].status).toBe("started");
    expect(lifecycleEvents[1].status).toBe("failed");
    expect(lifecycleEvents[1].detail).toContain("LLM call 2 failed");

    const lifecycleErrors = errors.filter(e => e.step === "lifecycle_states");
    expect(lifecycleErrors).toHaveLength(1);
    expect(lifecycleErrors[0].phase).toBe("outputs");
    expect(lifecycleErrors[0].message).toContain("LLM call 2 failed");
  });

  it("does not fire lifecycle states progress when guard skips it", async () => {
    const events: ProgressEvent[] = [];
    const progress = (event: ProgressEvent) => events.push(event);
    const llm = createSequentialMockLlm([validICPResponse]);

    await generateAllOutputs(
      sampleConvergence,
      null,
      sampleIdentity,
      llm,
      progress,
    );

    const lifecycleEvents = events.filter(e => e.phase === "outputs_lifecycle_states");
    expect(lifecycleEvents).toHaveLength(0);
  });

  it("passes correct input fields to lifecycle states generator", async () => {
    let capturedMessages: Array<{ role: string; content: string }> = [];
    let callIndex = 0;
    const llm: LlmProvider = {
      complete: async (messages) => {
        const current = callIndex++;
        if (current === 2) {
          // Lifecycle states call
          capturedMessages = messages as Array<{ role: string; content: string }>;
        }
        const responses = [validICPResponse, validActivationMapResponse, validLifecycleStatesResponse, validMeasurementSpecResponse, validReconciliationResponse, validEnrichmentResponse];
        return responses[current] ?? "";
      },
    } as LlmProvider;

    await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
    );

    // Lifecycle states generator receives system prompt + user prompt
    expect(capturedMessages).toHaveLength(2);
    expect(capturedMessages[0].role).toBe("system");
    // User prompt should contain identity, value moments, activation levels
    expect(capturedMessages[1].content).toContain("TestApp");
    expect(capturedMessages[1].content).toContain("Quick setup");
    expect(capturedMessages[1].content).toContain("explorer");
  });
});

describe("generateAllOutputs — pageUrls flow to measurement_spec.sources", () => {
  it("populates measurement_spec.sources from pageUrls parameter", async () => {
    const llm = createSequentialMockLlm([
      validICPResponse,
      validActivationMapResponse,
      validLifecycleStatesResponse,
      validMeasurementSpecResponse,
      validReconciliationResponse,
      validEnrichmentResponse,
    ]);

    const pageUrls = ["https://example.com", "https://example.com/features", "https://example.com/pricing"];

    const result = await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
      undefined,
      undefined,
      pageUrls,
    );

    expect(result.measurement_spec).not.toBeNull();
    expect(result.measurement_spec!.sources).toEqual(pageUrls);
  });

  it("measurement_spec.sources is empty when pageUrls not provided", async () => {
    const llm = createSequentialMockLlm([
      validICPResponse,
      validActivationMapResponse,
      validLifecycleStatesResponse,
      validMeasurementSpecResponse,
      validReconciliationResponse,
      validEnrichmentResponse,
    ]);

    const result = await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
    );

    expect(result.measurement_spec).not.toBeNull();
    expect(result.measurement_spec!.sources).toEqual([]);
  });

  it("deduplicates pageUrls in measurement_spec.sources", async () => {
    const llm = createSequentialMockLlm([
      validICPResponse,
      validActivationMapResponse,
      validLifecycleStatesResponse,
      validMeasurementSpecResponse,
      validReconciliationResponse,
      validEnrichmentResponse,
    ]);

    const pageUrls = ["https://example.com", "https://example.com/features", "https://example.com"];

    const result = await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
      undefined,
      undefined,
      pageUrls,
    );

    expect(result.measurement_spec).not.toBeNull();
    expect(result.measurement_spec!.sources).toEqual(["https://example.com", "https://example.com/features"]);
  });
});

describe("generateAllOutputs — reconciliation wiring", () => {
  it("reconciles trigger events to measurement spec vocabulary", async () => {
    const llm = createSequentialMockLlm([
      validICPResponse,
      validActivationMapResponse,
      validLifecycleStatesResponse,
      validMeasurementSpecResponse,
      validReconciliationResponse,
      validEnrichmentResponse,
    ]);

    const result = await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
    );

    // Activation map triggers should be mapped
    expect(result.activation_map!.stages[0].trigger_events).toEqual(["project.created"]);
    // Lifecycle state entry_criteria should be mapped
    expect(result.lifecycle_states!.states[0].entry_criteria[0].event_name).toBe("customer.first_value_created");
    // create_project mapped in exit_triggers
    expect(result.lifecycle_states!.states[0].exit_triggers[0].event_name).toBe("project.created");
  });

  it("skips reconciliation when measurement spec is null", async () => {
    const llm = createSequentialMockLlm([validICPResponse]);

    const result = await generateAllOutputs(
      sampleConvergence,
      null, // no activation levels → no measurement spec
      sampleIdentity,
      llm,
    );

    expect(result.measurement_spec).toBeNull();
  });

  it("fires progress callbacks for reconciliation on success", async () => {
    const events: ProgressEvent[] = [];
    const progress = (event: ProgressEvent) => events.push(event);
    const llm = createSequentialMockLlm([
      validICPResponse,
      validActivationMapResponse,
      validLifecycleStatesResponse,
      validMeasurementSpecResponse,
      validReconciliationResponse,
      validEnrichmentResponse,
    ]);

    await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
      progress,
    );

    const reconcileEvents = events.filter(e => e.phase === "outputs_reconciliation");
    expect(reconcileEvents).toHaveLength(2);
    expect(reconcileEvents[0].status).toBe("started");
    expect(reconcileEvents[1].status).toBe("completed");
  });

  it("preserves original outputs when reconciliation fails (graceful degradation)", async () => {
    // Fail on reconciliation call (call index 4)
    const llm = createFailingLlm(4);
    const errors: PipelineError[] = [];

    const result = await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
      undefined,
      errors,
    );

    // Outputs still present — reconciliation failure doesn't lose data
    expect(result.activation_map).not.toBeNull();
    expect(result.lifecycle_states).not.toBeNull();
    expect(result.measurement_spec).not.toBeNull();
    // Original trigger events preserved (not mapped)
    expect(result.activation_map!.stages[0].trigger_events).toEqual(["create_project"]);

    const reconcileErrors = errors.filter(e => e.step === "reconciliation");
    expect(reconcileErrors).toHaveLength(1);
    expect(reconcileErrors[0].message).toContain("LLM call 4 failed");
  });

  it("fires progress 'failed' when reconciliation throws", async () => {
    const events: ProgressEvent[] = [];
    const progress = (event: ProgressEvent) => events.push(event);
    const llm = createFailingLlm(4);

    await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
      progress,
      [],
    );

    const reconcileEvents = events.filter(e => e.phase === "outputs_reconciliation");
    expect(reconcileEvents).toHaveLength(2);
    expect(reconcileEvents[0].status).toBe("started");
    expect(reconcileEvents[1].status).toBe("failed");
  });

  it("does not fire reconciliation progress when measurement spec is null", async () => {
    const events: ProgressEvent[] = [];
    const progress = (event: ProgressEvent) => events.push(event);
    const llm = createSequentialMockLlm([validICPResponse]);

    await generateAllOutputs(
      sampleConvergence,
      null,
      sampleIdentity,
      llm,
      progress,
    );

    const reconcileEvents = events.filter(e => e.phase === "outputs_reconciliation");
    expect(reconcileEvents).toHaveLength(0);
  });
});

describe("generateAllOutputs — value moment enrichment wiring", () => {
  it("enriches value moments with measurement references", async () => {
    const llm = createSequentialMockLlm([
      validICPResponse,
      validActivationMapResponse,
      validLifecycleStatesResponse,
      validMeasurementSpecResponse,
      validReconciliationResponse,
      validEnrichmentResponse,
    ]);

    const result = await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
    );

    expect(result.value_moments).toHaveLength(1);
    expect(result.value_moments[0].measurement_references).toEqual([{ entity: "project", activity: "created" }]);
    expect(result.value_moments[0].lifecycle_relevance).toEqual(["new", "activated"]);
    expect(result.value_moments[0].suggested_metrics).toEqual(["projects_created_per_user", "time_to_first_project"]);
  });

  it("preserves original value moments when measurement spec is null", async () => {
    const llm = createSequentialMockLlm([validICPResponse]);

    const result = await generateAllOutputs(
      sampleConvergence,
      null, // no activation levels → no measurement spec
      sampleIdentity,
      llm,
    );

    // value_moments should contain the original convergence value moments
    expect(result.value_moments).toHaveLength(1);
    expect(result.value_moments[0].name).toBe("Quick setup");
    expect(result.value_moments[0].measurement_references).toBeUndefined();
  });

  it("preserves original value moments when enrichment fails (graceful degradation)", async () => {
    // Fail on enrichment call (call index 5)
    const llm = createFailingLlm(5);
    const errors: PipelineError[] = [];

    const result = await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
      undefined,
      errors,
    );

    // value_moments should still be the original convergence value moments
    expect(result.value_moments).toHaveLength(1);
    expect(result.value_moments[0].name).toBe("Quick setup");
    expect(result.value_moments[0].measurement_references).toBeUndefined();

    const enrichErrors = errors.filter(e => e.step === "enrichment");
    expect(enrichErrors).toHaveLength(1);
    expect(enrichErrors[0].message).toContain("LLM call 5 failed");
  });

  it("fires progress callbacks for enrichment on success", async () => {
    const events: ProgressEvent[] = [];
    const progress = (event: ProgressEvent) => events.push(event);
    const llm = createSequentialMockLlm([
      validICPResponse,
      validActivationMapResponse,
      validLifecycleStatesResponse,
      validMeasurementSpecResponse,
      validReconciliationResponse,
      validEnrichmentResponse,
    ]);

    await generateAllOutputs(
      sampleConvergence,
      sampleActivationLevels,
      sampleIdentity,
      llm,
      progress,
    );

    const enrichEvents = events.filter(e => e.phase === "outputs_enrichment");
    expect(enrichEvents).toHaveLength(2);
    expect(enrichEvents[0].status).toBe("started");
    expect(enrichEvents[1].status).toBe("completed");
  });

  it("does not fire enrichment progress when measurement spec is null", async () => {
    const events: ProgressEvent[] = [];
    const progress = (event: ProgressEvent) => events.push(event);
    const llm = createSequentialMockLlm([validICPResponse]);

    await generateAllOutputs(
      sampleConvergence,
      null,
      sampleIdentity,
      llm,
      progress,
    );

    const enrichEvents = events.filter(e => e.phase === "outputs_enrichment");
    expect(enrichEvents).toHaveLength(0);
  });
});
