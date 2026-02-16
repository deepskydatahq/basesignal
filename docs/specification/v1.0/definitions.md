# DefinitionsMap

## Purpose

The DefinitionsMap contains behavioral definitions for user lifecycle states. It defines when a user is considered activated, has received first value, is actively engaged, is at risk, or has churned. These are the measurable criteria that drive the P&L framework -- they translate qualitative product understanding into quantifiable thresholds.

## Type Definitions

```typescript
interface DefinitionsMap {
  activation?: ActivationDefinition;
  firstValue?: FirstValueDefinition;
  active?: LifecycleDefinition;
  atRisk?: LifecycleDefinition;
  churn?: LifecycleDefinition;
}

// Union type: legacy flat OR multi-level
type ActivationDefinition = LegacyActivationDefinition | MultiLevelActivationDefinition;

interface LegacyActivationDefinition {
  criteria: string[];
  timeWindow?: string;
  reasoning: string;
  confidence: number;
  source: string;
  evidence: Evidence[];
}

interface MultiLevelActivationDefinition {
  levels: ActivationLevelDef[];
  primaryActivation?: number;
  overallConfidence: number;
}

interface ActivationLevelDef {
  level: number;
  name: string;
  signalStrength: SignalStrength;
  criteria: ActivationCriterion[];
  reasoning: string;
  confidence: number;
  evidence: Evidence[];
}

interface ActivationCriterion {
  action: string;
  count: number;
  timeWindow?: string;
}

type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

// Used by active, atRisk, churn
interface LifecycleDefinition {
  criteria: string[];
  timeWindow?: string;
  reasoning: string;
  confidence: number;
  source: string;
  evidence: Evidence[];
}

// Used by firstValue (extends LifecycleDefinition with required description)
interface FirstValueDefinition {
  description: string;
  criteria: string[];
  timeWindow?: string;
  reasoning: string;
  confidence: number;
  source: string;
  evidence: Evidence[];
}
```

Source: `@basesignal/core` -- [`packages/core/src/types/profile.ts`](../../../packages/core/src/types/profile.ts)

## Lifecycle States Overview

The five lifecycle states map directly to the P&L framework:

- **`activation`**: When a user first derives meaningful value from the product. Supports both a simple criteria list (legacy format) and a structured multi-level format with signal strengths. This is the most complex definition because activation is often a progressive, multi-step process.
- **`firstValue`**: The specific moment of first value delivery -- the "aha moment" when the user sees the product's core benefit. Requires a `description` field explaining the moment.
- **`active`**: Ongoing engagement criteria that define a healthy, regularly-using customer.
- **`atRisk`**: Disengagement signals -- declining usage patterns that predict potential churn.
- **`churn`**: Loss criteria -- the point at which a user is considered lost.

## Field Reference

### DefinitionsMap

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `activation` | `ActivationDefinition` | No | Activation criteria (legacy or multi-level) | Union type |
| `firstValue` | `FirstValueDefinition` | No | First value moment definition | Has required `description` |
| `active` | `LifecycleDefinition` | No | Active user criteria | -- |
| `atRisk` | `LifecycleDefinition` | No | At-risk signals | -- |
| `churn` | `LifecycleDefinition` | No | Churn criteria | -- |

### LegacyActivationDefinition

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `criteria` | `string[]` | Yes | Human-readable activation criteria | Array of strings |
| `timeWindow` | `string` | No | Time window for criteria (e.g., `"7d"`, `"30d"`) | -- |
| `reasoning` | `string` | Yes | Why these criteria indicate activation | Non-empty |
| `confidence` | `number` | Yes | Confidence in the definition | 0-1 |
| `source` | `string` | Yes | How the definition was derived | Non-empty |
| `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

### MultiLevelActivationDefinition

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `levels` | `ActivationLevelDef[]` | Yes | Ordered activation levels | Array |
| `primaryActivation` | `number` | No | Which level is the primary activation threshold | -- |
| `overallConfidence` | `number` | Yes | Overall confidence across levels | 0-1 |

### ActivationLevelDef

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `level` | `number` | Yes | Level number (1, 2, 3, ...) | Positive integer |
| `name` | `string` | Yes | Human-readable level name | Non-empty |
| `signalStrength` | `SignalStrength` | Yes | How strong this activation signal is | `"weak"` \| `"medium"` \| `"strong"` \| `"very_strong"` |
| `criteria` | `ActivationCriterion[]` | Yes | Structured criteria for this level | Array |
| `reasoning` | `string` | Yes | Why this level matters | Non-empty |
| `confidence` | `number` | Yes | Confidence in this level's definition | 0-1 |
| `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

### ActivationCriterion

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `action` | `string` | Yes | The user action to measure | Non-empty |
| `count` | `number` | Yes | How many times the action must occur | Positive integer |
| `timeWindow` | `string` | No | Time window for the action (e.g., `"7d"`) | -- |

### FirstValueDefinition

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `description` | `string` | Yes | Description of the first value moment | Non-empty |
| `criteria` | `string[]` | Yes | Criteria that indicate first value was delivered | Array of strings |
| `timeWindow` | `string` | No | Expected time window | -- |
| `reasoning` | `string` | Yes | Why these criteria represent first value | Non-empty |
| `confidence` | `number` | Yes | Confidence in the definition | 0-1 |
| `source` | `string` | Yes | How the definition was derived | Non-empty |
| `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

### LifecycleDefinition (active, atRisk, churn)

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `criteria` | `string[]` | Yes | Human-readable criteria | Array of strings |
| `timeWindow` | `string` | No | Time window for criteria | -- |
| `reasoning` | `string` | Yes | Why these criteria define this state | Non-empty |
| `confidence` | `number` | Yes | Confidence in the definition | 0-1 |
| `source` | `string` | Yes | How the definition was derived | Non-empty |
| `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

