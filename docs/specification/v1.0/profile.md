# ProductProfile

The ProductProfile is the root data structure in Basesignal. It is a structured representation of a product's performance model, covering identity, journey, definitions, entities, metrics, outcomes, and revenue. Every product analyzed by Basesignal produces a single ProductProfile that captures what the product is, how users progress through it, and how it generates value.

## Schema Version

Every profile carries a `basesignal_version` field (e.g., `"1.0"`) that identifies which version of the schema was used to produce it.

- **Minor bumps** (1.0 -> 1.1): Additive changes only -- new optional fields, new enum values. Old profiles remain valid against the new schema.
- **Major bumps** (1.0 -> 2.0): Breaking changes -- removed fields, type changes, renames. Old profiles may not validate against the new schema.

The `checkVersion()` utility from `@basesignal/core` compares a profile's version against the library version and returns `"compatible"`, `"needs_migration"`, or `"incompatible"`.

## Section Overview

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `basesignal_version` | `string` | Yes | Schema version (e.g., `"1.0"`) |
| `identity` | [`CoreIdentity`](./identity.md) | No | Core product identity |
| `revenue` | [`RevenueArchitecture`](./revenue.md) | No | Revenue model and pricing |
| `entities` | [`EntityModel`](./entities.md) | No | Data entities the product manages |
| `journey` | [`UserJourney`](./journey.md) | No | User lifecycle stages |
| `definitions` | [`DefinitionsMap`](./definitions.md) | No | Behavioral state definitions |
| `outcomes` | [`OutcomesSection`](./metrics.md#outcomessection) | No | Business outcomes |
| `metrics` | [`MetricsSection`](./metrics.md#metricssection) | No | Key performance metrics |
| `completeness` | `number` | Yes | Fraction of sections populated (0-1) |
| `overallConfidence` | `number` | Yes | Weighted average confidence (0-1) |
| `metadata` | `ProfileMetadata` | No | Creation/update timestamps and source |

## TypeScript Interface

```typescript
interface ProductProfile {
  basesignal_version: string;
  identity?: CoreIdentity;
  revenue?: RevenueArchitecture;
  entities?: EntityModel;
  journey?: UserJourney;
  definitions?: DefinitionsMap;
  outcomes?: OutcomesSection;
  metrics?: MetricsSection;
  completeness: number;
  overallConfidence: number;
  metadata?: ProfileMetadata;
}

interface ProfileMetadata {
  created?: string;
  updated?: string;
  source?: string;
}
```

The canonical TypeScript types are exported from `@basesignal/core`. See [`schema.ts`](./schema.ts) for the re-export file.

## Computed Fields

### `completeness`

Fraction of optional sections that are populated, expressed as a number between 0 and 1. A profile with 3 of 7 sections populated has `completeness = 0.43`. This field is always present and is computed when the profile is built or updated.

### `overallConfidence`

Weighted average of the `confidence` field across all populated sections, expressed as a number between 0 and 1. Sections that are not populated are excluded from the average. This provides a single number summarizing how confident the extraction was across the entire profile.

## Complete Example

The following is a complete ProductProfile for Linear, a modern project management tool built for software teams. All sections are populated with realistic data.

```json
{
  "basesignal_version": "1.0",
  "identity": {
    "productName": "Linear",
    "description": "Modern project management tool built for software teams",
    "targetCustomer": "Software development teams at startups and mid-market companies",
    "businessModel": "Per-seat SaaS subscription",
    "industry": "Developer Tools",
    "companyStage": "Growth",
    "confidence": 0.92,
    "evidence": [
      { "url": "https://linear.app/", "excerpt": "Linear is a better way to build software" },
      { "url": "https://linear.app/pricing", "excerpt": "Per member per month" }
    ]
  },
  "revenue": {
    "model": "Per-seat SaaS subscription",
    "billingUnit": "seat",
    "hasFreeTier": true,
    "tiers": [
      { "name": "Free", "price": "$0/month", "features": ["Up to 250 issues", "Basic integrations"] },
      { "name": "Standard", "price": "$8/user/month", "features": ["Unlimited issues", "Cycles", "Priority support"] },
      { "name": "Plus", "price": "$14/user/month", "features": ["Advanced analytics", "SLA", "SAML SSO"] }
    ],
    "expansionPaths": [
      "Free to Standard: teams hitting the 250 issue limit",
      "Standard to Plus: enterprises needing SSO and compliance",
      "Seat expansion: team growth adds per-user revenue"
    ],
    "contractionRisks": [
      "Team downsizing reduces seat count",
      "Switching to competing tool (Jira, Shortcut)",
      "Plus to Standard downgrade if advanced features unused"
    ],
    "confidence": 0.91,
    "evidence": [
      { "url": "https://linear.app/pricing", "excerpt": "Free for small teams. Standard at $8/user/month." }
    ]
  },
  "entities": {
    "items": [
      { "name": "Issue", "type": "core", "properties": ["title", "status", "priority", "assignee", "labels"] },
      { "name": "Project", "type": "container", "properties": ["name", "lead", "status", "targetDate"] },
      { "name": "Team", "type": "organization", "properties": ["name", "members", "projects"] },
      { "name": "Cycle", "type": "time-bound", "properties": ["name", "startDate", "endDate", "issues"] }
    ],
    "relationships": [
      { "from": "Team", "to": "Project", "type": "has many" },
      { "from": "Project", "to": "Issue", "type": "has many" },
      { "from": "Team", "to": "Cycle", "type": "has many" },
      { "from": "Cycle", "to": "Issue", "type": "contains" }
    ],
    "confidence": 0.88,
    "evidence": [
      { "url": "https://linear.app/docs/issues", "excerpt": "Issues are the building blocks of Linear" }
    ]
  },
  "journey": {
    "stages": [
      { "name": "Discovery", "description": "User visits website and explores features", "order": 0 },
      { "name": "Signup", "description": "Creates account and sets up workspace", "order": 1 },
      { "name": "Onboarding", "description": "Creates first project, invites team members", "order": 2 },
      { "name": "Activation", "description": "Team creates and triages first issues", "order": 3 },
      { "name": "Core Usage", "description": "Daily sprint management and issue tracking", "order": 4 },
      { "name": "Expansion", "description": "Adopts roadmaps, cycles, and integrations", "order": 5 }
    ],
    "confidence": 0.85,
    "evidence": [
      { "url": "https://linear.app/docs/getting-started", "excerpt": "Create your workspace and invite your team" }
    ]
  },
  "definitions": {
    "activation": {
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
    },
    "firstValue": {
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
    },
    "active": {
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
    },
    "atRisk": {
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
    },
    "churn": {
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
  },
  "outcomes": {
    "items": [
      { "description": "Engineering teams ship features 2x faster", "type": "efficiency", "linkedFeatures": ["Issue tracking", "Cycles", "Auto-triage"] },
      { "description": "Product managers gain real-time project visibility", "type": "visibility", "linkedFeatures": ["Roadmaps", "Project views", "Updates"] }
    ],
    "confidence": 0.72,
    "evidence": [
      { "url": "https://linear.app/customers", "excerpt": "Teams ship faster with Linear" }
    ]
  },
  "metrics": {
    "items": [
      { "name": "Weekly Active Users", "category": "engagement", "formula": "COUNT(DISTINCT users WHERE active_last_7d)", "linkedTo": ["Issue tracking", "Sprint planning"] },
      { "name": "Trial-to-Paid Conversion", "category": "value_capture", "formula": "paid_users / trial_users", "linkedTo": ["Onboarding flow"] },
      { "name": "Signup Rate", "category": "reach", "linkedTo": ["Landing page", "Pricing page"] }
    ],
    "confidence": 0.78,
    "evidence": [
      { "url": "https://linear.app/pricing", "excerpt": "Start free, upgrade when ready" }
    ]
  },
  "completeness": 1.0,
  "overallConfidence": 0.83,
  "metadata": {
    "created": "2026-02-15T00:00:00Z",
    "source": "website_analysis"
  }
}
```

## Compatibility Guarantees

1. **Within a major version, profiles are forward-compatible.** A profile written against schema 1.0 will validate against schema 1.1 or 1.2. New fields added in minor versions are always optional.

2. **Within a major version, the schema is backward-compatible.** A library at version 1.2 can read profiles written against schema 1.0 without errors. Unknown fields from newer minor versions are preserved, not rejected.

3. **Major versions make no compatibility promises.** A profile written against schema 1.x may not validate against schema 2.x. Migration utilities will be provided for major version transitions.

4. **`basesignal_version` is always present.** Every valid profile must include this field. It is the mechanism by which consumers determine which schema version to apply.

5. **Unknown fields are preserved, not rejected.** When a consumer encounters fields it does not recognize (e.g., a 1.0 reader parsing a 1.1 profile), those fields are passed through unchanged. They are not stripped or rejected.

## Machine-Readable Schema

- **JSON Schema**: [`schema.json`](./schema.json) -- JSON Schema Draft 2020-12 for validation by non-TypeScript consumers.
- **TypeScript**: [`schema.ts`](./schema.ts) -- Re-exports all types from `@basesignal/core`.
