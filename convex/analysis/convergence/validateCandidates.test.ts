import { describe, it, expect } from "vitest";
import {
  isFeatureAsValue,
  isVagueCandidate,
  findWithinLensDuplicates,
  hasUnverifiedFeatureRef,
  buildKnownFeaturesSet,
  parseLlmResponse,
  runValidationPipeline,
} from "./validateCandidates";
import type { LensResult } from "./types";

// ========================================
// Unit Tests: isFeatureAsValue
// ========================================

describe("isFeatureAsValue", () => {
  it("flags name starting with 'Use the'", () => {
    const result = isFeatureAsValue(
      "Use the dashboard",
      "View metrics in one place"
    );
    expect(result).not.toBeNull();
    expect(result).toContain("feature-action pattern");
  });

  it("flags name starting with 'Click the'", () => {
    const result = isFeatureAsValue(
      "Click the settings icon",
      "Configure your workspace"
    );
    expect(result).not.toBeNull();
  });

  it("flags name starting with 'Navigate to'", () => {
    const result = isFeatureAsValue(
      "Navigate to reports",
      "View detailed reports"
    );
    expect(result).not.toBeNull();
  });

  it("does not flag outcome-focused name", () => {
    const result = isFeatureAsValue(
      "Gain visibility into team velocity",
      "Track how fast your team ships"
    );
    expect(result).toBeNull();
  });

  it("does not flag action-outcome name", () => {
    const result = isFeatureAsValue(
      "Reduce deployment time",
      "Ship code 15x faster with automated CI/CD"
    );
    expect(result).toBeNull();
  });

  it("flags description starting with feature-action pattern", () => {
    const result = isFeatureAsValue(
      "Team velocity insights",
      "Open the analytics panel to see team metrics"
    );
    expect(result).not.toBeNull();
    expect(result).toContain("Description");
  });

  it("flags 'Enable' pattern", () => {
    expect(isFeatureAsValue("Enable notifications", "Get alerts")).not.toBeNull();
  });

  it("flags 'Toggle' pattern", () => {
    expect(isFeatureAsValue("Toggle dark mode", "Switch themes")).not.toBeNull();
  });

  it("flags 'Go to' pattern", () => {
    expect(isFeatureAsValue("Go to settings", "Manage preferences")).not.toBeNull();
  });
});

// ========================================
// Unit Tests: isVagueCandidate
// ========================================

describe("isVagueCandidate", () => {
  it("flags 'better visibility' phrase", () => {
    const result = isVagueCandidate(
      "Provides better visibility into team work"
    );
    expect(result).not.toBeNull();
    expect(result).toContain("better visibility");
  });

  it("flags 'improved efficiency' phrase", () => {
    const result = isVagueCandidate(
      "Delivers improved efficiency for managers"
    );
    expect(result).not.toBeNull();
    expect(result).toContain("improved efficiency");
  });

  it("flags 'actionable insights' phrase", () => {
    const result = isVagueCandidate(
      "Actionable insights for decision makers"
    );
    expect(result).not.toBeNull();
    expect(result).toContain("actionable insights");
  });

  it("does not flag specific description", () => {
    const result = isVagueCandidate(
      "Reduces deployment from 45min to 3min via CI/CD automation"
    );
    expect(result).toBeNull();
  });

  it("does not flag description with concrete metrics", () => {
    const result = isVagueCandidate(
      "Track sprint velocity across 12-week rolling window with burndown charts"
    );
    expect(result).toBeNull();
  });

  it("flags 'seamless integration' phrase", () => {
    const result = isVagueCandidate(
      "Offers seamless integration with existing tools"
    );
    expect(result).not.toBeNull();
  });

  it("is case-insensitive", () => {
    const result = isVagueCandidate("BETTER VISIBILITY into operations");
    expect(result).not.toBeNull();
  });
});

// ========================================
// Unit Tests: findWithinLensDuplicates
// ========================================

describe("findWithinLensDuplicates", () => {
  it("detects near-identical candidates", () => {
    const candidates = [
      {
        id: "a",
        name: "Reduce deployment time",
        description: "Ship code faster by reducing deployment time from 45 minutes to 3 minutes with automation",
      },
      {
        id: "b",
        name: "Reduce deployment time",
        description: "Ship code faster by reducing deployment time from 45 minutes to 3 minutes via automation",
      },
    ];

    const dupes = findWithinLensDuplicates(candidates);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].keep).toBe("a");
    expect(dupes[0].remove).toBe("b");
    expect(dupes[0].similarity).toBeGreaterThanOrEqual(0.85);
  });

  it("does not flag completely different candidates", () => {
    const candidates = [
      {
        id: "a",
        name: "Reduce deployment time",
        description: "Ship code faster by reducing deployment from 45 minutes to 3 minutes",
      },
      {
        id: "b",
        name: "Increase team morale",
        description: "Improve developer satisfaction through better tooling and processes",
      },
    ];

    const dupes = findWithinLensDuplicates(candidates);
    expect(dupes).toHaveLength(0);
  });

  it("handles three candidates with one duplicate pair", () => {
    const candidates = [
      {
        id: "a",
        name: "Track sprint velocity",
        description: "Monitor team sprint velocity over time with detailed charts",
      },
      {
        id: "b",
        name: "Monitor sprint velocity",
        description: "Track team sprint velocity over time with detailed charts",
      },
      {
        id: "c",
        name: "Reduce build failures",
        description: "Decrease CI/CD pipeline failures through better testing",
      },
    ];

    const dupes = findWithinLensDuplicates(candidates);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].keep).toBe("a");
    expect(dupes[0].remove).toBe("b");
  });

  it("returns empty for single candidate", () => {
    const candidates = [
      { id: "a", name: "Something", description: "Unique thing" },
    ];
    expect(findWithinLensDuplicates(candidates)).toHaveLength(0);
  });

  it("returns empty for empty input", () => {
    expect(findWithinLensDuplicates([])).toHaveLength(0);
  });
});

