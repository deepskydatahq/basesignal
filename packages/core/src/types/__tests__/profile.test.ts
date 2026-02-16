import { describe, it, expect } from "vitest";
import { SCHEMA_VERSION } from "../profile";
import type {
  ProductProfile,
  CoreIdentity,
  PricingTier,
  RevenueArchitecture,
  EntityItem,
  EntityRelationship,
  EntityModel,
  JourneyStage,
  UserJourney,
  ActivationCriterion,
  ActivationLevelDef,
  LegacyActivationDefinition,
  MultiLevelActivationDefinition,
  ActivationDefinition,
  LifecycleDefinition,
  DefinitionsMap,
  OutcomeItem,
  OutcomesSection,
  MetricItem,
  MetricsSection,
} from "../profile";

describe("SCHEMA_VERSION", () => {
  it("equals '1.0'", () => {
    expect(SCHEMA_VERSION).toBe("1.0");
  });
});

describe("CoreIdentity", () => {
  it("has all required fields", () => {
    const identity: CoreIdentity = {
      productName: "Basesignal",
      description: "Product P&L measurement",
      targetCustomer: "Product leaders",
      businessModel: "SaaS",
      confidence: 0.9,
      evidence: [{ url: "https://basesignal.com", excerpt: "Measure your product" }],
    };
    expect(identity.productName).toBe("Basesignal");
    expect(identity.evidence).toHaveLength(1);
  });

  it("supports optional fields", () => {
    const identity: CoreIdentity = {
      productName: "Test",
      description: "Test",
      targetCustomer: "Users",
      businessModel: "SaaS",
      industry: "Technology",
      companyStage: "Series A",
      confidence: 0.8,
      evidence: [],
    };
    expect(identity.industry).toBe("Technology");
    expect(identity.companyStage).toBe("Series A");
  });
});

describe("RevenueArchitecture", () => {
  it("has tiers with pricing", () => {
    const tier: PricingTier = { name: "Pro", price: "$49/mo", features: ["Feature A"] };
    const revenue: RevenueArchitecture = {
      model: "subscription",
      hasFreeTier: true,
      tiers: [tier],
      expansionPaths: ["seat expansion"],
      contractionRisks: ["churn"],
      confidence: 0.85,
      evidence: [],
    };
    expect(revenue.tiers).toHaveLength(1);
    expect(revenue.hasFreeTier).toBe(true);
  });

  it("supports optional billingUnit", () => {
    const revenue: RevenueArchitecture = {
      model: "subscription",
      billingUnit: "seat",
      hasFreeTier: false,
      tiers: [],
      expansionPaths: [],
      contractionRisks: [],
      confidence: 0.7,
      evidence: [],
    };
    expect(revenue.billingUnit).toBe("seat");
  });
});

describe("EntityModel", () => {
  it("has items and relationships", () => {
    const item: EntityItem = { name: "User", type: "primary", properties: ["email", "name"] };
    const rel: EntityRelationship = { from: "User", to: "Project", type: "owns" };
    const model: EntityModel = {
      items: [item],
      relationships: [rel],
      confidence: 0.8,
      evidence: [],
    };
    expect(model.items).toHaveLength(1);
    expect(model.relationships).toHaveLength(1);
  });
});

describe("UserJourney", () => {
  it("has ordered stages", () => {
    const stage: JourneyStage = { name: "Onboarding", description: "Get started", order: 1 };
    const journey: UserJourney = {
      stages: [stage],
      confidence: 0.75,
      evidence: [],
    };
    expect(journey.stages).toHaveLength(1);
    expect(journey.stages[0].order).toBe(1);
  });
});

