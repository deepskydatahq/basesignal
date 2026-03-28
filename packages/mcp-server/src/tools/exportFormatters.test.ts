import { describe, it, expect } from "vitest";
import {
  exportProfileAsJson,
  exportProfileAsMarkdown,
} from "./exportFormatters.js";
import type { ProductProfile } from "./types.js";

// Fixture: full profile matching the storage ProductProfile shape
const fullProfile: ProductProfile = {
  completeness: 0.8,
  overallConfidence: 0.75,
  identity: {
    productName: "Acme Analytics",
    description: "Product analytics for SaaS teams",
    targetCustomer: "Product managers at B2B SaaS companies",
    businessModel: "SaaS subscription",
    industry: "Analytics",
    companyStage: "Growth",
    confidence: 0.9,
    evidence: [
      { url: "https://acme.io", excerpt: "Built for product teams" },
    ],
  },
  revenue: {
    model: "subscription",
    billingUnit: "seat",
    hasFreeTier: true,
    tiers: [
      { name: "Free", price: "$0", features: ["5 users", "1 project"] },
      {
        name: "Pro",
        price: "$49/mo",
        features: ["Unlimited users", "10 projects"],
      },
    ],
    expansionPaths: ["seat expansion", "plan upgrade"],
    contractionRisks: ["seat reduction"],
    confidence: 0.85,
    evidence: [
      { url: "https://acme.io/pricing", excerpt: "Starting at $0" },
    ],
  },
  measurement_spec: {
    perspectives: {
      product: {
        entities: [
          {
            id: "user",
            name: "User",
            description: "Primary product user",
            isHeartbeat: true,
            properties: [
              { name: "email", type: "string", description: "User email", isRequired: true },
              { name: "role", type: "string", description: "User role", isRequired: false },
            ],
            activities: [
              { name: "user_created", properties_supported: ["email"], activity_properties: [] },
            ],
          },
          {
            id: "project",
            name: "Project",
            description: "A workspace project",
            isHeartbeat: false,
            properties: [
              { name: "name", type: "string", description: "Project name", isRequired: true },
            ],
            activities: [],
          },
        ],
      },
      interaction: {
        entities: [
          {
            name: "PageView",
            properties: [
              { name: "url", type: "string", description: "Page URL", isRequired: true },
            ],
            activities: [
              { name: "page_viewed", properties_supported: ["url"] },
            ],
          },
        ],
      },
    },
    confidence: 0.8,
  },
  journey: {
    stages: [
      { name: "Sign Up", description: "Create account", order: 1 },
      { name: "Setup", description: "Configure first project", order: 2 },
      { name: "First Insight", description: "See first analytics", order: 3 },
    ],
    confidence: 0.7,
    evidence: [],
  },
  definitions: {
    activation: {
      levels: [
        {
          level: 1,
          name: "Basic Setup",
          signalStrength: "weak",
          criteria: [{ action: "create_project", count: 1 }],
          reasoning: "Minimum engagement",
          confidence: 0.7,
          evidence: [],
        },
        {
          level: 2,
          name: "First Insight",
          signalStrength: "strong",
          criteria: [
            { action: "view_dashboard", count: 3, timeWindow: "7d" },
          ],
          reasoning: "Shows repeated value",
          confidence: 0.8,
          evidence: [],
        },
      ],
      primaryActivation: 2,
      overallConfidence: 0.75,
    },
    active: {
      criteria: ["Login 3+ times per week", "View dashboard"],
      timeWindow: "7 days",
      reasoning: "Regular engagement pattern",
      confidence: 0.8,
      source: "usage patterns",
      evidence: [],
    },
  },
  outcomes: {
    items: [
      {
        description: "Data-driven decisions",
        type: "business",
        linkedFeatures: ["dashboard", "reports"],
      },
    ],
    confidence: 0.7,
    evidence: [],
  },
  metrics: {
    items: [
      {
        name: "Weekly Active Users",
        category: "engagement",
        formula: "count(distinct users with session in 7d)",
        linkedTo: ["active definition"],
      },
    ],
    confidence: 0.75,
    evidence: [],
  },
};

