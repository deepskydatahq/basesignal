import { describe, it, expect } from "vitest";
import {
  formatRelativeTime,
  formatProfileOverview,
  formatSection,
  formatEvidence,
  formatActivation,
  formatCompletenessChange,
} from "./formatters.js";
import type { ProductProfile } from "./types.js";

describe("formatRelativeTime", () => {
  it("returns 'just now' for recent timestamps", () => {
    expect(formatRelativeTime(Date.now() - 5_000)).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(formatRelativeTime(Date.now() - 3 * 60_000)).toBe("3 minutes ago");
  });

  it("returns singular minute", () => {
    expect(formatRelativeTime(Date.now() - 60_000)).toBe("1 minute ago");
  });

  it("returns hours ago", () => {
    expect(formatRelativeTime(Date.now() - 5 * 3_600_000)).toBe(
      "5 hours ago"
    );
  });

  it("returns singular hour", () => {
    expect(formatRelativeTime(Date.now() - 3_600_000)).toBe("1 hour ago");
  });

  it("returns days ago", () => {
    expect(formatRelativeTime(Date.now() - 3 * 86_400_000)).toBe(
      "3 days ago"
    );
  });

  it("returns weeks ago", () => {
    expect(formatRelativeTime(Date.now() - 14 * 86_400_000)).toBe(
      "2 weeks ago"
    );
  });

  it("returns ISO date for old timestamps", () => {
    const old = new Date("2024-01-15T00:00:00Z").getTime();
    expect(formatRelativeTime(old)).toBe("2024-01-15");
  });
});

describe("formatEvidence", () => {
  it("returns empty string for empty array", () => {
    expect(formatEvidence([])).toBe("");
  });

  it("returns markdown table for evidence", () => {
    const result = formatEvidence([
      { url: "https://example.com", excerpt: "Some text" },
    ]);
    expect(result).toContain("| URL | Excerpt |");
    expect(result).toContain("| https://example.com | Some text |");
  });
});

describe("formatActivation", () => {
  it("formats legacy activation", () => {
    const legacy = {
      criteria: ["Sign up", "Create project"],
      timeWindow: "7 days",
      reasoning: "Users need to complete setup",
      confidence: 0.8,
      source: "website",
      evidence: [{ url: "https://a.com", excerpt: "text" }],
    };
    const result = formatActivation(legacy);
    expect(result).toContain("### Activation");
    expect(result).toContain("**Confidence:** 80%");
    expect(result).toContain("- Sign up");
    expect(result).toContain("- Create project");
    expect(result).toContain("**Time Window:** 7 days");
  });

  it("formats multi-level activation", () => {
    const multiLevel = {
      levels: [
        {
          level: 1,
          name: "Basic",
          signalStrength: "weak",
          criteria: [{ action: "login", count: 1 }],
          reasoning: "Just logged in",
          confidence: 0.7,
          evidence: [],
        },
        {
          level: 2,
          name: "Active",
          signalStrength: "strong",
          criteria: [
            { action: "create_project", count: 1, timeWindow: "7 days" },
          ],
          reasoning: "Created a project",
          confidence: 0.9,
          evidence: [],
        },
      ],
      primaryActivation: 2,
      overallConfidence: 0.85,
    };
    const result = formatActivation(multiLevel);
    expect(result).toContain("Multi-Level");
    expect(result).toContain("**Overall Confidence:** 85%");
    expect(result).toContain("**Primary Activation Level:** 2");
    expect(result).toContain("| 1 | Basic | weak |");
    expect(result).toContain("create_project x1 (7 days)");
  });

  it("returns fallback for null data", () => {
    expect(formatActivation(null)).toContain("No activation data");
  });
});

