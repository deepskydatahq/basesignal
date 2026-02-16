import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("schema.ts re-export", () => {
  const schemaTs = readFileSync(resolve(__dirname, "../schema.ts"), "utf-8");

  it("imports from @basesignal/core", () => {
    expect(schemaTs).toContain("@basesignal/core");
  });

  it("re-exports ProductProfile type", () => {
    expect(schemaTs).toContain("ProductProfile");
  });

  it("re-exports SCHEMA_VERSION", () => {
    expect(schemaTs).toContain("SCHEMA_VERSION");
  });

  it("re-exports checkVersion", () => {
    expect(schemaTs).toContain("checkVersion");
  });

  it("re-exports all section types", () => {
    const requiredTypes = [
      "CoreIdentity",
      "RevenueArchitecture",
      "EntityModel",
      "UserJourney",
      "DefinitionsMap",
      "OutcomesSection",
      "MetricsSection",
    ];
    for (const t of requiredTypes) {
      expect(schemaTs).toContain(t);
    }
  });

  it("re-exports sub-types", () => {
    const subTypes = [
      "PricingTier",
      "EntityItem",
      "EntityRelationship",
      "JourneyStage",
      "ActivationDefinition",
      "LegacyActivationDefinition",
      "MultiLevelActivationDefinition",
      "ActivationLevelDef",
      "ActivationCriterion",
      "LifecycleDefinition",
      "OutcomeItem",
      "MetricItem",
      "Evidence",
      "SignalStrength",
      "ConfidenceLevel",
    ];
    for (const t of subTypes) {
      expect(schemaTs).toContain(t);
    }
  });
});
