import { describe, it, expect } from "vitest";
import type { OrchestrationResult } from "./orchestrate";
import type { ICPProfile, ActivationMap, MeasurementSpec } from "./types";

// --- Test Fixtures ---

const mockICPProfiles: ICPProfile[] = [
  {
    id: "icp_1",
    name: "Product Manager",
    description: "Manages product roadmaps and priorities",
    value_moment_priorities: [
      { moment_id: "vm_1", priority: 1, relevance_reason: "Core workflow" },
    ],
    activation_triggers: ["Create first project"],
    pain_points: ["Lack of visibility"],
    success_metrics: ["Team adoption rate"],
    confidence: 0.8,
    sources: ["marketing_page"],
  },
];

const mockActivationMap: ActivationMap = {
  stages: [
    {
      level: 1,
      name: "explorer",
      signal_strength: "low",
      trigger_events: ["signup"],
      value_moments_unlocked: [],
      drop_off_risk: "high",
    },
    {
      level: 2,
      name: "activated",
      signal_strength: "medium",
      trigger_events: ["create_project"],
      value_moments_unlocked: ["vm_1"],
      drop_off_risk: "medium",
    },
  ],
  transitions: [
    { from_level: 1, to_level: 2, trigger_events: ["create_project"] },
  ],
  primary_activation_level: 2,
  confidence: 0.75,
  sources: ["activation_levels"],
};

const mockMeasurementSpec: MeasurementSpec = {
  entities: [
    {
      id: "project",
      name: "Project",
      description: "A project workspace",
      isHeartbeat: true,
      properties: [
        { name: "project_id", type: "string", description: "ID of project", isRequired: true },
      ],
    },
  ],
  events: [
    {
      name: "project_created",
      entity_id: "project",
      description: "User created a new project",
      perspective: "customer",
      properties: [
        { name: "project_id", type: "string", description: "ID of project", isRequired: true },
        { name: "user_id", type: "string", description: "ID of user", isRequired: true },
      ],
      trigger_condition: "When user clicks Create Project",
      maps_to: { type: "activation_level", activation_level: 2 },
      category: "activation",
    },
  ],
  total_events: 1,
  coverage: {
    activation_levels_covered: [2],
    value_moments_covered: ["vm_1"],
    perspective_distribution: { customer: 1, product: 0, interaction: 0 },
  },
  userStateModel: [
    { name: "new", definition: "Just signed up", criteria: [{ event_name: "user_signed_up", condition: "within 7 days" }] },
    { name: "activated", definition: "Reached activation", criteria: [{ event_name: "activation_reached", condition: "completed onboarding" }] },
    { name: "active", definition: "Regularly engaged", criteria: [{ event_name: "session_started", condition: "3+ sessions in 7 days" }] },
    { name: "at_risk", definition: "Declining engagement", criteria: [{ event_name: "session_started", condition: "no session in 14 days" }] },
    { name: "dormant", definition: "Stopped engaging", criteria: [{ event_name: "session_started", condition: "no session in 30 days" }] },
  ],
  confidence: 0.8,
  sources: ["value_moments", "activation_levels"],
};

// --- Unit Tests ---

describe("OrchestrationResult type", () => {
  it("accepts a complete result with all outputs", () => {
    const result: OrchestrationResult = {
      productId: "prod_123",
      icp_profiles: mockICPProfiles,
      activation_map: mockActivationMap,
      measurement_spec: mockMeasurementSpec,
      generated_at: new Date().toISOString(),
      execution_time_ms: 5000,
    };

    expect(result.icp_profiles).toHaveLength(1);
    expect(result.activation_map?.stages).toHaveLength(2);
    expect(result.measurement_spec?.total_events).toBe(1);
    expect(result.errors).toBeUndefined();
  });

  it("accepts a partial result with null outputs", () => {
    const result: OrchestrationResult = {
      productId: "prod_123",
      icp_profiles: [],
      activation_map: null,
      measurement_spec: null,
      errors: ["ICP generation failed: Network error"],
      generated_at: new Date().toISOString(),
      execution_time_ms: 1000,
    };

    expect(result.icp_profiles).toHaveLength(0);
    expect(result.activation_map).toBeNull();
    expect(result.measurement_spec).toBeNull();
    expect(result.errors).toHaveLength(1);
  });

  it("tracks execution time in milliseconds", () => {
    const result: OrchestrationResult = {
      productId: "prod_123",
      icp_profiles: mockICPProfiles,
      activation_map: mockActivationMap,
      measurement_spec: mockMeasurementSpec,
      generated_at: new Date().toISOString(),
      execution_time_ms: 45000,
    };

    expect(result.execution_time_ms).toBe(45000);
    expect(typeof result.execution_time_ms).toBe("number");
  });

  it("stores ISO timestamp for generated_at", () => {
    const now = new Date();
    const result: OrchestrationResult = {
      productId: "prod_123",
      icp_profiles: [],
      activation_map: null,
      measurement_spec: null,
      generated_at: now.toISOString(),
      execution_time_ms: 0,
    };

    expect(result.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(result.generated_at).getTime()).toBeCloseTo(now.getTime(), -2);
  });
});