describe("ActivationDefinition union", () => {
  it("supports legacy format", () => {
    const legacy: LegacyActivationDefinition = {
      criteria: ["Sign up", "Create first project"],
      timeWindow: "7 days",
      reasoning: "Standard onboarding path",
      confidence: 0.8,
      source: "website",
      evidence: [{ url: "https://example.com", excerpt: "Get started" }],
    };
    const def: ActivationDefinition = legacy;
    expect("criteria" in def).toBe(true);
  });

  it("supports multi-level format", () => {
    const criterion: ActivationCriterion = { action: "create_board", count: 1 };
    const levelDef: ActivationLevelDef = {
      level: 1,
      name: "Explorer",
      signalStrength: "weak",
      criteria: [criterion],
      reasoning: "Initial exploration",
      confidence: 0.7,
      evidence: [{ url: "https://example.com", excerpt: "Create your first board" }],
    };
    const multiLevel: MultiLevelActivationDefinition = {
      levels: [levelDef],
      primaryActivation: 2,
      overallConfidence: 0.75,
    };
    const def: ActivationDefinition = multiLevel;
    expect("levels" in def).toBe(true);
  });
});

describe("DefinitionsMap", () => {
  it("has all optional lifecycle fields", () => {
    const lifecycle: LifecycleDefinition = {
      criteria: ["3+ sessions in 7 days"],
      reasoning: "Regular usage indicates active state",
      confidence: 0.8,
      source: "website",
      evidence: [],
    };
    const definitions: DefinitionsMap = {
      active: lifecycle,
      atRisk: { ...lifecycle, criteria: ["No login in 14 days"] },
      churn: { ...lifecycle, criteria: ["No login in 30 days"] },
    };
    expect(definitions.active).toBeDefined();
    expect(definitions.activation).toBeUndefined();
    expect(definitions.firstValue).toBeUndefined();
  });
});

describe("OutcomesSection", () => {
  it("has items with linked features", () => {
    const item: OutcomeItem = {
      description: "Reduce time to first insight",
      type: "efficiency",
      linkedFeatures: ["Dashboard", "Auto-analysis"],
    };
    const outcomes: OutcomesSection = {
      items: [item],
      confidence: 0.7,
      evidence: [],
    };
    expect(outcomes.items).toHaveLength(1);
    expect(outcomes.items[0].linkedFeatures).toHaveLength(2);
  });
});

describe("MetricsSection", () => {
  it("has metric items", () => {
    const item: MetricItem = {
      name: "Activation Rate",
      category: "value_delivery",
      formula: "activated_users / total_users",
      linkedTo: ["activation"],
    };
    const metrics: MetricsSection = {
      items: [item],
      confidence: 0.8,
      evidence: [],
    };
    expect(metrics.items).toHaveLength(1);
    expect(metrics.items[0].formula).toContain("activated_users");
  });
});

describe("ProductProfile", () => {
  it("supports all sections populated", () => {
    const profile: ProductProfile = {
      productId: "products:abc123",
      identity: {
        productName: "Test",
        description: "Test product",
        targetCustomer: "Developers",
        businessModel: "SaaS",
        confidence: 0.9,
        evidence: [],
      },
      revenue: {
        model: "subscription",
        hasFreeTier: true,
        tiers: [],
        expansionPaths: [],
        contractionRisks: [],
        confidence: 0.8,
        evidence: [],
      },
      entities: {
        items: [],
        relationships: [],
        confidence: 0.7,
        evidence: [],
      },
      journey: {
        stages: [],
        confidence: 0.6,
        evidence: [],
      },
      definitions: {},
      outcomes: {
        items: [],
        confidence: 0.5,
        evidence: [],
      },
      metrics: {
        items: [],
        confidence: 0.4,
        evidence: [],
      },
      completeness: 100,
      overallConfidence: 0.7,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(profile.productId).toBe("products:abc123");
    expect(profile.identity?.productName).toBe("Test");
    expect(profile.completeness).toBe(100);
  });

  it("works with minimal fields", () => {
    const profile: ProductProfile = {
      productId: "products:xyz",
      completeness: 0,
      overallConfidence: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(profile.identity).toBeUndefined();
    expect(profile.completeness).toBe(0);
  });
});