describe("formatSection", () => {
  it("formats identity section", () => {
    const result = formatSection("identity", {
      productName: "Acme",
      description: "A SaaS",
      targetCustomer: "Teams",
      businessModel: "B2B",
      confidence: 0.9,
      evidence: [],
    });
    expect(result).toContain("### Identity");
    expect(result).toContain("**Product:** Acme");
    expect(result).toContain("**Confidence:** 90%");
  });

  it("formats revenue section", () => {
    const result = formatSection("revenue", {
      model: "Subscription",
      hasFreeTier: true,
      tiers: [{ name: "Free", price: "$0", features: ["basic"] }],
      confidence: 0.7,
      evidence: [],
    });
    expect(result).toContain("### Revenue");
    expect(result).toContain("**Model:** Subscription");
    expect(result).toContain("**Free Tier:** Yes");
  });

  it("formats entities section", () => {
    const result = formatSection("entities", {
      items: [{ name: "User", type: "core", properties: ["email"] }],
      relationships: [{ from: "User", to: "Project", type: "owns" }],
      confidence: 0.8,
      evidence: [],
    });
    expect(result).toContain("### Entities");
    expect(result).toContain("**Entities:** 1 item");
    expect(result).toContain("**User** (core)");
  });

  it("formats journey section", () => {
    const result = formatSection("journey", {
      stages: [
        { name: "Onboarding", description: "first steps", order: 1 },
        { name: "Active", description: "using daily", order: 2 },
      ],
      confidence: 0.75,
      evidence: [],
    });
    expect(result).toContain("### Journey");
    expect(result).toContain("Onboarding -> Active");
  });

  it("formats outcomes section", () => {
    const result = formatSection("outcomes", {
      items: [
        {
          description: "Increase retention",
          type: "business",
          linkedFeatures: ["notifications"],
        },
      ],
      confidence: 0.6,
      evidence: [],
    });
    expect(result).toContain("### Outcomes");
    expect(result).toContain("**Items:** 1");
  });

  it("formats metrics section", () => {
    const result = formatSection("metrics", {
      items: [
        {
          name: "DAU",
          category: "engagement",
          formula: "count(daily_active)",
          linkedTo: ["active"],
        },
      ],
      confidence: 0.65,
      evidence: [],
    });
    expect(result).toContain("### Metrics");
    expect(result).toContain("**DAU** (engagement): count(daily_active)");
  });

  it("formats lifecycle definition (firstValue)", () => {
    const result = formatSection("firstValue", {
      description: "First value moment",
      criteria: ["complete onboarding", "see dashboard"],
      reasoning: "Users find value quickly",
      confidence: 0.8,
      source: "analysis",
      evidence: [],
    });
    expect(result).toContain("### First Value");
    expect(result).toContain("- complete onboarding");
  });

  it("delegates activation to formatActivation", () => {
    const result = formatSection("activation", {
      criteria: ["sign up"],
      reasoning: "first step",
      confidence: 0.8,
      source: "website",
      evidence: [],
    });
    expect(result).toContain("### Activation");
  });

  it("handles empty/null data gracefully", () => {
    const result = formatSection("identity", null);
    expect(result).toContain("No identity data");
  });
});

describe("formatProfileOverview", () => {
  it("formats a full profile", () => {
    const profile = {
      identity: {
        productName: "Acme App",
        description: "A SaaS",
        targetCustomer: "Teams",
        businessModel: "B2B",
        confidence: 0.9,
        evidence: [],
      },
      revenue: {
        model: "Subscription",
        hasFreeTier: true,
        tiers: [],
        confidence: 0.7,
        evidence: [],
      },
      completeness: 0.5,
      overallConfidence: 0.8,
    } as ProductProfile;

    const result = formatProfileOverview(profile);
    expect(result).toContain("## Acme App -- Product Profile");
    expect(result).toContain("**Completeness:** 50%");
    expect(result).toContain("**Confidence:** 80%");
    expect(result).toContain("### Identity");
    expect(result).toContain("### Revenue");
    expect(result).toContain("### Missing Sections");
  });

  it("shows all missing sections for empty profile", () => {
    const profile = {
      completeness: 0,
      overallConfidence: 0,
    } as ProductProfile;

    const result = formatProfileOverview(profile);
    expect(result).toContain("Unknown Product");
    expect(result).toContain("### Missing Sections");
    expect(result).toContain("- Identity");
    expect(result).toContain("- Revenue");
    expect(result).toContain("- Entities");
    expect(result).toContain("- Journey");
    expect(result).toContain("- Outcomes");
    expect(result).toContain("- Metrics");
    expect(result).toContain("- Activation");
    expect(result).toContain("- First Value");
    expect(result).toContain("- Active");
    expect(result).toContain("- At Risk");
    expect(result).toContain("- Churn");
  });

  it("includes definitions in overview", () => {
    const profile = {
      identity: {
        productName: "Test",
        description: "A",
        targetCustomer: "B",
        businessModel: "C",
        confidence: 0.8,
        evidence: [],
      },
      definitions: {
        activation: {
          criteria: ["sign up"],
          reasoning: "test",
          confidence: 0.7,
          source: "web",
          evidence: [],
        },
      },
      completeness: 0.2,
      overallConfidence: 0.75,
    } as ProductProfile;

    const result = formatProfileOverview(profile);
    expect(result).toContain("### Activation");
  });
});

describe("formatCompletenessChange", () => {
  it("shows change when values differ", () => {
    expect(formatCompletenessChange(0.6, 0.7)).toBe(
      "Completeness: 60% -> 70%"
    );
  });

  it("shows unchanged when values are equal", () => {
    expect(formatCompletenessChange(0.8, 0.8)).toBe(
      "Completeness: 80% (unchanged)"
    );
  });

  it("shows decrease", () => {
    expect(formatCompletenessChange(0.9, 0.7)).toBe(
      "Completeness: 90% -> 70%"
    );
  });
});
