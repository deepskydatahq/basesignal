import { describe, it, expect } from "vitest";
import {
  classifyArchetype,
  selectMetrics,
  METRIC_CATALOG,
  type Archetype,
  type ProfileIdentity,
  type ProfileRevenue,
  type MetricCategory,
} from "./metricSuggestions";

// === classifyArchetype tests ===

describe("classifyArchetype", () => {
  const identity = (businessModel: string): ProfileIdentity => ({ businessModel });

  it("classifies PLG keywords", () => {
    expect(classifyArchetype(identity("B2B SaaS - Product-Led Growth"))).toBe("plg");
    expect(classifyArchetype(identity("Self-serve SaaS"))).toBe("plg");
    expect(classifyArchetype(identity("Freemium model"))).toBe("plg");
    expect(classifyArchetype(identity("Free trial B2B"))).toBe("plg");
  });

  it("classifies sales-led keywords", () => {
    expect(classifyArchetype(identity("Enterprise sales-led"))).toBe("sales_led");
    expect(classifyArchetype(identity("Demo-driven enterprise SaaS"))).toBe("sales_led");
    expect(classifyArchetype(identity("Contact sales for pricing"))).toBe("sales_led");
  });

  it("classifies marketplace keywords", () => {
    expect(classifyArchetype(identity("Two-sided marketplace"))).toBe("marketplace");
    expect(classifyArchetype(identity("Online marketplace platform"))).toBe("marketplace");
  });

  it("classifies ecommerce keywords", () => {
    expect(classifyArchetype(identity("E-commerce retailer"))).toBe("ecommerce");
    expect(classifyArchetype(identity("Online store"))).toBe("ecommerce");
  });

  it("classifies usage-based keywords", () => {
    expect(classifyArchetype(identity("Usage-based pricing"))).toBe("usage_based");
    expect(classifyArchetype(identity("Pay-as-you-go cloud service"))).toBe("usage_based");
    expect(classifyArchetype(identity("Metered billing model"))).toBe("usage_based");
  });

  it("is case-insensitive", () => {
    expect(classifyArchetype(identity("PRODUCT-LED GROWTH"))).toBe("plg");
    expect(classifyArchetype(identity("MARKETPLACE"))).toBe("marketplace");
  });

  it("prefers marketplace over PLG when both could match", () => {
    // Marketplace keywords are checked before PLG
    expect(classifyArchetype(identity("Self-serve marketplace"))).toBe("marketplace");
  });

  it("falls back to revenue model when no keyword match", () => {
    const rev: ProfileRevenue = { model: "subscription", hasFreeTier: true };
    expect(classifyArchetype(identity("B2B SaaS"), rev)).toBe("plg");
  });

  it("classifies subscription without free tier as sales-led", () => {
    const rev: ProfileRevenue = { model: "subscription", hasFreeTier: false };
    expect(classifyArchetype(identity("B2B SaaS"), rev)).toBe("sales_led");
  });

  it("classifies commission revenue model as marketplace", () => {
    const rev: ProfileRevenue = { model: "commission-based", hasFreeTier: false };
    expect(classifyArchetype(identity("Digital platform"), rev)).toBe("marketplace");
  });

  it("classifies transaction revenue as ecommerce", () => {
    const rev: ProfileRevenue = { model: "transaction fees", hasFreeTier: false };
    expect(classifyArchetype(identity("Online business"), rev)).toBe("ecommerce");
  });

  it("classifies usage/consumption revenue as usage_based", () => {
    const rev: ProfileRevenue = { model: "consumption pricing", hasFreeTier: false };
    expect(classifyArchetype(identity("Cloud service"), rev)).toBe("usage_based");
  });

  it("defaults to PLG when no signals match", () => {
    expect(classifyArchetype(identity("Software company"))).toBe("plg");
  });
});

// === selectMetrics tests ===

describe("selectMetrics", () => {
  it("returns metrics matching PLG archetype", () => {
    const metrics = selectMetrics("plg");
    expect(metrics.length).toBeGreaterThan(0);
    const names = metrics.map((m) => m.name);
    expect(names).toContain("Activation Rate");
    expect(names).toContain("Trial-to-Paid Conversion");
    expect(names).toContain("Time to First Value");
  });

  it("returns metrics matching sales_led archetype", () => {
    const metrics = selectMetrics("sales_led");
    const names = metrics.map((m) => m.name);
    expect(names).toContain("Qualified Leads");
    expect(names).toContain("SQL-to-Opportunity Rate");
    expect(names).toContain("Average Deal Size");
    expect(names).toContain("Time to Deploy");
  });

  it("returns metrics matching marketplace archetype", () => {
    const metrics = selectMetrics("marketplace");
    const names = metrics.map((m) => m.name);
    expect(names).toContain("Liquidity Rate");
    expect(names).toContain("Gross Merchandise Value");
    expect(names).toContain("Take Rate");
    expect(names).toContain("Buyer Satisfaction Score");
  });

  it("returns metrics matching ecommerce archetype", () => {
    const metrics = selectMetrics("ecommerce");
    const names = metrics.map((m) => m.name);
    expect(names).toContain("Repeat Purchase Rate");
    expect(names).toContain("Average Order Value");
    expect(names).toContain("Cart Abandonment Rate");
  });

  it("returns metrics matching usage_based archetype", () => {
    const metrics = selectMetrics("usage_based");
    const names = metrics.map((m) => m.name);
    expect(names).toContain("Core Action Frequency");
    expect(names).toContain("Revenue per User");
  });

  it("all metrics have required fields", () => {
    const allArchetypes: Archetype[] = ["plg", "sales_led", "marketplace", "ecommerce", "usage_based"];
    for (const archetype of allArchetypes) {
      const metrics = selectMetrics(archetype);
      for (const m of metrics) {
        expect(m.name).toBeTruthy();
        expect(m.category).toBeTruthy();
        expect(Array.isArray(m.linkedTo)).toBe(true);
        expect(m.linkedTo.length).toBeGreaterThan(0);
      }
    }
  });

  it("includes all 5 categories across the catalog", () => {
    const allCategories = new Set(METRIC_CATALOG.map((m) => m.category));
    const expected: MetricCategory[] = ["reach", "engagement", "retention", "revenue", "value"];
    for (const cat of expected) {
      expect(allCategories.has(cat)).toBe(true);
    }
  });

  it("does not include PLG-only metrics for sales_led", () => {
    const metrics = selectMetrics("sales_led");
    const names = metrics.map((m) => m.name);
    expect(names).not.toContain("Trial-to-Paid Conversion");
    expect(names).not.toContain("Time to First Value");
  });

  it("does not include marketplace-only metrics for PLG", () => {
    const metrics = selectMetrics("plg");
    const names = metrics.map((m) => m.name);
    expect(names).not.toContain("Liquidity Rate");
    expect(names).not.toContain("Gross Merchandise Value");
    expect(names).not.toContain("Take Rate");
  });

  it("universal metrics appear in all archetypes", () => {
    const allArchetypes: Archetype[] = ["plg", "sales_led", "marketplace", "ecommerce", "usage_based"];
    for (const archetype of allArchetypes) {
      const names = selectMetrics(archetype).map((m) => m.name);
      expect(names).toContain("New Signups");
      expect(names).toContain("Feature Adoption Rate");
    }
  });

  it("returns metrics without archetypes field (clean output)", () => {
    const metrics = selectMetrics("plg");
    for (const m of metrics) {
      expect(m).not.toHaveProperty("archetypes");
    }
  });
});
