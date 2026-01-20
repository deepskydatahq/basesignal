# Metric Variation Templates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Define metric variation templates that can be applied to any measurement activity based on its lifecycle slot, replacing hard-coded templates with composable variations.

**Architecture:** Two-tier template system: (1) slot-agnostic metrics remain unchanged (New Users, MAU, DAU, etc.), (2) slot-specific metrics generated per activity using variation templates. Primary activities (`isFirstValue=true`) get full variations; secondary activities get lightweight tracking.

**Tech Stack:** TypeScript (src/shared/metricTemplates.ts), Convex (mutations), Vitest + convex-test

---

## Background

### Current State
- `src/shared/metricTemplates.ts`: 8 hard-coded templates organized by generation phase (overview, first_value)
- `convex/metricCatalog.ts`: `generateFromOverview` and `generateFromFirstValue` use phase-based templates
- Templates are monolithic - no variation concept exists

### Target State
- New `METRIC_VARIATIONS` type defining variation types
- `SLOT_METRIC_TEMPLATES` constant with pre-written templates per slot+variation
- `FALLBACK_TEMPLATES` for activities without a lifecycle slot
- `generateFromMeasurementPlan` mutation that generates metrics based on activity's slot and primary/secondary status

### Key Files
- `src/shared/metricTemplates.ts:1-227` - Template definitions and helpers
- `convex/schema.ts:321-333` - measurementActivities table (has lifecycleSlot, isFirstValue)
- `convex/schema.ts:385-407` - metrics table (currently has relatedActivityId)
- `convex/metricCatalog.ts:1-186` - Current generation mutations

### Dependency
This plan depends on Issue #47 (Metric-Event Traceability System) schema changes. The plan assumes `sourceActivityId` field exists on the metrics table.

---

## Task 1: Define Metric Variations Type and Constants

**Files:**
- Modify: `src/shared/metricTemplates.ts`

**Step 1: Write unit test for variation types**

Create test file `src/shared/metricTemplates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  METRIC_VARIATIONS,
  LIFECYCLE_SLOTS,
} from "./metricTemplates";

describe("Metric Variations", () => {
  it("defines four variation types", () => {
    expect(METRIC_VARIATIONS).toEqual(["rate", "time_to", "frequency", "cohort"]);
  });

  it("defines five lifecycle slots", () => {
    expect(LIFECYCLE_SLOTS).toEqual([
      "account_creation",
      "activation",
      "core_usage",
      "revenue",
      "churn",
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: FAIL with "METRIC_VARIATIONS is not exported"

**Step 3: Add variation types and constants**

Add after line 14 in `src/shared/metricTemplates.ts` (after MetricCategory):

```typescript
// Metric variation types for slot-specific templates
export const METRIC_VARIATIONS = ["rate", "time_to", "frequency", "cohort"] as const;
export type MetricVariation = (typeof METRIC_VARIATIONS)[number];

// Lifecycle slots that activities can belong to
export const LIFECYCLE_SLOTS = [
  "account_creation",
  "activation",
  "core_usage",
  "revenue",
  "churn",
] as const;
export type LifecycleSlot = (typeof LIFECYCLE_SLOTS)[number];
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/metricTemplates.ts src/shared/metricTemplates.test.ts
git commit -m "$(cat <<'EOF'
feat: define metric variation types and lifecycle slots

Adds METRIC_VARIATIONS (rate, time_to, frequency, cohort) and
LIFECYCLE_SLOTS constants as foundation for slot-specific templates.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Define SlotVariationTemplate Type

**Files:**
- Modify: `src/shared/metricTemplates.ts`
- Modify: `src/shared/metricTemplates.test.ts`

**Step 1: Write test for SlotVariationTemplate structure**

Add to `src/shared/metricTemplates.test.ts`:

