import { describe, it, expect } from "vitest";
import type {
  LensType,
  ConfidenceLevel,
  LensCandidate,
  LensResult,
} from "./types";

describe("LensType", () => {
  it("includes all 7 lenses", () => {
    const lenses: LensType[] = [
      "capability_mapping",
      "effort_elimination",
      "info_asymmetry",
      "decision_enablement",
      "state_transitions",
      "time_compression",
      "artifact_creation",
    ];
    expect(lenses).toHaveLength(7);
  });
});

describe("ConfidenceLevel", () => {
  it("includes high, medium, low", () => {
    const levels: ConfidenceLevel[] = ["high", "medium", "low"];
    expect(levels).toHaveLength(3);
  });
});

describe("LensCandidate", () => {
  it("defines shared fields: id, lens, name, description, role, confidence, source_urls", () => {
    const candidate: LensCandidate = {
      id: "c-001",
      lens: "capability_mapping",
      name: "Track team velocity",
      description: "Users can track team velocity across sprints",
      role: "Engineering Manager",
      confidence: "high",
      source_urls: ["https://example.com/features"],
    };
    expect(candidate.id).toBe("c-001");
    expect(candidate.lens).toBe("capability_mapping");
    expect(candidate.name).toBe("Track team velocity");
    expect(candidate.description).toBe("Users can track team velocity across sprints");
    expect(candidate.role).toBe("Engineering Manager");
    expect(candidate.confidence).toBe("high");
    expect(candidate.source_urls).toEqual(["https://example.com/features"]);
  });

  it("supports lens-specific optional fields", () => {
    const capabilityCandidate: LensCandidate = {
      id: "c-002",
      lens: "capability_mapping",
      name: "Automate CI/CD",
      description: "Enables automated deployment pipelines",
      role: "DevOps Engineer",
      confidence: "medium",
      source_urls: [],
      enabling_features: ["Pipeline Builder", "Auto-Deploy"],
    };
    expect(capabilityCandidate.enabling_features).toEqual(["Pipeline Builder", "Auto-Deploy"]);

    const effortCandidate: LensCandidate = {
      id: "c-003",
      lens: "effort_elimination",
      name: "Skip manual reporting",
      description: "Eliminates manual report generation",
      role: "Product Manager",
      confidence: "high",
      source_urls: [],
      effort_eliminated: "Manual weekly report creation",
    };
    expect(effortCandidate.effort_eliminated).toBe("Manual weekly report creation");

    const infoCandidate: LensCandidate = {
      id: "c-004",
      lens: "info_asymmetry",
      name: "Surface hidden dependencies",
      description: "Reveals cross-team dependencies",
      role: "Tech Lead",
      confidence: "low",
      source_urls: [],
      information_gained: "Cross-team dependency visibility",
    };
    expect(infoCandidate.information_gained).toBe("Cross-team dependency visibility");

    const decisionCandidate: LensCandidate = {
      id: "c-005",
      lens: "decision_enablement",
      name: "Prioritize backlog",
      description: "Data-driven backlog prioritization",
      role: "Product Manager",
      confidence: "medium",
      source_urls: [],
      decision_enabled: "Which features to build next",
    };
    expect(decisionCandidate.decision_enabled).toBe("Which features to build next");

    const stateCandidate: LensCandidate = {
      id: "c-006",
      lens: "state_transitions",
      name: "Move to production-ready",
      description: "Transitions code from draft to production",
      role: "Developer",
      confidence: "high",
      source_urls: [],
      state_transition: "Draft → Production-ready",
    };
    expect(stateCandidate.state_transition).toBe("Draft → Production-ready");

    const timeCandidate: LensCandidate = {
      id: "c-007",
      lens: "time_compression",
      name: "Instant test results",
      description: "Reduces test feedback from hours to seconds",
      role: "Developer",
      confidence: "high",
      source_urls: [],
      time_compression: "Hours → Seconds for test feedback",
    };
    expect(timeCandidate.time_compression).toBe("Hours → Seconds for test feedback");

    const artifactCandidate: LensCandidate = {
      id: "c-008",
      lens: "artifact_creation",
      name: "Generate compliance report",
      description: "Auto-generates SOC2 compliance reports",
      role: "Security Engineer",
      confidence: "medium",
      source_urls: [],
      artifact_type: "Compliance Report",
    };
    expect(artifactCandidate.artifact_type).toBe("Compliance Report");
  });

  it("optional lens-specific fields are undefined when not set", () => {
    const candidate: LensCandidate = {
      id: "c-009",
      lens: "capability_mapping",
      name: "Basic candidate",
      description: "A basic candidate with no lens-specific fields",
      role: "User",
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
});

describe("LensResult", () => {
  it("wraps array of candidates with lens metadata", () => {
    const result: LensResult = {
      lens: "effort_elimination",
      candidates: [
        {
          id: "c-010",
          lens: "effort_elimination",
          name: "Skip manual deploy",
          description: "Automates deployment process",
          role: "DevOps",
          confidence: "high",
          source_urls: ["https://example.com"],
          effort_eliminated: "Manual deployment steps",
        },
      ],
      total_candidates: 1,
      execution_time_ms: 1234,
    };
    expect(result.lens).toBe("effort_elimination");
    expect(result.candidates).toHaveLength(1);
    expect(result.total_candidates).toBe(1);
    expect(result.execution_time_ms).toBe(1234);
  });
});
