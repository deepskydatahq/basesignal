import { describe, it, expect, vi, afterEach } from "vitest";
import type { ProductProfile } from "@basesignal/storage";

const mockWriteFileSync = vi.fn();
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  };
});

const { formatOutput, formatSummary, formatMarkdown, writeOutputFile } = await import(
  "./formatters.js"
);

function fullProfile(): ProductProfile {
  return {
    id: "profile-123",
    identity: {
      productName: "Linear",
      description: "Project management for modern teams",
      targetCustomer: "Software engineering teams",
      businessModel: "SaaS",
      industry: "Developer Tools",
      confidence: 0.9,
      evidence: [{ url: "https://linear.app", excerpt: "The issue tracker..." }],
    },
    metadata: {
      url: "https://linear.app",
    },
    revenue: {
      model: "Subscription",
      hasFreeTier: true,
      tiers: [
        { name: "Free", price: "$0", features: ["Basic issues", "Up to 250 issues"] },
        { name: "Standard", price: "$8/user/mo", features: ["Unlimited issues", "Cycles"] },
        { name: "Plus", price: "$14/user/mo", features: ["Everything in Standard", "Priority support"] },
      ],
      confidence: 0.85,
    },
    journey: {
      stages: [
        { name: "Discovery", order: 1, description: "Find Linear through search or referral" },
        { name: "Signup", order: 2, description: "Create account and workspace" },
        { name: "Onboarding", order: 3, description: "Create first project and issues" },
        { name: "Active Use", order: 4, description: "Daily issue management" },
      ],
      confidence: 0.8,
    },
    lifecycle_states: {
      states: [
        { name: "new", definition: "First visit", time_window: "0-7 days" },
        { name: "activated", definition: "Completed onboarding", time_window: "7-14 days" },
        { name: "engaged", definition: "Regular usage", time_window: "14-30 days" },
        { name: "at_risk", definition: "Declining engagement", time_window: "7+ days inactive" },
        { name: "dormant", definition: "Stopped engaging", time_window: "30+ days inactive" },
        { name: "churned", definition: "Abandoned product", time_window: "60+ days inactive" },
        { name: "resurrected", definition: "Returned after churn", time_window: "return after 30+ days" },
      ],
      transitions: [
        { from_state: "new", to_state: "activated", trigger_conditions: ["creates first board"], typical_timeframe: "1-7 days" },
      ],
      confidence: 0.75,
      sources: ["identity", "activation_levels"],
    },
    metrics: {
      items: [
        { name: "Weekly Active Users", category: "engagement", formula: "count(distinct users active in 7d)" },
        { name: "Activation Rate", category: "activation", formula: "users with 5+ issues / total signups" },
        { name: "Retention Rate", category: "retention" },
      ],
      confidence: 0.75,
    },
    completeness: 0.82,
    overallConfidence: 0.8,
  };
}

function partialProfile(): ProductProfile {
  return {
    id: "profile-456",
    identity: {
      productName: "Acme",
      description: "A tool",
      targetCustomer: "Everyone",
      businessModel: "Marketplace",
      confidence: 0.5,
      evidence: [],
    },
    completeness: 0.3,
  };
}

function emptyProfile(): ProductProfile {
  return {
    completeness: 0,
  };
}

describe("formatSummary", () => {
  afterEach(() => {
    mockWriteFileSync.mockReset();
  });

  it("produces expected output for a full profile", () => {
    const output = formatSummary(fullProfile());
    expect(output).toContain("Product: Linear");
    expect(output).toContain("URL: https://linear.app");
    expect(output).toContain("Target Customer: Software engineering teams");
    expect(output).toContain("Business Model: SaaS");
    expect(output).toContain("Pricing Model: Subscription");
    expect(output).toContain("Plans: Free, Standard, Plus");
    expect(output).toContain("1. Discovery");
    expect(output).toContain("2. Signup");
    expect(output).toContain("3. Onboarding");
    expect(output).toContain("4. Active Use");
    expect(output).toContain("Metrics: 3 suggested");
    expect(output).toContain("Profile ID: profile-123");
    expect(output).toContain("Completeness: 82%");
  });

  it("includes lifecycle states listing when present", () => {
    const output = formatSummary(fullProfile());
    expect(output).toContain("Lifecycle States:");
    expect(output).toContain("new (0-7 days)");
    expect(output).toContain("activated (7-14 days)");
    expect(output).toContain("churned (60+ days inactive)");
    expect(output).toContain("resurrected (return after 30+ days)");
  });

  it("omits lifecycle states when absent", () => {
    const output = formatSummary(partialProfile());
    expect(output).not.toContain("Lifecycle States:");
  });

  it("handles partial profile (missing revenue, journey, metrics)", () => {
    const output = formatSummary(partialProfile());
    expect(output).toContain("Product: Acme");
    expect(output).toContain("Business Model: Marketplace");
    expect(output).not.toContain("Pricing Model");
    expect(output).not.toContain("Journey Stages");
    expect(output).not.toContain("Metrics:");
    expect(output).toContain("Completeness: 30%");
  });

  it("handles empty profile", () => {
    const output = formatSummary(emptyProfile());
    expect(output).toContain("Product: Unknown Product");
    expect(output).toContain("Completeness: 0%");
    expect(output).not.toContain("Journey Stages");
  });
});