// ========================================
// Unit Tests: hasUnverifiedFeatureRef
// ========================================

describe("hasUnverifiedFeatureRef", () => {
  it("flags reference to unknown feature", () => {
    const known = new Set(["dashboard", "sprint board"]);
    const result = hasUnverifiedFeatureRef(
      "Use the Gantt Chart to plan timelines",
      known
    );
    expect(result).not.toBeNull();
    expect(result).toContain("Gantt Chart");
  });

  it("does not flag known feature", () => {
    const known = new Set(["dashboard", "sprint board"]);
    const result = hasUnverifiedFeatureRef(
      "View the Sprint Board for current progress",
      known
    );
    expect(result).toBeNull();
  });

  it("returns null when no capitalized noun phrases found", () => {
    const known = new Set(["dashboard"]);
    const result = hasUnverifiedFeatureRef(
      "reduce deployment time by 15x through automation",
      known
    );
    expect(result).toBeNull();
  });

  it("is case-insensitive for known features", () => {
    const known = new Set(["gantt chart"]);
    const result = hasUnverifiedFeatureRef(
      "Use the Gantt Chart for timelines",
      known
    );
    expect(result).toBeNull();
  });
});

// ========================================
// Unit Tests: buildKnownFeaturesSet
// ========================================

describe("buildKnownFeaturesSet", () => {
  it("extracts entity names and linked features", () => {
    const profile = {
      entities: {
        items: [
          { name: "Dashboard", type: "ui", properties: [] },
          { name: "Sprint Board", type: "ui", properties: [] },
        ],
      },
      outcomes: {
        items: [
          {
            description: "Ship faster",
            type: "functional",
            linkedFeatures: ["CI/CD Pipeline", "Deploy Preview"],
          },
        ],
      },
    };

    const features = buildKnownFeaturesSet(profile);
    expect(features.has("dashboard")).toBe(true);
    expect(features.has("sprint board")).toBe(true);
    expect(features.has("ci/cd pipeline")).toBe(true);
    expect(features.has("deploy preview")).toBe(true);
  });

  it("returns empty set for null profile", () => {
    expect(buildKnownFeaturesSet(null).size).toBe(0);
  });

  it("returns empty set for profile without entities/outcomes", () => {
    expect(buildKnownFeaturesSet({}).size).toBe(0);
  });

  it("lowercases all entries", () => {
    const profile = {
      entities: {
        items: [{ name: "Sprint Board", type: "ui", properties: [] }],
      },
    };
    const features = buildKnownFeaturesSet(profile);
    expect(features.has("sprint board")).toBe(true);
    expect(features.has("Sprint Board")).toBe(false);
  });
});

// ========================================
// Unit Tests: parseLlmResponse
// ========================================

describe("parseLlmResponse", () => {
  it("parses raw JSON array", () => {
    const json = JSON.stringify([
      { id: "a", action: "confirm_flag", validation_issue: "was vague" },
    ]);
    const result = parseLlmResponse(json);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("confirm_flag");
  });

  it("parses JSON in code fences", () => {
    const json = '```json\n[{"id": "a", "action": "remove", "validation_issue": "no outcome"}]\n```';
    const result = parseLlmResponse(json);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("remove");
  });

  it("throws on non-array JSON", () => {
    expect(() => parseLlmResponse('{"not": "array"}')).toThrow(
      "Expected JSON array"
    );
  });

  it("throws on invalid JSON", () => {
    expect(() => parseLlmResponse("not json")).toThrow();
  });
});

// ========================================
// Integration Test: runValidationPipeline
// ========================================

