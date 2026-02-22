# Implementation Plan: M010-E002-S004 — Tests for Lifecycle States Generator

**Task:** basesignal-r4g
**Design doc:** `docs/plans/2026-02-22-lifecycle-states-generator-tests-design.md`
**Dependencies:** basesignal-yts (S001), basesignal-lku (S002), basesignal-cov (S003) must complete first — they create the `lifecycle-states.ts` module being tested
**Status:** All three dependencies are `open` with `plan` label — tests can be written ahead but won't pass until dependencies are implemented

## Overview

Create a single test file with 5 tests across 3 describe blocks covering all 6 acceptance criteria. Self-contained inline fixtures, inline mock LLM, no shared dependencies.

## Tasks

### Task 1: Create test file with imports and fixtures

**File:** `packages/mcp-server/src/analysis/__tests__/outputs/lifecycle-states.test.ts` (new file)

**Imports** (following activation-map.test.ts pattern):
```typescript
import { describe, it, expect } from "vitest";
import {
  buildLifecycleStatesPrompt,
  parseLifecycleStatesResponse,
  generateLifecycleStates,
} from "../../outputs/lifecycle-states.js";
import type { ActivationLevel } from "@basesignal/core";
import type { LlmProvider, ValueMoment, IdentityResult } from "../../types.js";
import type { ActivationMapResult } from "../../outputs/activation-map.js";
```

**Inline fixtures** (module-level constants):

1. `sampleIdentity: IdentityResult` — B2B SaaS "ProjectBoard"
   ```typescript
   const sampleIdentity: IdentityResult = {
     productName: "ProjectBoard",
     description: "B2B project management tool",
     targetCustomer: "Engineering teams",
     businessModel: "B2B SaaS",
     industry: "Project Management",
     confidence: 0.9,
     evidence: [],
   };
   ```

2. `sampleActivationLevels: ActivationLevel[]` — 2 levels (reuse explorer/builder from activation-map.test.ts)
   ```typescript
   const sampleActivationLevels: ActivationLevel[] = [
     {
       level: 1,
       name: "explorer",
       signalStrength: "weak",
       criteria: [{ action: "create_board", count: 1 }],
       reasoning: "Initial interest",
       confidence: 0.7,
       evidence: [],
     },
     {
       level: 2,
       name: "builder",
       signalStrength: "medium",
       criteria: [{ action: "invite_member", count: 2 }],
       reasoning: "Team adoption",
       confidence: 0.6,
       evidence: [],
     },
   ];
   ```

3. `sampleValueMoments: ValueMoment[]` — 1 moment
   ```typescript
   const sampleValueMoments: ValueMoment[] = [
     {
       id: "vm-1",
       name: "Sprint planning",
       description: "Plan sprints faster",
       tier: 1,
       lens_count: 4,
       lenses: ["capability_mapping"],
       roles: ["EM"],
       product_surfaces: ["Sprint Planning"],
       contributing_candidates: [],
       is_coherent: true,
     },
   ];
   ```

4. `sampleActivationMap: ActivationMapResult` — 2 stages, 1 transition
   ```typescript
   const sampleActivationMap: ActivationMapResult = {
     stages: [
       {
         level: 1,
         name: "explorer",
         signal_strength: "weak",
         trigger_events: ["create_board"],
         value_moments_unlocked: ["Board creation"],
         drop_off_risk: { level: "medium", reason: "May not invite team" },
       },
       {
         level: 2,
         name: "builder",
         signal_strength: "medium",
         trigger_events: ["invite_member"],
         value_moments_unlocked: ["Sprint planning"],
         drop_off_risk: { level: "high", reason: "Team adoption hurdle" },
       },
     ],
     transitions: [
       { from_level: 1, to_level: 2, trigger_events: ["invite_member"], typical_timeframe: "1-3 days" },
     ],
     primary_activation_level: 2,
     confidence: "medium",
     sources: ["activation_levels"],
   };
   ```