describe("exportProfileAsJson", () => {
  it("produces valid parseable JSON", () => {
    const json = exportProfileAsJson(fullProfile);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("includes basesignal_version", () => {
    const json = exportProfileAsJson(fullProfile);
    const parsed = JSON.parse(json);
    expect(parsed.basesignal_version).toBe("1.0");
  });

  it("preserves all profile data", () => {
    const json = exportProfileAsJson(fullProfile);
    const parsed = JSON.parse(json);
    expect(parsed.identity.productName).toBe("Acme Analytics");
    expect(parsed.revenue.tiers).toHaveLength(2);
  });

  it("handles empty profile", () => {
    const empty: ProductProfile = { completeness: 0, overallConfidence: 0 };
    const json = exportProfileAsJson(empty);
    const parsed = JSON.parse(json);
    expect(parsed.basesignal_version).toBe("1.0");
    expect(parsed.completeness).toBe(0);
  });
});

describe("exportProfileAsMarkdown", () => {
  it("includes all section headings for full profile", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("## Core Identity");
    expect(md).toContain("## Revenue Architecture");
    expect(md).toContain("## Entity Model");
    expect(md).toContain("## Journey");
    expect(md).toContain("## Definitions");
    expect(md).toContain("## Outcomes");
    expect(md).toContain("## Metrics");
  });

  it("shows product name in title", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("# Acme Analytics - Product Profile");
  });

  it("shows confidence scores", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toMatch(/\*\*Confidence:\*\* \d+%/);
  });

  it("includes evidence in collapsible blocks", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("<details><summary>Evidence</summary>");
    expect(md).toContain("https://acme.io");
  });

  it("renders multi-level activation definitions", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("Level 1:");
    expect(md).toContain("Level 2:");
    expect(md).toContain("signal");
  });

  it("handles partial profiles gracefully", () => {
    const partial: ProductProfile = {
      completeness: 0.3,
      overallConfidence: 0.5,
    };
    const md = exportProfileAsMarkdown(partial);
    expect(md).toContain("*Not yet analyzed.*");
    expect(md).not.toContain("undefined");
    expect(md).not.toContain("null");
  });

  it("handles empty profile without throwing", () => {
    const empty: ProductProfile = { completeness: 0, overallConfidence: 0 };
    expect(() => exportProfileAsMarkdown(empty)).not.toThrow();
  });

  it("includes footer with export date", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("Exported from Basesignal on");
  });

  it("renders revenue tiers as table", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("| Free | $0 |");
    expect(md).toContain("| Pro | $49/mo |");
  });

  it("renders journey stages as table", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("| Sign Up | Create account |");
    expect(md).toContain("| Setup | Configure first project |");
  });

  it("renders measurement_spec perspectives", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    // Product entities with heartbeat flag
    expect(md).toContain("### Product Entities");
    expect(md).toContain("**User** (heartbeat)");
    expect(md).toContain("**Project**:");
    // Product entity activities
    expect(md).toContain("Activity: user_created");
    // Interaction entities
    expect(md).toContain("### Interaction Entities");
    expect(md).toContain("**PageView**:");
    // Confidence
    expect(md).toContain("**Confidence:** 80%");
  });

  it("falls back to old entities format when measurement_spec is absent", () => {
    const legacyProfile: ProductProfile = {
      completeness: 0.5,
      overallConfidence: 0.6,
      entities: {
        items: [
          { name: "User", type: "actor", properties: ["email", "role"] },
          { name: "Project", type: "resource", properties: ["name", "status"] },
        ],
        relationships: [{ from: "User", to: "Project", type: "owns" }],
        confidence: 0.8,
        evidence: [],
      },
    };
    const md = exportProfileAsMarkdown(legacyProfile);
    expect(md).toContain("User -> Project (owns)");
    expect(md).toContain("**User** (actor)");
    expect(md).not.toContain("### Product Entities");
  });

  it("renders outcomes with linked features", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("Data-driven decisions");
    expect(md).toContain("dashboard, reports");
  });

  it("renders metrics with formula", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("Weekly Active Users");
    expect(md).toContain("count(distinct users with session in 7d)");
  });
});
