import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("docs example profile", () => {
  const fixturePath = resolve(
    __dirname,
    "../../../../docs/fixtures/linear-profile.json"
  );

  test("fixture file exists and is valid JSON", () => {
    const raw = readFileSync(fixturePath, "utf-8");
    const profile = JSON.parse(raw);

    expect(profile).toBeDefined();
    expect(profile.basesignal_version).toBeDefined();
    expect(profile.identity).toBeDefined();
    expect(profile.identity.productName).toBe("Linear");
  });

  test("fixture has all required top-level sections", () => {
    const raw = readFileSync(fixturePath, "utf-8");
    const profile = JSON.parse(raw);

    expect(profile.basesignal_version).toBe("1.0");
    expect(profile.metadata).toBeDefined();
    expect(profile.identity).toBeDefined();
    expect(profile.revenue).toBeDefined();
    expect(profile.entities).toBeDefined();
    expect(profile.journey).toBeDefined();
    expect(profile.definitions).toBeDefined();
    expect(profile.outcomes).toBeDefined();
    expect(profile.metrics).toBeDefined();
    expect(profile.outputs).toBeDefined();
    expect(typeof profile.completeness).toBe("number");
    expect(typeof profile.overallConfidence).toBe("number");
  });

  test("fixture definitions include all lifecycle states", () => {
    const raw = readFileSync(fixturePath, "utf-8");
    const profile = JSON.parse(raw);

    expect(profile.definitions.activation).toBeDefined();
    expect(profile.definitions.firstValue).toBeDefined();
    expect(profile.definitions.active).toBeDefined();
    expect(profile.definitions.atRisk).toBeDefined();
    expect(profile.definitions.churn).toBeDefined();
  });

  test("fixture outputs include all three output types", () => {
    const raw = readFileSync(fixturePath, "utf-8");
    const profile = JSON.parse(raw);

    expect(profile.outputs.icpProfiles).toBeDefined();
    expect(Array.isArray(profile.outputs.icpProfiles)).toBe(true);
    expect(profile.outputs.icpProfiles.length).toBeGreaterThan(0);

    expect(profile.outputs.activationMap).toBeDefined();
    expect(Array.isArray(profile.outputs.activationMap.stages)).toBe(true);

    expect(profile.outputs.measurementSpec).toBeDefined();
    expect(Array.isArray(profile.outputs.measurementSpec.events)).toBe(true);
  });

  // When ProductProfileSchema exists (from M008-E001-S003), upgrade this test:
  // test("fixture validates against ProductProfile schema", () => {
  //   const raw = readFileSync(fixturePath, "utf-8");
  //   const profile = JSON.parse(raw);
  //   expect(() => ProductProfileSchema.parse(profile)).not.toThrow();
  // });
});