describe("OrchestrationResult error handling", () => {
  it("collects multiple errors from different generators", () => {
    const result: OrchestrationResult = {
      productId: "prod_123",
      icp_profiles: [],
      activation_map: null,
      measurement_spec: null,
      errors: [
        "ICP generation failed: timeout",
        "Activation map generation failed: no activation levels",
        "Measurement spec generation failed: invalid input",
      ],
      generated_at: new Date().toISOString(),
      execution_time_ms: 2000,
    };

    expect(result.errors).toHaveLength(3);
    expect(result.errors?.[0]).toContain("ICP");
    expect(result.errors?.[1]).toContain("Activation map");
    expect(result.errors?.[2]).toContain("Measurement spec");
  });

  it("can return partial success with some errors", () => {
    const result: OrchestrationResult = {
      productId: "prod_123",
      icp_profiles: mockICPProfiles,
      activation_map: mockActivationMap,
      measurement_spec: null,
      errors: ["Measurement spec generation failed: API rate limit"],
      generated_at: new Date().toISOString(),
      execution_time_ms: 30000,
    };

    expect(result.icp_profiles).toHaveLength(1);
    expect(result.activation_map).not.toBeNull();
    expect(result.measurement_spec).toBeNull();
    expect(result.errors).toHaveLength(1);
  });
});

describe("OrchestrationResult output validation", () => {
  it("preserves ICP profile structure", () => {
    const result: OrchestrationResult = {
      productId: "prod_123",
      icp_profiles: mockICPProfiles,
      activation_map: null,
      measurement_spec: null,
      generated_at: new Date().toISOString(),
      execution_time_ms: 0,
    };

    const icp = result.icp_profiles[0];
    expect(icp.id).toBe("icp_1");
    expect(icp.name).toBe("Product Manager");
    expect(icp.value_moment_priorities).toHaveLength(1);
    expect(icp.activation_triggers).toContain("Create first project");
  });

  it("preserves activation map structure", () => {
    const result: OrchestrationResult = {
      productId: "prod_123",
      icp_profiles: [],
      activation_map: mockActivationMap,
      measurement_spec: null,
      generated_at: new Date().toISOString(),
      execution_time_ms: 0,
    };

    const map = result.activation_map!;
    expect(map.stages).toHaveLength(2);
    expect(map.transitions).toHaveLength(1);
    expect(map.primary_activation_level).toBe(2);
  });

  it("preserves measurement spec structure", () => {
    const result: OrchestrationResult = {
      productId: "prod_123",
      icp_profiles: [],
      activation_map: null,
      measurement_spec: mockMeasurementSpec,
      generated_at: new Date().toISOString(),
      execution_time_ms: 0,
    };

    const spec = result.measurement_spec!;
    expect(spec.entities).toHaveLength(1);
    expect(spec.events).toHaveLength(1);
    expect(spec.total_events).toBe(1);
    expect(spec.coverage.activation_levels_covered).toContain(2);
    expect(spec.coverage.value_moments_covered).toContain("vm_1");
  });
});