5. `VALID_LIFECYCLE_RESPONSE` — 7-state object matching `LifecycleStatesResultSchema`
   ```typescript
   const VALID_LIFECYCLE_RESPONSE = {
     states: [
       {
         name: "new",
         definition: "User has signed up but not taken any meaningful action",
         entry_criteria: [{ event_name: "account_created", condition: "sign_up_completed" }],
         exit_triggers: ["create_board", "inactive_7d"],
         time_window: "0-7 days",
       },
       {
         name: "activated",
         definition: "User has reached primary activation level",
         entry_criteria: [{ event_name: "invite_member", condition: "team_member_count >= 2" }],
         exit_triggers: ["complete_sprint", "inactive_14d"],
         time_window: "1-14 days",
       },
       {
         name: "engaged",
         definition: "User regularly uses core features",
         entry_criteria: [{ event_name: "complete_sprint", condition: "sprints_completed >= 2" }],
         exit_triggers: ["no_activity_30d"],
         time_window: "14-90 days",
       },
       {
         name: "at_risk",
         definition: "Engagement declining from previous levels",
         entry_criteria: [{ event_name: "activity_decline", condition: "weekly_actions_decreased_50_pct" }],
         exit_triggers: ["resume_activity", "no_activity_30d"],
       },
       {
         name: "dormant",
         definition: "No meaningful activity for extended period",
         entry_criteria: [{ event_name: "no_activity", condition: "days_since_last_action >= 30" }],
         exit_triggers: ["any_action", "no_activity_90d"],
       },
       {
         name: "churned",
         definition: "User has abandoned the product",
         entry_criteria: [{ event_name: "no_activity", condition: "days_since_last_action >= 90" }],
         exit_triggers: ["any_action"],
       },
       {
         name: "resurrected",
         definition: "Previously churned user has returned",
         entry_criteria: [{ event_name: "return_action", condition: "action_after_churn" }],
         exit_triggers: ["complete_sprint", "inactive_14d"],
       },
     ],
     transitions: [
       { from_state: "new", to_state: "activated", trigger_conditions: ["invite_member"], typical_timeframe: "1-7 days" },
       { from_state: "activated", to_state: "engaged", trigger_conditions: ["complete_sprint"], typical_timeframe: "7-30 days" },
       { from_state: "engaged", to_state: "at_risk", trigger_conditions: ["activity_decline"] },
       { from_state: "at_risk", to_state: "dormant", trigger_conditions: ["no_activity_30d"] },
       { from_state: "dormant", to_state: "churned", trigger_conditions: ["no_activity_90d"] },
       { from_state: "churned", to_state: "resurrected", trigger_conditions: ["return_action"] },
       { from_state: "resurrected", to_state: "engaged", trigger_conditions: ["complete_sprint"] },
     ],
     confidence: 0.75,
     sources: ["activation_levels", "activation_map", "value_moments"],
   };
   ```

### Task 2: Write `buildLifecycleStatesPrompt` tests (2 tests)

```typescript
describe("buildLifecycleStatesPrompt", () => {
  it("includes product name and business model", () => {
    const prompt = buildLifecycleStatesPrompt(
      sampleIdentity,
      sampleValueMoments,
      sampleActivationLevels,
      sampleActivationMap,
    );
    expect(prompt).toContain("ProjectBoard");
    expect(prompt).toContain("B2B SaaS");
  });

  it("includes value moment names and activation level names", () => {
    const prompt = buildLifecycleStatesPrompt(
      sampleIdentity,
      sampleValueMoments,
      sampleActivationLevels,
      sampleActivationMap,
    );
    expect(prompt).toContain("Sprint planning");
    expect(prompt).toContain("explorer");
    expect(prompt).toContain("builder");
  });
});
```

**Covers ACs:**
- ✅ buildLifecycleStatesPrompt includes product name and business model
- ✅ buildLifecycleStatesPrompt includes value moment names
- ✅ buildLifecycleStatesPrompt includes activation level names

