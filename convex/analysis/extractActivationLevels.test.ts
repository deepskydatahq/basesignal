import { describe, it, expect } from "vitest";
import { ACTIVATION_SYSTEM_PROMPT } from "./extractActivationLevels";

describe("ACTIVATION_SYSTEM_PROMPT", () => {
  // AC1: ACTIVATION_SYSTEM_PROMPT constant is defined with extraction instructions
  it("is a non-empty string with extraction instructions", () => {
    expect(typeof ACTIVATION_SYSTEM_PROMPT).toBe("string");
    expect(ACTIVATION_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("activation");
  });

  // AC2: Prompt requests output as JSON matching ActivationLevelsResult structure
  it("requests JSON output matching ActivationLevelsResult structure", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("levels");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("primaryActivation");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("overallConfidence");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("signalStrength");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("criteria");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("reasoning");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("evidence");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("JSON");
  });

  // AC3: Prompt includes examples for PLG product activation spectrum
  it("includes PLG product activation spectrum example", () => {
    // Should have an example showing progression from individual to team
    expect(ACTIVATION_SYSTEM_PROMPT).toMatch(/level.*1/s);
    expect(ACTIVATION_SYSTEM_PROMPT).toMatch(/level.*2/s);
    expect(ACTIVATION_SYSTEM_PROMPT).toMatch(/level.*3/s);
    // Should mention a concrete product type example
    expect(ACTIVATION_SYSTEM_PROMPT).toMatch(/B2B\s*SaaS/i);
  });

  // AC4: Prompt includes guidance on identifying primary activation based on value prop
  it("includes guidance on identifying primary activation", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("primaryActivation");
    // Should explain what primary activation means
    expect(ACTIVATION_SYSTEM_PROMPT).toMatch(/core\s*value/i);
  });

  // AC5: Prompt instructs to look for behavioral language
  it("instructs to look for behavioral language", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("create");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("invite");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("share");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("collaborate");
  });

  // AC6: Prompt explains signalStrength mapping
  it("explains signalStrength mapping from weak to very_strong", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("weak");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("medium");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("strong");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("very_strong");
    // Should explain what each means
    expect(ACTIVATION_SYSTEM_PROMPT).toMatch(/individual.*exploration/i);
    expect(ACTIVATION_SYSTEM_PROMPT).toMatch(/team.*adoption/i);
  });
});
