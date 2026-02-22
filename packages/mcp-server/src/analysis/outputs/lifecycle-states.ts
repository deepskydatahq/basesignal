// Lifecycle States prompt, prompt builder, and response parser.

import type { IdentityResult, ValueMoment } from "../types.js";
import type { ActivationLevel, LifecycleStatesResult } from "@basesignal/core";
import { extractJson, LifecycleStatesResultSchema } from "@basesignal/core";
import type { ActivationMapResult } from "./activation-map.js";

// --- System Prompt ---

export const LIFECYCLE_STATES_SYSTEM_PROMPT = `You are a product analyst generating a user lifecycle state model.

A lifecycle state model defines the stages users pass through from first contact to long-term engagement (or churn), with measurable criteria for entering each state and triggers for transitioning between them.

## Task

Generate exactly 7 lifecycle states with these exact names:
1. **new** — User has signed up but not yet reached activation
2. **activated** — User has reached the primary activation level (the "aha moment")
3. **engaged** — User demonstrates sustained, recurring value extraction
4. **at_risk** — User's engagement is declining from a previously engaged state
5. **dormant** — User has stopped engaging but account still exists
6. **churned** — User has been inactive long enough to be considered lost
7. **resurrected** — User has returned after being dormant or churned

## Output Structure

Return a single JSON object with this structure:

{
  "states": [
    {
      "name": "new",
      "description": "User has created an account but has not yet completed their first meaningful action",
      "entry_criteria": [
        {
          "event_name": "account_created",
          "condition": "count >= 1"
        }
      ],
      "exit_triggers": [
        {
          "event_name": "first_project_created",
          "condition": "count >= 1"
        }
      ],
      "time_window": "0-7 days",
      "typical_duration": "1-3 days"
    },
    {
      "name": "activated",
      "description": "User has reached the primary activation level and experienced core product value",
      "entry_criteria": [
        {
          "event_name": "project_shared_with_team",
          "condition": "count >= 1"
        },
        {
          "event_name": "template_customized",
          "condition": "count >= 2 within 7 days"
        }
      ],
      "exit_triggers": [
        {
          "event_name": "weekly_active_sessions",
          "condition": "count >= 3 within 14 days"
        }
      ],
      "time_window": "1-14 days",
      "typical_duration": "3-7 days"
    },
    {
      "name": "at_risk",
      "description": "User's activity has dropped significantly from their engaged baseline",
      "entry_criteria": [
        {
          "event_name": "weekly_active_sessions",
          "condition": "count < 1 within 14 days"
        }
      ],
      "exit_triggers": [
        {
          "event_name": "session_started",
          "condition": "count >= 2 within 7 days"
        },
        {
          "event_name": "days_inactive",
          "condition": "count >= 30"
        }
      ],
      "time_window": "14-30 days inactive",
      "typical_duration": "7-21 days"
    }
  ],
  "transitions": [
    {
      "from": "new",
      "to": "activated",
      "trigger_events": ["first_project_created", "template_customized"],
      "direction": "forward"
    },
    {
      "from": "engaged",
      "to": "at_risk",
      "trigger_events": ["activity_decline_detected"],
      "direction": "regression"
    },
    {
      "from": "dormant",
      "to": "resurrected",
      "trigger_events": ["session_started", "feature_used"],
      "direction": "recovery"
    }
  ],
  "confidence": 0.75,
  "sources": ["identity", "activation_levels", "activation_map", "value_moments"]
}

## Calibration

Use the product's industry, business model, and activation map transition timeframes to calibrate state time windows. Different products have vastly different natural cadences:
- A daily-use collaboration tool may consider 3 days of inactivity as "at_risk"
- An enterprise reporting tool used monthly may not flag "at_risk" until 45+ days
- A seasonal product may have natural dormancy periods that are not concerning

The activation map transition timeframes tell you how quickly users typically move between levels — use these as the baseline for calibrating your time windows.

## Alignment

The activated state entry_criteria MUST correspond to the primary activation level from the activation map. The events and conditions that define "activated" should reflect what it means to reach that level.

## Value Moments

Value moments of any tier can indicate progression through states. Use them as evidence for what engagement looks like at each state — don't restrict which tiers map to which states. A Tier 3 moment might be relevant for the engaged state if that's what sustained usage looks like for this product.

## Rules

1. Return ONLY valid JSON, no commentary before or after
2. Generate exactly 7 states with the exact names: new, activated, engaged, at_risk, dormant, churned, resurrected
3. Every entry_criteria must have event_name (string) and condition (string with comparison operator)
4. Every exit_triggers must have event_name (string) and condition (string with comparison operator)
5. Include at least 8 transitions covering forward progression, regression, and recovery paths
6. Each transition must have from, to, trigger_events (non-empty array), and direction ("forward", "regression", or "recovery")
7. Set confidence between 0 and 1 based on data quality
8. Set sources to describe what data informed the model`;

// --- Prompt Builder ---

export function buildLifecycleStatesPrompt(
  identity: IdentityResult,
  valueMoments: ValueMoment[],
  activationLevels: ActivationLevel[],
  activationMap: ActivationMapResult,
): string {
  const parts: string[] = [];

  // Section 1: Product Identity
  parts.push("## Product Identity\n");
  parts.push(`Product Name: ${identity.productName}`);
  parts.push(`Business Model: ${identity.businessModel}`);
  if (identity.industry) {
    parts.push(`Industry: ${identity.industry}`);
  }
  parts.push(`Description: ${identity.description}`);
  parts.push(`Target Customer: ${identity.targetCustomer}`);
  parts.push("");

  // Section 2: Activation Levels
  parts.push("## Activation Levels\n");
  for (const level of activationLevels) {
    parts.push(`### Level ${level.level}: ${level.name}`);
    parts.push(`Signal Strength: ${level.signalStrength}`);
    parts.push("Criteria:");
    for (const c of level.criteria) {
      const tw = c.timeWindow ? ` within ${c.timeWindow}` : "";
      parts.push(`  - ${c.action} (count: ${c.count}${tw})`);
    }
    parts.push("");
  }

  // Section 3: Activation Map Summary
  parts.push("## Activation Map Summary\n");
  parts.push(
    `Primary Activation Level: ${activationMap.primary_activation_level}`,
  );

  const timedTransitions = activationMap.transitions.filter(
    (t) => t.typical_timeframe,
  );
  if (timedTransitions.length > 0) {
    parts.push("\nTransition Timeframes:");
    for (const t of timedTransitions) {
      parts.push(
        `  - Level ${t.from_level} → Level ${t.to_level}: ${t.typical_timeframe}`,
      );
    }
  }
  parts.push("");

  // Section 4: Value Moments
  parts.push("## Value Moments\n");
  for (const vm of valueMoments) {
    parts.push(`### ${vm.name} (Tier ${vm.tier})`);
    parts.push(`Description: ${vm.description}`);
    parts.push("");
  }

  return parts.join("\n");
}

// --- Response Parser ---

export function parseLifecycleStatesResponse(text: string): LifecycleStatesResult {
  const raw = extractJson(text);
  return LifecycleStatesResultSchema.parse(raw);
}