### Task 3: Write `parseLifecycleStatesResponse` tests (2 tests)

```typescript
describe("parseLifecycleStatesResponse", () => {
  it("parses valid 7-state JSON", () => {
    const result = parseLifecycleStatesResponse(
      JSON.stringify(VALID_LIFECYCLE_RESPONSE),
    );
    expect(result.states).toHaveLength(7);
    expect(result.states[0].name).toBe("new");
    expect(result.states[1].name).toBe("activated");
    expect(result.transitions).toHaveLength(7);
    expect(result.confidence).toBe(0.75);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseLifecycleStatesResponse("not json")).toThrow();
  });
});
```

**Covers ACs:**
- ✅ parseLifecycleStatesResponse parses valid 7-state JSON
- ✅ parseLifecycleStatesResponse throws on invalid JSON

### Task 4: Write `generateLifecycleStates` test (1 test)

```typescript
describe("generateLifecycleStates", () => {
  it("with mock LLM returns valid result with states and transitions", async () => {
    const result = await generateLifecycleStates(
      {
        identity: sampleIdentity,
        value_moments: sampleValueMoments,
        activation_levels: sampleActivationLevels,
        activation_map: sampleActivationMap,
      },
      {
        complete: async () => JSON.stringify(VALID_LIFECYCLE_RESPONSE),
      } as LlmProvider,
    );
    expect(result.states.length).toBeGreaterThanOrEqual(7);
    expect(result.transitions.length).toBeGreaterThan(0);
    expect(result.states.map((s) => s.name)).toContain("activated");
    expect(result.states.map((s) => s.name)).toContain("churned");
  });
});
```

**Covers ACs:**
- ✅ generateLifecycleStates with mock LLM returns valid LifecycleStatesResult
- ✅ generated result has 7+ states matching expected lifecycle states
- ✅ generated result has transitions between states

## Verification

```bash
# Tests won't pass until S001-S003 are implemented, but file should have no syntax errors
npx tsc --noEmit packages/mcp-server/src/analysis/__tests__/outputs/lifecycle-states.test.ts

# Once S001-S003 are complete:
npm run test:run -w packages/mcp-server -- --reporter verbose lifecycle-states
```

## AC Coverage Matrix

| Acceptance Criteria | Test | Describe Block |
|---|---|---|
| buildLifecycleStatesPrompt includes product name and business model | Test 1 | buildLifecycleStatesPrompt |
| buildLifecycleStatesPrompt includes value moment names | Test 2 | buildLifecycleStatesPrompt |
| buildLifecycleStatesPrompt includes activation level names | Test 2 | buildLifecycleStatesPrompt |
| parseLifecycleStatesResponse parses valid 7-state JSON | Test 3 | parseLifecycleStatesResponse |
| parseLifecycleStatesResponse throws on invalid JSON | Test 4 | parseLifecycleStatesResponse |
| generateLifecycleStates with mock LLM returns valid LifecycleStatesResult | Test 5 | generateLifecycleStates |
| generated result has 7+ states matching expected lifecycle states | Test 5 | generateLifecycleStates |
| generated result has transitions between states | Test 5 | generateLifecycleStates |

## Notes

- **Function signature discrepancy**: `buildLifecycleStatesPrompt` uses individual params (S001 design), `generateLifecycleStates` uses wrapper object (S003 design). S003 destructures internally. Tests call each by its designed signature.
- **Parser uses Zod**: Unlike older parsers (hand-written validation), this parser uses `extractJson` + `LifecycleStatesResultSchema.parse()`. The "throws on invalid JSON" test uses `.toThrow()` without message matching since Zod errors differ from hand-written errors.
- **Inline mock LLM**: Cast as `LlmProvider` directly in the test call — no shared mock infrastructure.
- **`is_coherent` on ValueMoment**: Extra property not in the type definition but present in all sibling test fixtures. Included for consistency.
