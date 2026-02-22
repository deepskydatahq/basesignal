import { describe, it, expect } from "vitest";
import { parseLifecycleStatesResponse } from "../../outputs/lifecycle-states.js";
import { ZodError } from "zod/v4";

function makeValidResult() {
  return {
    states: [
      {
        name: "new",
        definition: "User has signed up but not yet activated",
        entry_criteria: [{ event_name: "account_created", condition: "count >= 1" }],
        exit_triggers: ["first_project_created"],
        time_window: "0-7 days",
      },
      {
        name: "activated",
        definition: "User reached primary activation level",
        entry_criteria: [{ event_name: "project_shared", condition: "count >= 1" }],
        exit_triggers: ["weekly_sessions >= 3"],
      },
      {
        name: "engaged",
        definition: "Sustained recurring value extraction",
        entry_criteria: [{ event_name: "weekly_active_sessions", condition: "count >= 3 within 14 days" }],
        exit_triggers: ["activity_decline_detected"],
      },
      {
        name: "at_risk",
        definition: "Engagement declining from engaged baseline",
        entry_criteria: [{ event_name: "weekly_active_sessions", condition: "count < 1 within 14 days" }],
        exit_triggers: ["session_started count >= 2 within 7 days"],
      },
      {
        name: "dormant",
        definition: "User stopped engaging but account exists",
        entry_criteria: [{ event_name: "days_inactive", condition: "count >= 30" }],
        exit_triggers: ["session_started"],
      },
      {
        name: "churned",
        definition: "Inactive long enough to be considered lost",
        entry_criteria: [{ event_name: "days_inactive", condition: "count >= 90" }],
        exit_triggers: ["account_reactivated"],
      },
      {
        name: "resurrected",
        definition: "Returned after being dormant or churned",
        entry_criteria: [{ event_name: "session_started", condition: "count >= 1 after dormant" }],
        exit_triggers: ["weekly_sessions >= 3"],
      },
    ],
    transitions: [
      { from_state: "new", to_state: "activated", trigger_conditions: ["first_project_created"] },
      { from_state: "activated", to_state: "engaged", trigger_conditions: ["sustained_usage"] },
    ],
    confidence: 0.75,
    sources: ["identity", "activation_levels"],
  };
}

describe("parseLifecycleStatesResponse", () => {
  it("parses valid 7-state JSON into LifecycleStatesResult", () => {
    const input = JSON.stringify(makeValidResult());
    const result = parseLifecycleStatesResponse(input);

    expect(result.states).toHaveLength(7);
    expect(result.states[0].name).toBe("new");
    expect(result.states[0].entry_criteria[0].event_name).toBe("account_created");
    expect(result.transitions).toHaveLength(2);
    expect(result.confidence).toBe(0.75);
    expect(result.sources).toEqual(["identity", "activation_levels"]);
  });

  it("handles markdown-fenced JSON response", () => {
    const json = JSON.stringify(makeValidResult());
    const fenced = "```json\n" + json + "\n```";
    const result = parseLifecycleStatesResponse(fenced);

    expect(result.states).toHaveLength(7);
    expect(result.confidence).toBe(0.75);
  });

  it("preserves optional fields when present", () => {
    const valid = makeValidResult();
    valid.states[0].time_window = "0-7 days";
    valid.transitions[0].typical_timeframe = "1-3 days";

    const result = parseLifecycleStatesResponse(JSON.stringify(valid));
    expect(result.states[0].time_window).toBe("0-7 days");
    expect(result.transitions[0].typical_timeframe).toBe("1-3 days");
  });

  it("accepts optional threshold on entry_criteria", () => {
    const valid = makeValidResult();
    valid.states[0].entry_criteria[0] = {
      event_name: "account_created",
      condition: "count >= 1",
      threshold: 1,
    };
    const result = parseLifecycleStatesResponse(JSON.stringify(valid));
    expect(result.states[0].entry_criteria[0].threshold).toBe(1);
  });

  it("throws ZodError when states field is missing", () => {
    const invalid = { transitions: [], confidence: 0.5, sources: [] };
    expect(() => parseLifecycleStatesResponse(JSON.stringify(invalid))).toThrow(ZodError);

    try {
      parseLifecycleStatesResponse(JSON.stringify(invalid));
    } catch (e) {
      expect(e).toBeInstanceOf(ZodError);
      const zodErr = e as ZodError;
      const paths = zodErr.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("states"))).toBe(true);
    }
  });

  it("throws ZodError when state is missing entry_criteria", () => {
    const valid = makeValidResult();
    const badState = { ...valid.states[2] } as Record<string, unknown>;
    delete badState.entry_criteria;
    valid.states[2] = badState as typeof valid.states[2];

    expect(() => parseLifecycleStatesResponse(JSON.stringify(valid))).toThrow(ZodError);

    try {
      parseLifecycleStatesResponse(JSON.stringify(valid));
    } catch (e) {
      const zodErr = e as ZodError;
      const paths = zodErr.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("states") && p.includes("entry_criteria"))).toBe(true);
    }
  });

  it("throws ZodError when state name is empty string", () => {
    const valid = makeValidResult();
    valid.states[0].name = "";

    expect(() => parseLifecycleStatesResponse(JSON.stringify(valid))).toThrow(ZodError);
  });

  it("throws ZodError when confidence is not a number", () => {
    const data = makeValidResult() as Record<string, unknown>;
    data.confidence = "high";

    expect(() => parseLifecycleStatesResponse(JSON.stringify(data))).toThrow(ZodError);
  });

  it("throws ZodError when transition is missing from_state", () => {
    const valid = makeValidResult();
    const badTransition = { to_state: "activated", trigger_conditions: ["event"] };
    valid.transitions = [badTransition as typeof valid.transitions[0]];

    expect(() => parseLifecycleStatesResponse(JSON.stringify(valid))).toThrow(ZodError);

    try {
      parseLifecycleStatesResponse(JSON.stringify(valid));
    } catch (e) {
      const zodErr = e as ZodError;
      const paths = zodErr.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("transitions") && p.includes("from_state"))).toBe(true);
    }
  });
});