```typescript
import {
  METRIC_VARIATIONS,
  LIFECYCLE_SLOTS,
  type SlotVariationTemplate,
} from "./metricTemplates";

describe("SlotVariationTemplate type", () => {
  it("accepts a valid template object", () => {
    const template: SlotVariationTemplate = {
      variation: "rate",
      name: "{{activity}} Rate",
      definition: "Percentage of users who complete {{activity}}",
      formula: "COUNT(completed) / COUNT(eligible) * 100%",
      whyItMatters: "Shows conversion effectiveness",
      howToImprove: "Reduce friction in the flow",
      category: "value_delivery",
      primaryOnly: false,
    };

    expect(template.variation).toBe("rate");
    expect(template.primaryOnly).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: FAIL with "SlotVariationTemplate is not exported"

**Step 3: Add SlotVariationTemplate type**

Add after the LifecycleSlot type definition:

```typescript
// Template for generating metrics from a specific slot + variation combination
export type SlotVariationTemplate = {
  variation: MetricVariation;
  name: string;           // e.g., "{{activity}} Rate" - uses {{activity}} placeholder
  definition: string;     // Rich pre-written guidance
  formula: string;
  whyItMatters: string;
  howToImprove: string;
  category: MetricCategory;
  primaryOnly: boolean;   // true = skip for secondary activities (isFirstValue=false)
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/metricTemplates.ts src/shared/metricTemplates.test.ts
git commit -m "$(cat <<'EOF'
feat: add SlotVariationTemplate type

Defines the structure for slot-specific metric templates with
variation type, placeholder-based content, and primaryOnly flag.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create Account Creation Slot Templates

**Files:**
- Modify: `src/shared/metricTemplates.ts`
- Modify: `src/shared/metricTemplates.test.ts`

**Step 1: Write test for account_creation templates**

Add to `src/shared/metricTemplates.test.ts`:

```typescript
import {
  SLOT_METRIC_TEMPLATES,
} from "./metricTemplates";

describe("SLOT_METRIC_TEMPLATES", () => {
  describe("account_creation slot", () => {
    it("has rate, time_to, and cohort variations (no frequency for one-time event)", () => {
      const templates = SLOT_METRIC_TEMPLATES.account_creation;
      const variations = templates.map(t => t.variation);

      expect(variations).toContain("rate");
      expect(variations).toContain("time_to");
      expect(variations).toContain("cohort");
      expect(variations).not.toContain("frequency");
    });

    it("rate template uses {{activity}} placeholder", () => {
      const rateTemplate = SLOT_METRIC_TEMPLATES.account_creation.find(
        t => t.variation === "rate"
      );
      expect(rateTemplate?.name).toContain("{{activity}}");
      expect(rateTemplate?.definition).toContain("{{activity}}");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: FAIL with "SLOT_METRIC_TEMPLATES is not exported"

**Step 3: Add account_creation templates**

Add after the existing METRIC_TEMPLATES array (after line 138):

```typescript
// Slot-specific metric templates
// Each slot has variations appropriate for that lifecycle stage
export const SLOT_METRIC_TEMPLATES: Record<LifecycleSlot, SlotVariationTemplate[]> = {
  account_creation: [
    {
      variation: "rate",
      name: "{{activity}} Rate",
      definition: "Percentage of visitors who complete {{activity}}. This is the conversion rate at the top of your acquisition funnel.",
      formula: "COUNT(users who completed {{activity}}) / COUNT(visitors) × 100%",
      whyItMatters: "Your account creation rate determines how efficiently you convert interest into registered users. Low rates indicate friction in signup.",
      howToImprove: "Simplify signup forms, reduce required fields, add social login options, improve page load speed, add trust signals.",
      category: "reach",
      primaryOnly: true,
    },
    {
      variation: "time_to",
      name: "Time to {{activity}}",
      definition: "Median time from first site visit to completing {{activity}}. Measures how quickly visitors convert to users.",
      formula: "MEDIAN(time_of_{{activity}} - time_of_first_visit)",
      whyItMatters: "Longer time to signup often means lost users. Users who don't sign up quickly may never return.",
      howToImprove: "Add prominent CTAs, reduce decision friction, offer immediate value preview, implement exit-intent captures.",
      category: "reach",
      primaryOnly: true,
    },
    {
      variation: "cohort",
      name: "{{activity}} by Cohort",
      definition: "{{activity}} rate segmented by signup week/month. Tracks how acquisition quality changes over time.",
      formula: "{{activity}} Rate grouped by cohort_week",
      whyItMatters: "Cohort analysis reveals whether your acquisition is improving. Declining rates may indicate channel saturation.",
      howToImprove: "A/B test signup flows, experiment with new channels, refine targeting, improve landing pages.",
      category: "reach",
      primaryOnly: true,
    },
  ],
  // Other slots defined in subsequent tasks
  activation: [],
  core_usage: [],
  revenue: [],
  churn: [],
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/metricTemplates.ts src/shared/metricTemplates.test.ts
git commit -m "$(cat <<'EOF'
feat: add account_creation slot templates

Defines rate, time_to, and cohort variations for account creation
activities. No frequency variation as account creation is one-time.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create Activation Slot Templates

**Files:**
- Modify: `src/shared/metricTemplates.ts`
- Modify: `src/shared/metricTemplates.test.ts`

**Step 1: Write test for activation templates**

Add to `src/shared/metricTemplates.test.ts`:

```typescript
  describe("activation slot", () => {
    it("has rate, time_to, and cohort variations (no frequency for one-time event)", () => {
      const templates = SLOT_METRIC_TEMPLATES.activation;
      const variations = templates.map(t => t.variation);

      expect(variations).toContain("rate");
      expect(variations).toContain("time_to");
      expect(variations).toContain("cohort");
      expect(variations).not.toContain("frequency");
    });

    it("rate template targets activation as value_delivery category", () => {
      const rateTemplate = SLOT_METRIC_TEMPLATES.activation.find(
        t => t.variation === "rate"
      );
      expect(rateTemplate?.category).toBe("value_delivery");
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: FAIL (activation array is empty)

**Step 3: Add activation templates**

Replace the empty `activation: []` with:

```typescript
  activation: [
    {
      variation: "rate",
      name: "{{activity}} Rate",
      definition: "Percentage of new users who complete {{activity}}. This is your activation rate - the first value delivery checkpoint.",
      formula: "COUNT(users who completed {{activity}}) / COUNT(new users) × 100%",
      whyItMatters: "Users who reach first value are dramatically more likely to become long-term customers. Low activation = leaky bucket.",
      howToImprove: "Simplify onboarding, remove steps before first value, add progress indicators, provide guided walkthroughs.",
      category: "value_delivery",
      primaryOnly: true,
    },
    {
      variation: "time_to",
      name: "Time to {{activity}}",
      definition: "Median time from account creation to completing {{activity}}. Measures how quickly users experience value.",
      formula: "MEDIAN(time_of_{{activity}} - time_of_signup)",
      whyItMatters: "Shorter time to value means faster activation and higher conversion. Every extra day loses potential users.",
      howToImprove: "Reduce signup friction, pre-populate data, offer templates, provide immediate quick wins.",
      category: "value_delivery",
      primaryOnly: true,
    },
    {
      variation: "cohort",
      name: "{{activity}} by Cohort",
      definition: "{{activity}} rate segmented by signup week/month. Tracks whether onboarding is improving.",
      formula: "{{activity}} Rate grouped by signup_cohort",
      whyItMatters: "Cohort trends reveal product and onboarding improvements. Rising rates indicate better time-to-value.",
      howToImprove: "Iterate on onboarding flows, A/B test activation paths, monitor cohort-over-cohort improvement.",
      category: "value_delivery",
      primaryOnly: true,
    },
  ],
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/metricTemplates.ts src/shared/metricTemplates.test.ts
git commit -m "$(cat <<'EOF'
feat: add activation slot templates

Defines rate, time_to, and cohort variations for activation
activities. All marked as primaryOnly since activation is the
key milestone.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create Core Usage Slot Templates

**Files:**
- Modify: `src/shared/metricTemplates.ts`
- Modify: `src/shared/metricTemplates.test.ts`

**Step 1: Write test for core_usage templates**

Add to `src/shared/metricTemplates.test.ts`:

```typescript
  describe("core_usage slot", () => {
    it("has all four variations including frequency (recurring action)", () => {
      const templates = SLOT_METRIC_TEMPLATES.core_usage;
      const variations = templates.map(t => t.variation);

      expect(variations).toContain("rate");
      expect(variations).toContain("time_to");
      expect(variations).toContain("frequency");
      expect(variations).toContain("cohort");
    });

    it("frequency template is engagement category", () => {
      const freqTemplate = SLOT_METRIC_TEMPLATES.core_usage.find(
        t => t.variation === "frequency"
      );
      expect(freqTemplate?.category).toBe("engagement");
    });

    it("has both primary-only and secondary metrics", () => {
      const templates = SLOT_METRIC_TEMPLATES.core_usage;
      const primaryOnlyCount = templates.filter(t => t.primaryOnly).length;
      const secondaryCount = templates.filter(t => !t.primaryOnly).length;

      expect(primaryOnlyCount).toBeGreaterThan(0);
      expect(secondaryCount).toBeGreaterThan(0);
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: FAIL (core_usage array is empty)

**Step 3: Add core_usage templates**

Replace the empty `core_usage: []` with:

```typescript
  core_usage: [
    {
      variation: "rate",
      name: "{{activity}} Rate",
      definition: "Percentage of active users who perform {{activity}} in a given period. Measures adoption of your core feature.",
      formula: "COUNT(users who did {{activity}}) / COUNT(active users) × 100%",
      whyItMatters: "Core action adoption indicates product-market fit. Users who perform core actions derive more value.",
      howToImprove: "Surface the feature prominently, add contextual prompts, reduce friction, show value of the action.",
      category: "engagement",
      primaryOnly: true,
    },
    {
      variation: "time_to",
      name: "Time to First {{activity}}",
      definition: "Median time from signup to first {{activity}}. Measures how quickly users discover your core value.",
      formula: "MEDIAN(time_of_first_{{activity}} - time_of_signup)",
      whyItMatters: "Faster discovery of core features correlates with higher retention. Users need to find value quickly.",
      howToImprove: "Guide users to core features in onboarding, use empty states effectively, provide templates.",
      category: "engagement",
      primaryOnly: true,
    },
    {
      variation: "frequency",
      name: "{{activity}} Frequency",
      definition: "Average number of times users perform {{activity}} per period. Measures depth of engagement.",
      formula: "COUNT({{activity}} events) / COUNT(active users) per period",
      whyItMatters: "Users who perform core actions more frequently derive more value and are less likely to churn.",
      howToImprove: "Remove friction from the action, add features that encourage repeated use, surface relevant prompts.",
      category: "engagement",
      primaryOnly: false,
    },
    {
      variation: "cohort",
      name: "{{activity}} by Cohort",
      definition: "{{activity}} rate and frequency segmented by signup week/month. Tracks engagement quality over time.",
      formula: "{{activity}} metrics grouped by signup_cohort",
      whyItMatters: "Cohort analysis reveals whether engagement is improving. Useful for measuring product changes.",
      howToImprove: "Compare cohorts to identify what drives engagement, replicate successful patterns.",
      category: "engagement",
      primaryOnly: true,
    },
  ],
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/metricTemplates.ts src/shared/metricTemplates.test.ts
git commit -m "$(cat <<'EOF'
feat: add core_usage slot templates

Defines all four variations for recurring core usage activities.
Frequency is not primaryOnly since it's useful for secondary
engagement tracking too.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create Revenue Slot Templates

**Files:**
- Modify: `src/shared/metricTemplates.ts`
- Modify: `src/shared/metricTemplates.test.ts`

**Step 1: Write test for revenue templates**

Add to `src/shared/metricTemplates.test.ts`:

```typescript
  describe("revenue slot", () => {
    it("has all four variations (recurring event)", () => {
      const templates = SLOT_METRIC_TEMPLATES.revenue;
      const variations = templates.map(t => t.variation);

      expect(variations).toContain("rate");
      expect(variations).toContain("time_to");
      expect(variations).toContain("frequency");
      expect(variations).toContain("cohort");
    });

    it("rate template is value_capture category", () => {
      const rateTemplate = SLOT_METRIC_TEMPLATES.revenue.find(
        t => t.variation === "rate"
      );
      expect(rateTemplate?.category).toBe("value_capture");
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: FAIL (revenue array is empty)

**Step 3: Add revenue templates**

Replace the empty `revenue: []` with:

```typescript
  revenue: [
    {
      variation: "rate",
      name: "{{activity}} Rate",
      definition: "Percentage of eligible users who complete {{activity}}. Measures monetization effectiveness.",
      formula: "COUNT(users who did {{activity}}) / COUNT(eligible users) × 100%",
      whyItMatters: "Conversion rate directly impacts revenue. Understanding what drives conversion helps optimize the funnel.",
      howToImprove: "Reduce friction in payment flow, offer trials, improve value communication, optimize pricing.",
      category: "value_capture",
      primaryOnly: true,
    },
    {
      variation: "time_to",
      name: "Time to {{activity}}",
      definition: "Median time from signup to {{activity}}. Measures how quickly users convert to paying.",
      formula: "MEDIAN(time_of_{{activity}} - time_of_signup)",
      whyItMatters: "Faster conversion means better cash flow and indicates strong value delivery. Long delays may indicate unclear value.",
      howToImprove: "Demonstrate value earlier, offer time-limited trials, improve onboarding to show premium features.",
      category: "value_capture",
      primaryOnly: true,
    },
    {
      variation: "frequency",
      name: "{{activity}} Frequency",
      definition: "Average number of {{activity}} events per paying user. Measures expansion revenue potential.",
      formula: "COUNT({{activity}} events) / COUNT(paying users) per period",
      whyItMatters: "Repeat purchases and upgrades drive expansion revenue. Higher frequency indicates strong value delivery.",
      howToImprove: "Introduce usage-based pricing, offer add-ons, create upgrade paths, reward loyal customers.",
      category: "value_capture",
      primaryOnly: false,
    },
    {
      variation: "cohort",
      name: "{{activity}} by Cohort",
      definition: "{{activity}} rate segmented by signup week/month. Tracks monetization efficiency over time.",
      formula: "{{activity}} Rate grouped by signup_cohort",
      whyItMatters: "Cohort analysis reveals whether monetization is improving and helps identify successful acquisition channels.",
      howToImprove: "Compare cohorts to identify high-converting segments, optimize for quality over quantity.",
      category: "value_capture",
      primaryOnly: true,
    },
  ],
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/metricTemplates.ts src/shared/metricTemplates.test.ts
git commit -m "$(cat <<'EOF'
feat: add revenue slot templates

Defines all four variations for revenue activities.
Frequency is not primaryOnly to support expansion revenue tracking.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Create Churn Slot Templates

**Files:**
- Modify: `src/shared/metricTemplates.ts`
- Modify: `src/shared/metricTemplates.test.ts`

**Step 1: Write test for churn templates**

Add to `src/shared/metricTemplates.test.ts`:

```typescript
  describe("churn slot", () => {
    it("has rate, time_to, and cohort variations (no frequency for one-time event)", () => {
      const templates = SLOT_METRIC_TEMPLATES.churn;
      const variations = templates.map(t => t.variation);

      expect(variations).toContain("rate");
      expect(variations).toContain("time_to");
      expect(variations).toContain("cohort");
      expect(variations).not.toContain("frequency");
    });

    it("rate template is value_capture category (churn impacts retention)", () => {
      const rateTemplate = SLOT_METRIC_TEMPLATES.churn.find(
        t => t.variation === "rate"
      );
      expect(rateTemplate?.category).toBe("value_capture");
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: FAIL (churn array is empty)

**Step 3: Add churn templates**

Replace the empty `churn: []` with:

```typescript
  churn: [
    {
      variation: "rate",
      name: "{{activity}} Rate",
      definition: "Percentage of users who complete {{activity}} (churning) in a given period. Inverse of retention.",
      formula: "COUNT(users who did {{activity}}) / COUNT(active users at period start) × 100%",
      whyItMatters: "Churn directly erodes your user base and revenue. Understanding churn patterns is critical for growth.",
      howToImprove: "Identify at-risk users early, improve engagement, address common complaints, offer win-back campaigns.",
      category: "value_capture",
      primaryOnly: true,
    },
    {
      variation: "time_to",
      name: "Time to {{activity}}",
      definition: "Median time from signup to {{activity}}. Reveals when users typically disengage.",
      formula: "MEDIAN(time_of_{{activity}} - time_of_signup)",
      whyItMatters: "Understanding when churn happens helps target interventions. Early churn indicates activation problems.",
      howToImprove: "Focus on the period before typical churn, add re-engagement at critical moments, improve value delivery.",
      category: "value_capture",
      primaryOnly: true,
    },
    {
      variation: "cohort",
      name: "{{activity}} by Cohort",
      definition: "{{activity}} rate segmented by signup week/month. Tracks retention quality over time.",
      formula: "{{activity}} Rate grouped by signup_cohort",
      whyItMatters: "Cohort analysis reveals whether retention is improving. Key for measuring product-market fit progress.",
      howToImprove: "Compare cohorts to identify improvements, correlate with product changes, target weak cohorts.",
      category: "value_capture",
      primaryOnly: true,
    },
  ],
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/metricTemplates.ts src/shared/metricTemplates.test.ts
git commit -m "$(cat <<'EOF'
feat: add churn slot templates

Defines rate, time_to, and cohort variations for churn activities.
No frequency variation as churn is a one-time event per user.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Create Fallback Templates for Slotless Activities

**Files:**
- Modify: `src/shared/metricTemplates.ts`
- Modify: `src/shared/metricTemplates.test.ts`

**Step 1: Write test for fallback templates**

Add to `src/shared/metricTemplates.test.ts`:

```typescript
describe("FALLBACK_TEMPLATES", () => {
  it("provides count and frequency variations for slotless activities", () => {
    const variations = FALLBACK_TEMPLATES.map(t => t.variation);

    expect(variations).toContain("rate");
    expect(variations).toContain("frequency");
    expect(variations).toHaveLength(2);
  });

  it("marks all fallback templates as not primaryOnly", () => {
    const allSecondary = FALLBACK_TEMPLATES.every(t => !t.primaryOnly);
    expect(allSecondary).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: FAIL with "FALLBACK_TEMPLATES is not exported"

**Step 3: Add fallback templates**

Add after the SLOT_METRIC_TEMPLATES definition:

```typescript
// Fallback templates for activities without a lifecycle slot
// Only basic tracking - count and frequency
export const FALLBACK_TEMPLATES: SlotVariationTemplate[] = [
  {
    variation: "rate",
    name: "{{activity}} Rate",
    definition: "Percentage of active users who perform {{activity}} in a given period.",
    formula: "COUNT(users who did {{activity}}) / COUNT(active users) × 100%",
    whyItMatters: "Tracking adoption of this activity helps understand user behavior patterns.",
    howToImprove: "Consider whether this activity should be promoted or if it indicates an issue.",
    category: "engagement",
    primaryOnly: false,
  },
  {
    variation: "frequency",
    name: "{{activity}} Frequency",
    definition: "Average number of times users perform {{activity}} per period.",
    formula: "COUNT({{activity}} events) / COUNT(active users) per period",
    whyItMatters: "Frequency indicates how integral this activity is to user workflows.",
    howToImprove: "If this is important, make it easier. If it's undesirable, investigate why it happens.",
    category: "engagement",
    primaryOnly: false,
  },
];
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/metricTemplates.ts src/shared/metricTemplates.test.ts
git commit -m "$(cat <<'EOF'
feat: add fallback templates for slotless activities

Provides basic rate and frequency tracking for activities that
don't have a lifecycle slot. Both are not primaryOnly.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add Template Interpolation Helper

**Files:**
- Modify: `src/shared/metricTemplates.ts`
- Modify: `src/shared/metricTemplates.test.ts`

**Step 1: Write test for slot template interpolation**

Add to `src/shared/metricTemplates.test.ts`:

```typescript
import {
  interpolateSlotTemplate,
} from "./metricTemplates";

describe("interpolateSlotTemplate", () => {
  it("replaces {{activity}} placeholder with activity name", () => {
    const template: SlotVariationTemplate = {
      variation: "rate",
      name: "{{activity}} Rate",
      definition: "Percentage who complete {{activity}}",
      formula: "COUNT({{activity}})",
      whyItMatters: "{{activity}} matters",
      howToImprove: "Improve {{activity}}",
      category: "engagement",
      primaryOnly: false,
    };

    const result = interpolateSlotTemplate(template, "Report Generated");

    expect(result.name).toBe("Report Generated Rate");
    expect(result.definition).toBe("Percentage who complete Report Generated");
    expect(result.formula).toBe("COUNT(Report Generated)");
    expect(result.whyItMatters).toBe("Report Generated matters");
    expect(result.howToImprove).toBe("Improve Report Generated");
  });

  it("preserves non-placeholder content", () => {
    const template: SlotVariationTemplate = {
      variation: "rate",
      name: "{{activity}} Rate",
      definition: "This is a rate metric for {{activity}}.",
      formula: "COUNT({{activity}}) / TOTAL",
      whyItMatters: "Important because...",
      howToImprove: "Do better things.",
      category: "engagement",
      primaryOnly: false,
    };

    const result = interpolateSlotTemplate(template, "Signup");

    expect(result.definition).toBe("This is a rate metric for Signup.");
    expect(result.whyItMatters).toBe("Important because...");
    expect(result.howToImprove).toBe("Do better things.");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: FAIL with "interpolateSlotTemplate is not exported"

**Step 3: Add interpolation helper**

Add after the FALLBACK_TEMPLATES definition:

```typescript
// Type for interpolated slot template (ready for metric creation)
export type InterpolatedSlotTemplate = Omit<SlotVariationTemplate, "primaryOnly">;

/**
 * Replaces {{activity}} placeholder in slot template fields with the actual activity name.
 */
export function interpolateSlotTemplate(
  template: SlotVariationTemplate,
  activityName: string
): InterpolatedSlotTemplate {
  const interpolate = (text: string): string =>
    text.replaceAll("{{activity}}", activityName);

  return {
    variation: template.variation,
    name: interpolate(template.name),
    definition: interpolate(template.definition),
    formula: interpolate(template.formula),
    whyItMatters: interpolate(template.whyItMatters),
    howToImprove: interpolate(template.howToImprove),
    category: template.category,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/metricTemplates.ts src/shared/metricTemplates.test.ts
git commit -m "$(cat <<'EOF'
feat: add interpolateSlotTemplate helper

Replaces {{activity}} placeholder with the actual activity name
in all template fields.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add getTemplatesForActivity Helper

**Files:**
- Modify: `src/shared/metricTemplates.ts`
- Modify: `src/shared/metricTemplates.test.ts`

**Step 1: Write test for getTemplatesForActivity**

Add to `src/shared/metricTemplates.test.ts`:

```typescript
import {
  getTemplatesForActivity,
  type LifecycleSlot,
} from "./metricTemplates";

describe("getTemplatesForActivity", () => {
  it("returns slot templates for activity with lifecycle slot", () => {
    const templates = getTemplatesForActivity({
      lifecycleSlot: "activation" as LifecycleSlot,
      isFirstValue: true,
    });

    expect(templates.length).toBeGreaterThan(0);
    expect(templates.some(t => t.variation === "rate")).toBe(true);
  });

  it("filters primaryOnly templates when isFirstValue is false", () => {
    const primaryTemplates = getTemplatesForActivity({
      lifecycleSlot: "core_usage" as LifecycleSlot,
      isFirstValue: true,
    });

    const secondaryTemplates = getTemplatesForActivity({
      lifecycleSlot: "core_usage" as LifecycleSlot,
      isFirstValue: false,
    });

    expect(secondaryTemplates.length).toBeLessThan(primaryTemplates.length);
  });

  it("returns fallback templates for activity without lifecycle slot", () => {
    const templates = getTemplatesForActivity({
      lifecycleSlot: undefined,
      isFirstValue: false,
    });

    expect(templates).toHaveLength(2); // rate and frequency fallbacks
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: FAIL with "getTemplatesForActivity is not exported"

**Step 3: Add getTemplatesForActivity helper**

Add after interpolateSlotTemplate:

```typescript
/**
 * Returns applicable templates for an activity based on its lifecycle slot and primary status.
 *
 * @param activity - Object with lifecycleSlot and isFirstValue properties
 * @returns Array of slot variation templates (before interpolation)
 */
export function getTemplatesForActivity(activity: {
  lifecycleSlot?: LifecycleSlot | string;
  isFirstValue: boolean;
}): SlotVariationTemplate[] {
  // Get base templates - slot-specific or fallback
  const baseTemplates = activity.lifecycleSlot && activity.lifecycleSlot in SLOT_METRIC_TEMPLATES
    ? SLOT_METRIC_TEMPLATES[activity.lifecycleSlot as LifecycleSlot]
    : FALLBACK_TEMPLATES;

  // Filter out primaryOnly templates if this is a secondary activity
  if (!activity.isFirstValue) {
    return baseTemplates.filter(t => !t.primaryOnly);
  }

  return baseTemplates;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/metricTemplates.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/metricTemplates.ts src/shared/metricTemplates.test.ts
git commit -m "$(cat <<'EOF'
feat: add getTemplatesForActivity helper

Returns slot-specific or fallback templates based on activity's
lifecycle slot and filters primaryOnly templates for secondary
activities.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Create generateFromMeasurementPlan Mutation

**Files:**
- Modify: `convex/metricCatalog.ts`
- Modify: `convex/metricCatalog.test.ts`

**Step 1: Write test for generateFromMeasurementPlan**

Add new describe block to `convex/metricCatalog.test.ts`:

```typescript
import {
  getTemplatesForActivity,
  interpolateSlotTemplate,
  type LifecycleSlot,
} from "../src/shared/metricTemplates";

describe("generateFromMeasurementPlan", () => {
  it("generates metrics from slot-specific templates for primary activity", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create activation activity (primary)
    await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "test",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "test",
        createdAt: Date.now(),
      });
    });

    await asUser.mutation(api.metricCatalog.generateFromMeasurementPlan, {});

    const metrics = await asUser.query(api.metrics.list, {});

    // Activation slot has 3 templates (rate, time_to, cohort)
    expect(metrics).toHaveLength(3);
    expect(metrics.map(m => m.name)).toContain("Project Created Rate");
  });

  it("generates fewer metrics for secondary activities", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create core_usage activity (secondary)
    await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "test",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Report Generated",
        action: "Generated",
        lifecycleSlot: "core_usage",
        isFirstValue: false,
        suggestedFrom: "test",
        createdAt: Date.now(),
      });
    });

    await asUser.mutation(api.metricCatalog.generateFromMeasurementPlan, {});

    const metrics = await asUser.query(api.metrics.list, {});

    // Secondary core_usage only gets frequency (primaryOnly=false)
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe("Report Generated Frequency");
  });

  it("uses fallback templates for activities without lifecycle slot", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create activity without slot
    await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Custom",
        suggestedFrom: "test",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Custom Action",
        action: "Performed",
        lifecycleSlot: undefined,
        isFirstValue: false,
        suggestedFrom: "test",
        createdAt: Date.now(),
      });
    });

    await asUser.mutation(api.metricCatalog.generateFromMeasurementPlan, {});

    const metrics = await asUser.query(api.metrics.list, {});

    // Fallback has 2 templates (rate, frequency)
    expect(metrics).toHaveLength(2);
  });

  it("links sourceActivityId to the source activity", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    let activityId: Id<"measurementActivities">;
    await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "test",
        createdAt: Date.now(),
      });

      activityId = await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "test",
        createdAt: Date.now(),
      });
    });

    await asUser.mutation(api.metricCatalog.generateFromMeasurementPlan, {});

    const metrics = await asUser.query(api.metrics.list, {});

    expect(metrics.every(m => m.sourceActivityId === activityId!)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/metricCatalog.test.ts -t "generateFromMeasurementPlan" --run`
Expected: FAIL with "generateFromMeasurementPlan is not a function"

**Step 3: Add generateFromMeasurementPlan mutation**

Add to `convex/metricCatalog.ts` after the existing mutations:

```typescript
import {
  getTemplatesByPhase,
  getTemplatesForActivity,
  interpolateSlotTemplate,
  type LifecycleSlot,
} from "../src/shared/metricTemplates";

// Generate metrics from measurement plan using slot-specific templates
export const generateFromMeasurementPlan = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Get authenticated user
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // 2. Get all measurementActivities for this user
    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // 3. Get existing metrics to check for duplicates
    const existingMetrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Track existing metrics by sourceActivityId + variation combo
    const existingKeys = new Set(
      existingMetrics.map((m) => `${m.sourceActivityId}-${m.templateKey}`)
    );

    // Find highest existing order
    const maxOrder =
      existingMetrics.length > 0
        ? Math.max(...existingMetrics.map((m) => m.order))
        : 0;

    let nextOrder = maxOrder + 1;
    const now = Date.now();
    let created = 0;
    let skipped = 0;

    // 4. Generate metrics for each activity
    for (const activity of activities) {
      const templates = getTemplatesForActivity({
        lifecycleSlot: activity.lifecycleSlot as LifecycleSlot | undefined,
        isFirstValue: activity.isFirstValue,
      });

      for (const template of templates) {
        // Create unique key for this activity + variation
        const key = `${activity._id}-${template.variation}`;

        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        const interpolated = interpolateSlotTemplate(template, activity.name);

        await ctx.db.insert("metrics", {
          userId: user._id,
          name: interpolated.name,
          definition: interpolated.definition,
          formula: interpolated.formula,
          whyItMatters: interpolated.whyItMatters,
          howToImprove: interpolated.howToImprove,
          category: interpolated.category,
          metricType: "generated",
          templateKey: template.variation, // Use variation as template key
          sourceActivityId: activity._id,
          order: nextOrder++,
          createdAt: now,
        });
        created++;
      }
    }

    return { created, skipped };
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/metricCatalog.test.ts -t "generateFromMeasurementPlan" --run`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/metricCatalog.ts convex/metricCatalog.test.ts
git commit -m "$(cat <<'EOF'
feat: add generateFromMeasurementPlan mutation

Generates metrics for all measurement activities using slot-specific
templates. Primary activities get full variations, secondary get
only non-primaryOnly templates. Links sourceActivityId for tracing.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Final Verification

**Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No linting errors

**Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: cleanup after metric variation templates implementation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

This plan implements metric variation templates in 12 tasks:

1. **Define variation types** - METRIC_VARIATIONS and LIFECYCLE_SLOTS constants
2. **SlotVariationTemplate type** - Structure for slot-specific templates
3. **Account creation templates** - rate, time_to, cohort (no frequency)
4. **Activation templates** - rate, time_to, cohort (no frequency)
5. **Core usage templates** - rate, time_to, frequency, cohort (all 4)
6. **Revenue templates** - rate, time_to, frequency, cohort (all 4)
7. **Churn templates** - rate, time_to, cohort (no frequency)
8. **Fallback templates** - rate, frequency for slotless activities
9. **Interpolation helper** - Replace {{activity}} placeholder
10. **getTemplatesForActivity helper** - Select templates based on slot and primary status
11. **generateFromMeasurementPlan mutation** - Generate metrics from activities
12. **Final verification** - Full test suite, types, lint

Each task follows TDD: write failing test → implement → verify pass → commit.

**Dependency Note:** This plan assumes the metrics table has `sourceActivityId` field (from metric-generation-refactor plan). If not yet implemented, Task 11 will need schema changes first.