describe("runValidationPipeline", () => {
  const knownFeatures = new Set([
    "dashboard",
    "sprint board",
    "ci/cd pipeline",
  ]);

  // Fixture: ~10 candidates across 2 lenses with various issues
  const lensResults: LensResult[] = [
    {
      lens: "Functional Value",
      candidates: [
        {
          id: "fv-1",
          name: "Use the dashboard to view metrics",
          description: "Open the dashboard and review key performance indicators",
        },
        {
          id: "fv-2",
          name: "Reduce deployment time by 15x",
          description: "Ship code faster by reducing deployment from 45 minutes to 3 minutes via CI/CD automation",
        },
        {
          id: "fv-3",
          name: "Better team visibility",
          description: "Provides better visibility into team work and progress",
        },
        {
          id: "fv-4",
          name: "Reduce deployment time by 15x",
          description: "Ship code faster by reducing deployment from 45 minutes to 3 minutes via CI/CD automation",
        },
        {
          id: "fv-5",
          name: "Identify bottlenecks in Sprint Board",
          description: "Track Sprint Board metrics to identify workflow bottlenecks early",
        },
      ],
    },
    {
      lens: "Emotional Value",
      candidates: [
        {
          id: "ev-1",
          name: "Click the settings to configure alerts",
          description: "Navigate to settings panel and set up notification preferences",
        },
        {
          id: "ev-2",
          name: "Feel confident about releases",
          description: "Automated testing gives teams confidence every deploy is safe",
        },
        {
          id: "ev-3",
          name: "Streamlined workflow for managers",
          description: "Offers streamlined workflow that improves manager productivity",
        },
        {
          id: "ev-4",
          name: "Gantt Chart planning",
          description: "Use the Gantt Chart to plan project timelines and dependencies",
        },
        {
          id: "ev-5",
          name: "Reduce release anxiety",
          description: "Eliminate fear of broken deploys through automated safety checks",
        },
      ],
    },
  ];

  it("validateCandidates function accepts LensResult[] and returns ValidatedCandidate[]", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(10);
    for (const r of results) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("name");
      expect(r).toHaveProperty("description");
      expect(r).toHaveProperty("lens");
      expect(r).toHaveProperty("validation_status");
      expect(["valid", "rewritten", "removed"]).toContain(r.validation_status);
    }
  });

  it("flags candidates starting with 'Use the...' or 'Click the...' as feature-as-value", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    const fv1 = results.find((r) => r.id === "fv-1");
    const ev1 = results.find((r) => r.id === "ev-1");
    expect(fv1?.validation_status).not.toBe("valid");
    expect(fv1?.validation_issue).toContain("feature-action");
    expect(ev1?.validation_status).not.toBe("valid");
    expect(ev1?.validation_issue).toContain("feature-action");
  });

  it("flags candidates with vague terms", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    const fv3 = results.find((r) => r.id === "fv-3");
    const ev3 = results.find((r) => r.id === "ev-3");
    expect(fv3?.validation_status).not.toBe("valid");
    expect(fv3?.validation_issue).toContain("vague");
    expect(ev3?.validation_status).not.toBe("valid");
    expect(ev3?.validation_issue).toContain("vague");
  });

  it("merges duplicate candidates within same lens", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    // fv-2 and fv-4 are near-duplicates about reducing deployment time
    const fv2 = results.find((r) => r.id === "fv-2");
    const fv4 = results.find((r) => r.id === "fv-4");
    // One should be valid/flagged, the other should be removed as duplicate
    const statuses = [fv2?.validation_status, fv4?.validation_status];
    expect(statuses).toContain("removed");
  });

  it("flags candidates referencing features not in knowledge graph", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    const ev4 = results.find((r) => r.id === "ev-4");
    // "Gantt Chart" is not in knownFeatures
    expect(ev4?.validation_issue).toContain("Gantt Chart");
  });

  it("validation reduces total candidate count through removal and merging", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    const validOrRewritten = results.filter(
      (r) => r.validation_status !== "removed"
    );
    const removedCount = results.filter(
      (r) => r.validation_status === "removed"
    ).length;
    // Should remove some candidates (at least the duplicate + possibly others)
    expect(removedCount).toBeGreaterThanOrEqual(1);
    expect(validOrRewritten.length).toBeLessThan(10);
  });

  it("each flagged candidate includes validation_issue explaining why", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    const flagged = results.filter(
      (r) => r.validation_status !== "valid"
    );
    expect(flagged.length).toBeGreaterThan(0);
    for (const candidate of flagged) {
      expect(candidate.validation_issue).toBeDefined();
      expect(typeof candidate.validation_issue).toBe("string");
      expect(candidate.validation_issue!.length).toBeGreaterThan(0);
    }
  });

  it("clean candidates are marked as valid", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    const ev2 = results.find((r) => r.id === "ev-2");
    const ev5 = results.find((r) => r.id === "ev-5");
    expect(ev2?.validation_status).toBe("valid");
    expect(ev5?.validation_status).toBe("valid");
  });

  it("preserves lens assignment in output", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    const functionalResults = results.filter(
      (r) => r.lens === "Functional Value"
    );
    const emotionalResults = results.filter(
      (r) => r.lens === "Emotional Value"
    );
    expect(functionalResults).toHaveLength(5);
    expect(emotionalResults).toHaveLength(5);
  });
});