describe("OrchestrationResult Linear fixture", () => {
  it("represents a complete Linear output generation", () => {
    const linearResult: OrchestrationResult = {
      productId: "linear_prod_id",
      icp_profiles: [
        {
          id: "icp_eng_lead",
          name: "Engineering Lead",
          description: "Manages engineering team and sprints",
          value_moment_priorities: [
            { moment_id: "cycle_planning", priority: 1, relevance_reason: "Core workflow" },
            { moment_id: "issue_tracking", priority: 2, relevance_reason: "Daily usage" },
          ],
          activation_triggers: ["Create first cycle", "Invite team member"],
          pain_points: ["Sprint velocity visibility", "Cross-team dependencies"],
          success_metrics: ["Cycle completion rate", "Issue velocity"],
          confidence: 0.85,
          sources: ["features_page", "testimonials"],
        },
        {
          id: "icp_product_mgr",
          name: "Product Manager",
          description: "Manages product roadmaps and initiatives",
          value_moment_priorities: [
            { moment_id: "roadmap_planning", priority: 1, relevance_reason: "Strategic planning" },
          ],
          activation_triggers: ["Create roadmap", "Add initiative"],
          pain_points: ["Roadmap communication"],
          success_metrics: ["Initiative completion"],
          confidence: 0.8,
          sources: ["marketing_page"],
        },
      ],
      activation_map: {
        stages: [
          {
            level: 1,
            name: "explorer",
            signal_strength: "low",
            trigger_events: ["signup", "view_demo"],
            value_moments_unlocked: [],
            drop_off_risk: "high",
          },
          {
            level: 2,
            name: "issue_tracker",
            signal_strength: "medium",
            trigger_events: ["create_issue", "complete_issue"],
            value_moments_unlocked: ["issue_tracking"],
            drop_off_risk: "medium",
          },
          {
            level: 3,
            name: "cycle_user",
            signal_strength: "strong",
            trigger_events: ["create_cycle", "complete_cycle"],
            value_moments_unlocked: ["cycle_planning"],
            drop_off_risk: "low",
          },
          {
            level: 4,
            name: "team_lead",
            signal_strength: "strong",
            trigger_events: ["invite_member", "create_team"],
            value_moments_unlocked: ["team_collaboration"],
            drop_off_risk: "low",
          },
        ],
        transitions: [
          { from_level: 1, to_level: 2, trigger_events: ["create_issue"] },
          { from_level: 2, to_level: 3, trigger_events: ["create_cycle"] },
          { from_level: 3, to_level: 4, trigger_events: ["invite_member"] },
        ],
        primary_activation_level: 3,
        confidence: 0.8,
        sources: ["activation_levels", "value_moments"],
      },
      measurement_spec: {
        entities: [
          {
            id: "issue",
            name: "Issue",
            description: "A trackable work item",
            isHeartbeat: true,
            properties: [{ name: "issue_id", type: "string", description: "ID of issue", isRequired: true }],
          },
          {
            id: "cycle",
            name: "Cycle",
            description: "A sprint cycle",
            isHeartbeat: false,
            properties: [{ name: "cycle_id", type: "string", description: "ID of cycle", isRequired: true }],
          },
        ],
        events: [
          {
            name: "issue_created",
            entity_id: "issue",
            description: "User created a new issue",
            perspective: "customer",
            properties: [
              { name: "issue_id", type: "string", description: "ID of issue", isRequired: true },
              { name: "project_id", type: "string", description: "Project context", isRequired: true },
              { name: "user_id", type: "string", description: "Creator", isRequired: true },
            ],
            trigger_condition: "When user creates an issue",
            maps_to: { type: "activation_level", activation_level: 2 },
            category: "activation",
          },
          {
            name: "cycle_completed",
            entity_id: "cycle",
            description: "Team completed a sprint cycle",
            perspective: "interaction",
            properties: [
              { name: "cycle_id", type: "string", description: "ID of cycle", isRequired: true },
              { name: "velocity", type: "number", description: "Points completed", isRequired: true },
            ],
            trigger_condition: "When cycle is marked complete",
            maps_to: { type: "value_moment", moment_id: "cycle_planning" },
            category: "value",
          },
        ],
        total_events: 2,
        coverage: {
          activation_levels_covered: [2, 3],
          value_moments_covered: ["issue_tracking", "cycle_planning"],
          perspective_distribution: { customer: 1, product: 0, interaction: 1 },
        },
        userStateModel: [
          { name: "new", definition: "Just signed up", criteria: [{ event_name: "user_signed_up", condition: "within 7 days" }] },
          { name: "activated", definition: "Reached activation", criteria: [{ event_name: "activation_reached", condition: "completed onboarding" }] },
          { name: "active", definition: "Regularly engaged", criteria: [{ event_name: "session_started", condition: "3+ sessions in 7 days" }] },
          { name: "at_risk", definition: "Declining engagement", criteria: [{ event_name: "session_started", condition: "no session in 14 days" }] },
          { name: "dormant", definition: "Stopped engaging", criteria: [{ event_name: "session_started", condition: "no session in 30 days" }] },
        ],
        confidence: 0.82,
        sources: ["value_moments", "activation_levels", "icp_profiles"],
      },
      generated_at: "2026-02-08T21:00:00.000Z",
      execution_time_ms: 45000,
    };

    expect(linearResult.icp_profiles).toHaveLength(2);
    expect(linearResult.activation_map?.stages).toHaveLength(4);
    expect(linearResult.measurement_spec?.total_events).toBe(2);
    expect(linearResult.execution_time_ms).toBeLessThan(60000);
    expect(linearResult.errors).toBeUndefined();
  });
});
