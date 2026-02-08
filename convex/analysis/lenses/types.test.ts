import { describe, it, expect } from "vitest";
import type { LensType, ConfidenceLevel, LensCandidate, LensResult } from "./types";

describe("LensType", () => {
  it("includes all 7 lens types", () => {
    const allTypes: LensType[] = [
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

describe("ConfidenceLevel", () => {
  it("includes high, medium, low", () => {
    const levels: ConfidenceLevel[] = ["high", "medium", "low"];
    expect(levels).toHaveLength(3);
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
    expect(candidate.name).toBe("Cross-team visibility");
    expect(candidate.description).toContain("real-time");
    expect(candidate.role).toBe("Engineering Manager");
    expect(candidate.confidence).toBe("high");
    expect(candidate.source_urls).toHaveLength(1);
  });

  it("supports enabling_features optional field", () => {
    const candidate: LensCandidate = {
      id: "1",
      lens: "capability_mapping",
      name: "test",
      description: "test",
      role: "user",
      confidence: "medium",
      source_urls: [],
      enabling_features: ["Feature A", "Feature B"],
    };
    expect(candidate.enabling_features).toEqual(["Feature A", "Feature B"]);
  });

  it("supports effort_eliminated optional field", () => {
    const candidate: LensCandidate = {
      id: "1",
      lens: "effort_elimination",
      name: "test",
      description: "test",
      role: "user",
      confidence: "medium",
      source_urls: [],
      effort_eliminated: "Manual status update meetings",
    };
    expect(candidate.effort_eliminated).toBe("Manual status update meetings");
  });

  it("supports time_compression optional field", () => {
    const candidate: LensCandidate = {
      id: "1",
      lens: "time_compression",
      name: "test",
      description: "test",
      role: "user",
      confidence: "low",
      source_urls: [],
      time_compression: "Sprint planning from 2 hours to 15 minutes",
    };
    expect(candidate.time_compression).toBe("Sprint planning from 2 hours to 15 minutes");
  });

  it("supports artifact_type optional field", () => {
    const candidate: LensCandidate = {
      id: "1",
      lens: "artifact_creation",
      name: "test",
      description: "test",
      role: "user",
      confidence: "high",
      source_urls: [],
      artifact_type: "project roadmap",
    };
    expect(candidate.artifact_type).toBe("project roadmap");
  });

  it("works with no optional fields", () => {
    const candidate: LensCandidate = {
      id: "1",
      lens: "capability_mapping",
      name: "test",
      description: "test",
      role: "user",
      confidence: "medium",
      source_urls: [],
    };
    expect(candidate.enabling_features).toBeUndefined();
    expect(candidate.effort_eliminated).toBeUndefined();
    expect(candidate.time_compression).toBeUndefined();
    expect(candidate.artifact_type).toBeUndefined();
    expect(candidate.information_gained).toBeUndefined();
    expect(candidate.decision_enabled).toBeUndefined();
    expect(candidate.state_transition).toBeUndefined();
  });
});

describe("LensResult", () => {
  it("has lens, candidates, candidate_count, execution_time_ms", () => {
    const result: LensResult = {
      lens: "effort_elimination",
      candidates: [
        {
          id: "1",
          lens: "effort_elimination",
          name: "Automated triage",
          description: "Issues auto-assigned based on component",
          role: "Tech Lead",
          confidence: "high",
          source_urls: ["https://example.com"],
          effort_eliminated: "Manual issue triage",
        },
      ],
      candidate_count: 1,
      execution_time_ms: 1500,
    };
    expect(result.lens).toBe("effort_elimination");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidate_count).toBe(1);
    expect(result.execution_time_ms).toBe(1500);
  });
});