## Discriminating the Activation Union Type

At runtime, you can distinguish between the two activation formats:

- If the object has a **`levels`** field (array), it is a `MultiLevelActivationDefinition`.
- If the object has a **`criteria`** field (string array) at the top level, it is a `LegacyActivationDefinition`.

```typescript
function isMultiLevel(def: ActivationDefinition): def is MultiLevelActivationDefinition {
  return "levels" in def;
}
```

## Examples

### Legacy Activation (Flat Format)

```json
{
  "criteria": [
    "Create at least one project",
    "Invite at least one team member",
    "Create and triage at least 5 issues"
  ],
  "timeWindow": "14d",
  "reasoning": "Teams that set up a project, invite collaborators, and create real issues within two weeks are likely to adopt the tool",
  "confidence": 0.8,
  "source": "product_analysis",
  "evidence": [
    { "url": "https://linear.app/docs/getting-started", "excerpt": "Start by creating your workspace" }
  ]
}
```

### Multi-Level Activation

```json
{
  "levels": [
    {
      "level": 1,
      "name": "Setup Complete",
      "signalStrength": "weak",
      "criteria": [
        { "action": "create_workspace", "count": 1 },
        { "action": "invite_member", "count": 1 }
      ],
      "reasoning": "Workspace setup with at least one invited member shows intent to use the product collaboratively",
      "confidence": 0.8,
      "evidence": [
        { "url": "https://linear.app/docs/getting-started", "excerpt": "Start by creating your workspace" }
      ]
    },
    {
      "level": 2,
      "name": "First Workflow",
      "signalStrength": "medium",
      "criteria": [
        { "action": "create_issue", "count": 5, "timeWindow": "7d" },
        { "action": "move_issue_status", "count": 3, "timeWindow": "7d" }
      ],
      "reasoning": "Creating and triaging issues shows the team is adopting Linear for real work",
      "confidence": 0.85,
      "evidence": [
        { "url": "https://linear.app/docs/issues", "excerpt": "Issues are the building blocks of Linear" }
      ]
    },
    {
      "level": 3,
      "name": "Team Adoption",
      "signalStrength": "strong",
      "criteria": [
        { "action": "create_cycle", "count": 1 },
        { "action": "create_issue", "count": 20, "timeWindow": "14d" }
      ],
      "reasoning": "Using cycles and high issue volume indicates the team has shifted their workflow to Linear",
      "confidence": 0.9,
      "evidence": [
        { "url": "https://linear.app/docs/cycles", "excerpt": "Cycles help your team maintain a regular shipping cadence" }
      ]
    }
  ],
  "primaryActivation": 2,
  "overallConfidence": 0.85
}
```

### First Value

```json
{
  "description": "The moment a team completes their first sprint cycle and sees velocity metrics",
  "criteria": [
    "Complete at least one cycle with issues",
    "View cycle summary or velocity chart"
  ],
  "timeWindow": "30d",
  "reasoning": "Completing a cycle with real issues and reviewing the results is when teams first see the value of structured project management",
  "confidence": 0.75,
  "source": "product_analysis",
  "evidence": [
    { "url": "https://linear.app/docs/cycles", "excerpt": "Track your team's velocity over time" }
  ]
}
```

### Active

```json
{
  "criteria": [
    "At least 3 team members active in the last 7 days",
    "At least 10 issues created or updated in the last 7 days"
  ],
  "timeWindow": "7d",
  "reasoning": "Active teams use Linear daily for issue tracking and sprint management",
  "confidence": 0.82,
  "source": "product_analysis",
  "evidence": [
    { "url": "https://linear.app/", "excerpt": "Built for the way modern teams work" }
  ]
}
```

### At Risk

```json
{
  "criteria": [
    "Less than 2 team members active in the last 14 days",
    "No issues created in the last 14 days"
  ],
  "timeWindow": "14d",
  "reasoning": "Declining activity signals the team may be reverting to their previous tool",
  "confidence": 0.7,
  "source": "product_analysis",
  "evidence": [
    { "url": "https://linear.app/", "excerpt": "Built for the way modern teams work" }
  ]
}
```

### Churn

```json
{
  "criteria": [
    "No team members active in the last 30 days",
    "Subscription cancelled or expired"
  ],
  "timeWindow": "30d",
  "reasoning": "Complete inactivity combined with subscription loss indicates churn",
  "confidence": 0.88,
  "source": "product_analysis",
  "evidence": [
    { "url": "https://linear.app/pricing", "excerpt": "Cancel anytime" }
  ]
}
```

## Confidence Scoring

Confidence for definitions reflects how well the lifecycle criteria can be determined from available information.

- **High (0.8-1.0)**: Product has explicit documentation about onboarding milestones, engagement metrics, or churn signals. Criteria directly match described user behaviors.
- **Medium (0.5-0.79)**: Criteria inferred from product workflows and common patterns for the product category. Some assumptions about time windows or thresholds.
- **Low (0.0-0.49)**: Limited information about user engagement patterns. Criteria based largely on industry norms rather than product-specific signals.

## Evidence

The `evidence` array in each definition links criteria back to specific URLs and text excerpts. For the multi-level format, evidence is provided per-level, allowing different levels to reference different source pages. This is useful because early activation signals (e.g., signup) typically come from onboarding docs, while deeper activation signals (e.g., team adoption) come from feature documentation.