describe("formatMarkdown", () => {
  it("produces valid markdown with all sections for full profile", () => {
    const output = formatMarkdown(fullProfile());
    expect(output).toContain("# Linear");
    expect(output).toContain("## Core Identity");
    expect(output).toContain("**Target Customer:** Software engineering teams");
    expect(output).toContain("## Revenue Architecture");
    expect(output).toContain("| Free | $0 |");
    expect(output).toContain("## User Journey");
    expect(output).toContain("1. **Discovery**");
    expect(output).toContain("## Suggested Metrics");
    expect(output).toContain("| Weekly Active Users | engagement |");
    expect(output).toContain("Profile ID: profile-123");
    expect(output).toContain("Completeness: 82%");
  });

  it("includes lifecycle states table when present", () => {
    const output = formatMarkdown(fullProfile());
    expect(output).toContain("## Lifecycle States");
    expect(output).toContain("| State | Definition | Time Window |");
    expect(output).toContain("| new | First visit | 0-7 days |");
    expect(output).toContain("| churned | Abandoned product | 60+ days inactive |");
  });

  it("omits lifecycle states table when absent", () => {
    const output = formatMarkdown(partialProfile());
    expect(output).not.toContain("## Lifecycle States");
  });

  it("omits sections when data is missing", () => {
    const output = formatMarkdown(partialProfile());
    expect(output).toContain("# Acme");
    expect(output).toContain("## Core Identity");
    expect(output).not.toContain("## Revenue Architecture");
    expect(output).not.toContain("## User Journey");
    expect(output).not.toContain("## Suggested Metrics");
  });

  it("handles empty profile gracefully", () => {
    const output = formatMarkdown(emptyProfile());
    expect(output).toContain("# Unknown Product");
    expect(output).toContain("Completeness: 0%");
  });
});

describe("formatOutput", () => {
  it("returns valid JSON string for json format", () => {
    const output = formatOutput(fullProfile(), "json");
    const parsed = JSON.parse(output);
    expect(parsed.identity.productName).toBe("Linear");
  });

  it("returns summary text for summary format", () => {
    const output = formatOutput(fullProfile(), "summary");
    expect(output).toContain("Product: Linear");
    expect(output).toContain("Completeness:");
  });

  it("returns markdown text for markdown format", () => {
    const output = formatOutput(fullProfile(), "markdown");
    expect(output).toContain("# Linear");
    expect(output).toContain("## Core Identity");
  });
});

describe("writeOutputFile", () => {
  afterEach(() => {
    mockWriteFileSync.mockReset();
  });

  it("writes JSON content for .json extension", () => {
    writeOutputFile("profile.json", fullProfile());
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      "profile.json",
      expect.any(String),
      "utf-8",
    );
    const written = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.identity.productName).toBe("Linear");
  });

  it("writes markdown content for .md extension", () => {
    writeOutputFile("profile.md", fullProfile());
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      "profile.md",
      expect.any(String),
      "utf-8",
    );
    const written = mockWriteFileSync.mock.calls[0][1] as string;
    expect(written).toContain("# Linear");
  });

  it("defaults to JSON for non-.md extension", () => {
    writeOutputFile("profile.txt", fullProfile());
    const written = mockWriteFileSync.mock.calls[0][1] as string;
    expect(() => JSON.parse(written)).not.toThrow();
  });
});
