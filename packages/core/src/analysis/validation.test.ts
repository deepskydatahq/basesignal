import { describe, it, expect } from "vitest";
import {
  isFeatureAsValue,
  isVagueCandidate,
  isMarketingLanguage,
  findWithinLensDuplicates,
  hasUnverifiedFeatureRef,
  buildKnownFeaturesSet,
  runValidationPipeline,
  MARKETING_LANGUAGE_PATTERNS,
  ABSTRACT_OUTCOME_PATTERNS,
} from "./validation";
import type { ValidationLensResult } from "./validation";

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
// Unit Tests: MARKETING_LANGUAGE_PATTERNS & ABSTRACT_OUTCOME_PATTERNS
// ========================================

describe("MARKETING_LANGUAGE_PATTERNS", () => {
  it("contains 9 marketing verb patterns", () => {
    expect(MARKETING_LANGUAGE_PATTERNS).toHaveLength(9);
  });

  it("includes automate, streamline, optimize, leverage, enhance, empower, accelerate, revolutionize, transform", () => {
    const verbs = [
      "automate",
      "streamline",
      "optimize",
      "leverage",
      "enhance",
      "empower",
      "accelerate",
      "revolutionize",
      "transform",
    ];
    for (const verb of verbs) {
      const matches = MARKETING_LANGUAGE_PATTERNS.some((p) => p.test(verb));
      expect(matches).toBe(true);
    }
  });
});

describe("ABSTRACT_OUTCOME_PATTERNS", () => {
  it("contains 6 abstract outcome phrases", () => {
    expect(ABSTRACT_OUTCOME_PATTERNS).toHaveLength(6);
  });

  it("includes at scale, cross-functional, end-to-end, enterprise-grade, best-in-class, next-generation", () => {
    const phrases = [
      "at scale",
      "cross-functional",
      "end-to-end",
      "enterprise-grade",
      "best-in-class",
      "next-generation",
    ];
    for (const phrase of phrases) {
      expect(ABSTRACT_OUTCOME_PATTERNS).toContain(phrase);
    }
  });
});

// ========================================
// Unit Tests: isMarketingLanguage
// ========================================

describe("isMarketingLanguage", () => {
  const emptyFeatures = new Set<string>();

  it("flags 'Automate protection of sensitive business information'", () => {
    const result = isMarketingLanguage(
      "Automate protection of sensitive business information",
      "Automatically protect sensitive data across the organization",
      emptyFeatures
    );
    expect(result).not.toBeNull();
    expect(result).toContain("marketing language");
  });

  it("does NOT flag 'Set board-level permissions to restrict editing'", () => {
    const result = isMarketingLanguage(
      "Set board-level permissions to restrict editing",
      "Configure who can edit specific boards by setting permission levels",
      emptyFeatures
    );
    expect(result).toBeNull();
  });

  it("flags 'Streamline cross-functional collaboration workflows'", () => {
    const result = isMarketingLanguage(
      "Streamline cross-functional collaboration workflows",
      "Enable better collaboration across teams",
      emptyFeatures
    );
    expect(result).not.toBeNull();
  });

  it("flags candidates with 'leverage'", () => {
    const result = isMarketingLanguage(
      "Leverage AI for faster decisions",
      "Use artificial intelligence to speed up decision-making",
      emptyFeatures
    );
    expect(result).not.toBeNull();
    expect(result).toContain("Leverage");
  });

  it("flags candidates with abstract outcome 'at scale'", () => {
    const result = isMarketingLanguage(
      "Deploy protection at scale",
      "Roll out data protection at scale across the enterprise",
      emptyFeatures
    );
    expect(result).not.toBeNull();
    expect(result).toContain("at scale");
  });

  it("flags candidates with abstract outcome 'enterprise-grade'", () => {
    const result = isMarketingLanguage(
      "Enterprise-grade security controls",
      "Implement enterprise-grade security for all users",
      emptyFeatures
    );
    expect(result).not.toBeNull();
    expect(result).toContain("enterprise-grade");
  });

  it("does NOT flag when candidate references a known product feature", () => {
    const knownFeatures = new Set(["permission settings"]);
    const result = isMarketingLanguage(
      "Streamline permission settings configuration",
      "Quickly configure permission settings for your team",
      knownFeatures
    );
    expect(result).toBeNull();
  });

  it("does NOT flag purely experiential language", () => {
    const result = isMarketingLanguage(
      "Feel confident about data safety",
      "Know that sensitive data is protected by role-based access controls",
      emptyFeatures
    );
    expect(result).toBeNull();
  });

  it("is case-insensitive for marketing verbs", () => {
    const result = isMarketingLanguage(
      "OPTIMIZE your workflow",
      "Make your workflow more efficient",
      emptyFeatures
    );
    expect(result).not.toBeNull();
  });

  it("is case-insensitive for abstract outcome phrases", () => {
    const result = isMarketingLanguage(
      "Security At Scale",
      "Protect data At Scale across the organization",
      emptyFeatures
    );
    expect(result).not.toBeNull();
    expect(result).toContain("at scale");
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
// Integration Test: runValidationPipeline
// ========================================

describe("runValidationPipeline", () => {
  const knownFeatures = new Set([
    "dashboard",
    "sprint board",
    "ci/cd pipeline",
  ]);

  // Fixture: ~10 candidates across 2 lenses with various issues
  const lensResults: ValidationLensResult[] = [
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

// ========================================
// Integration Test: Marketing Language in Pipeline
// ========================================

describe("runValidationPipeline with marketing language candidates", () => {
  const knownFeatures = new Set(["board permissions"]);

  const lensResults: ValidationLensResult[] = [
    {
      lens: "Functional Value",
      candidates: [
        {
          id: "ml-1",
          name: "Automate protection of sensitive business information",
          description: "Automatically safeguard critical business data from unauthorized access",
        },
        {
          id: "ml-2",
          name: "Set board-level permissions to restrict editing",
          description: "Configure board permissions to control who can edit specific content",
        },
        {
          id: "ml-3",
          name: "Streamline cross-functional collaboration workflows",
          description: "Enable faster collaboration across teams and departments",
        },
        {
          id: "ml-4",
          name: "Feel confident about data safety",
          description: "Know your data is safe with role-based access controls",
        },
      ],
    },
  ];

  it("flags 'Automate protection of sensitive business information' as marketing language", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    const ml1 = results.find((r) => r.id === "ml-1");
    expect(ml1?.validation_status).not.toBe("valid");
    expect(ml1?.validation_issue).toContain("marketing language");
  });

  it("does NOT flag 'Set board-level permissions to restrict editing' (references known feature)", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    const ml2 = results.find((r) => r.id === "ml-2");
    expect(ml2?.validation_status).toBe("valid");
  });

  it("flags 'Streamline cross-functional collaboration workflows' as marketing language", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    const ml3 = results.find((r) => r.id === "ml-3");
    expect(ml3?.validation_status).not.toBe("valid");
    expect(ml3?.validation_issue).toContain("marketing language");
  });

  it("does NOT flag experiential language without marketing terms", () => {
    const results = runValidationPipeline(lensResults, knownFeatures);
    const ml4 = results.find((r) => r.id === "ml-4");
    expect(ml4?.validation_status).toBe("valid");
  });

  it("full pipeline runs without errors", () => {
    expect(() => runValidationPipeline(lensResults, knownFeatures)).not.toThrow();
    const results = runValidationPipeline(lensResults, knownFeatures);
    expect(results).toHaveLength(4);
  });
});
