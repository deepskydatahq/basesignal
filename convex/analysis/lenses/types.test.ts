import { describe, it, expect } from "vitest";
import type {
  LensType,
  ConfidenceLevel,
  LensCandidate,
  LensResult,
} from "./types";

describe("Lens candidate types", () => {
  it("LensType is a union of exactly 7 lens values", () => {
    const values: LensType[] = [
      "capability_mapping",
      "effort_elimination",
      "info_asymmetry",
      "decision_enablement",
      "state_transitions",
      "time_compression",
      "artifact_creation",
    ];
    expect(values).toHaveLength(7);
  });

  it("ConfidenceLevel is a union of high, medium, low", () => {
    const values: ConfidenceLevel[] = ["high", "medium", "low"];
    expect(values).toHaveLength(3);
  });

  it("LensCandidate has all shared fields", () => {
    const candidate: LensCandidate = {
      id: "cap-001",
      lens: "capability_mapping",
      name: "Board Creation",
      description: "Users can create collaborative boards",
      role: "creator",
      confidence: "high",
      source_urls: ["https://example.com/features"],
    };
    expect(candidate.id).toBe("cap-001");
    expect(candidate.lens).toBe("capability_mapping");
    expect(candidate.name).toBe("Board Creation");
    expect(candidate.description).toBeTruthy();
    expect(candidate.role).toBe("creator");
    expect(candidate.confidence).toBe("high");
    expect(candidate.source_urls).toHaveLength(1);
  });

  it("LensCandidate supports enabling_features optional field", () => {
    const candidate: LensCandidate = {
      id: "cap-002",
      lens: "capability_mapping",
      name: "Real-time Collaboration",
      description: "Multiple users can edit simultaneously",
      role: "collaborator",
      confidence: "medium",
      source_urls: [],
      enabling_features: ["websockets", "cursor-sharing"],
    };
    expect(candidate.enabling_features).toEqual(["websockets", "cursor-sharing"]);
  });

  it("LensCandidate supports effort_eliminated optional field", () => {
    const candidate: LensCandidate = {
      id: "eff-001",
      lens: "effort_elimination",
      name: "Auto-formatting",
      description: "Eliminates manual layout work",
      role: "editor",
      confidence: "high",
      source_urls: [],
      effort_eliminated: "manual diagram layout and alignment",
    };
    expect(candidate.effort_eliminated).toBe("manual diagram layout and alignment");
  });

  it("LensCandidate supports information_gained optional field", () => {
    const candidate: LensCandidate = {
      id: "info-001",
      lens: "info_asymmetry",
      name: "Usage Analytics",
      description: "Reveals how teams use boards",
      role: "admin",
      confidence: "low",
      source_urls: [],
      information_gained: "team collaboration patterns",
    };
    expect(candidate.information_gained).toBe("team collaboration patterns");
  });

  it("LensCandidate supports decision_enabled optional field", () => {
    const candidate: LensCandidate = {
      id: "dec-001",
      lens: "decision_enablement",
      name: "Priority Matrix",
      description: "Helps teams prioritize work",
      role: "manager",
      confidence: "medium",
      source_urls: [],
      decision_enabled: "which features to build next",
    };
    expect(candidate.decision_enabled).toBe("which features to build next");
  });

  it("LensCandidate supports state_transition optional field", () => {
    const candidate: LensCandidate = {
      id: "st-001",
      lens: "state_transitions",
      name: "Onboarding Flow",
      description: "Moves users from new to activated",
      role: "new_user",
      confidence: "high",
      source_urls: [],
      state_transition: "new_user → activated_user",
    };
    expect(candidate.state_transition).toBe("new_user → activated_user");
  });

  it("LensCandidate supports time_compression optional field", () => {
    const candidate: LensCandidate = {
      id: "tc-001",
      lens: "time_compression",
      name: "Template Gallery",
      description: "Skip blank-canvas setup time",
      role: "creator",
      confidence: "medium",
      source_urls: [],
      time_compression: "hours of setup → minutes with template",
    };
    expect(candidate.time_compression).toBe("hours of setup → minutes with template");
  });

  it("LensCandidate supports artifact_type optional field", () => {
    const candidate: LensCandidate = {
      id: "art-001",
      lens: "artifact_creation",
      name: "Export to PDF",
      description: "Creates shareable deliverable",
      role: "presenter",
      confidence: "high",
      source_urls: [],
      artifact_type: "PDF report",
    };
    expect(candidate.artifact_type).toBe("PDF report");
  });

  it("LensCandidate works with no optional fields", () => {
    const candidate: LensCandidate = {
      id: "min-001",
      lens: "capability_mapping",
      name: "Minimal Candidate",
      description: "Only required fields",
      role: "user",
      confidence: "low",
      source_urls: [],
    };
    expect(candidate.enabling_features).toBeUndefined();
    expect(candidate.effort_eliminated).toBeUndefined();
    expect(candidate.information_gained).toBeUndefined();
    expect(candidate.decision_enabled).toBeUndefined();
    expect(candidate.state_transition).toBeUndefined();
    expect(candidate.time_compression).toBeUndefined();
    expect(candidate.artifact_type).toBeUndefined();
  });

  it("LensResult has lens, candidates, candidate_count, execution_time_ms", () => {
    const result: LensResult = {
      lens: "effort_elimination",
      candidates: [
        {
          id: "eff-001",
          lens: "effort_elimination",
          name: "Auto-formatting",
          description: "Eliminates manual layout work",
          role: "editor",
          confidence: "high",
          source_urls: ["https://example.com"],
          effort_eliminated: "manual layout",
        },
      ],
      candidate_count: 1,
      execution_time_ms: 1250,
    };
    expect(result.lens).toBe("effort_elimination");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidate_count).toBe(1);
    expect(result.execution_time_ms).toBe(1250);
  });

  it("all 4 types are importable from ./types", () => {
    // This test verifies the imports at the top of this file compile
    // If any type were missing, the import would fail at compile time
    const lensType: LensType = "capability_mapping";
    const confidence: ConfidenceLevel = "high";
    const candidate: LensCandidate = {
      id: "test",
      lens: lensType,
      name: "test",
      description: "test",
      role: "test",
      confidence,
      source_urls: [],
    };
    const result: LensResult = {
      lens: lensType,
      candidates: [candidate],
      candidate_count: 1,
      execution_time_ms: 0,
    };
    expect(lensType).toBeDefined();
    expect(confidence).toBeDefined();
    expect(candidate).toBeDefined();
    expect(result).toBeDefined();
  });
});
