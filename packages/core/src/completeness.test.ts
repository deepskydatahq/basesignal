import { describe, it, expect } from "vitest";
import { computeCompleteness, PIPELINE_SECTIONS } from "./completeness";

describe("computeCompleteness", () => {
  it("returns 0 when nothing is present", () => {
    const result = computeCompleteness({});
    expect(result.completeness).toBe(0);
    expect(result.sections.every((s) => !s.present)).toBe(true);
  });

  it("returns 1 when all sections are present", () => {
    const result = computeCompleteness({
      identity: { productName: "Test" },
      activation_levels: { levels: [] },
      icp_profiles: [{ id: "icp-1" }],
      activation_map: { stages: [] },
      lifecycle_states: { states: [] },
      measurement_spec: { perspectives: {}, confidence: 0.5 },
    });
    expect(result.completeness).toBe(1);
  });

  it("returns fractional completeness for partial outputs", () => {
    const result = computeCompleteness({
      identity: { productName: "Test" },
      activation_levels: { levels: [] },
    });
    expect(result.completeness).toBeCloseTo(2 / 6);
  });

  it("treats empty icp_profiles array as not present", () => {
    const result = computeCompleteness({ icp_profiles: [] });
    const icpSection = result.sections.find((s) => s.name === "icp_profiles");
    expect(icpSection?.present).toBe(false);
    expect(result.completeness).toBe(0);
  });

  it("treats non-empty icp_profiles array as present", () => {
    const result = computeCompleteness({ icp_profiles: [{ id: "p1" }] });
    const icpSection = result.sections.find((s) => s.name === "icp_profiles");
    expect(icpSection?.present).toBe(true);
  });

  it("checks exactly 6 pipeline sections", () => {
    expect(PIPELINE_SECTIONS).toHaveLength(6);
    const result = computeCompleteness({});
    expect(result.sections).toHaveLength(6);
  });

  it("returns section breakdown", () => {
    const result = computeCompleteness({ identity: { productName: "X" } });
    expect(result.sections.find((s) => s.name === "identity")?.present).toBe(true);
    expect(result.sections.find((s) => s.name === "measurement_spec")?.present).toBe(false);
  });

  it("treats null values as not present", () => {
    const result = computeCompleteness({
      identity: null as unknown,
      activation_levels: undefined,
    });
    expect(result.completeness).toBe(0);
  });
});
