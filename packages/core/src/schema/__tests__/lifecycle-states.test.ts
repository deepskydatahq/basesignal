import { describe, it, expect } from "vitest";
import { LifecycleStatesResultSchema } from "../outputs";

const makeState = (name: string) => ({
  name,
  definition: `User is in the ${name} state`,
  entry_criteria: [{ event_name: "login", condition: "count >= 1" }],
  exit_triggers: [{ event_name: "activity_check", condition: "no activity for 14 days" }],
});

const valid7StateResult = {
  states: [
    makeState("New"),
    makeState("Onboarding"),
    makeState("Activated"),
    makeState("Engaged"),
    makeState("Retained"),
    makeState("Power User"),
    makeState("At Risk"),
  ],
  transitions: [
    { from_state: "New", to_state: "Onboarding", trigger_conditions: ["started onboarding"] },
    { from_state: "Onboarding", to_state: "Activated", trigger_conditions: ["completed setup"] },
    { from_state: "Activated", to_state: "Engaged", trigger_conditions: ["3+ sessions"] },
    { from_state: "Engaged", to_state: "Retained", trigger_conditions: ["active 30+ days"] },
    { from_state: "Retained", to_state: "Power User", trigger_conditions: ["daily usage"] },
    { from_state: "Engaged", to_state: "At Risk", trigger_conditions: ["no activity 14 days"] },
  ],
  confidence: 0.85,
  sources: ["product analysis", "user research"],
};

describe("LifecycleStatesResultSchema", () => {
  it("accepts valid 7-state result", () => {
    const result = LifecycleStatesResultSchema.safeParse(valid7StateResult);
    expect(result.success).toBe(true);
  });

  it("rejects missing required field (states)", () => {
    const { states, ...rest } = valid7StateResult;
    const result = LifecycleStatesResultSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid criteria in a state", () => {
    const invalid = {
      ...valid7StateResult,
      states: [
        {
          name: "Bad",
          definition: "Invalid state",
          entry_criteria: [{ event_name: "", condition: "" }],
          exit_triggers: [{ event_name: "check", condition: "none" }],
        },
      ],
    };
    const result = LifecycleStatesResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects non-object input", () => {
    const result = LifecycleStatesResultSchema.safeParse("not-an-object");
    expect(result.success).toBe(false);
  });
});
