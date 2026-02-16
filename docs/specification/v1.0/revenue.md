# RevenueArchitecture

## Purpose

The RevenueArchitecture describes how the product captures value: pricing model, billing mechanics, tier structure, upsell vectors, and downgrade risks. This section answers: "How does this product make money, and what drives revenue growth or contraction?"

## Type Definition

```typescript
interface RevenueArchitecture {
  model: string;
  billingUnit?: string;
  hasFreeTier: boolean;
  tiers: PricingTier[];
  expansionPaths: string[];
  contractionRisks: string[];
  confidence: number;
  evidence: Evidence[];
}

interface PricingTier {
  name: string;
  price: string;
  features: string[];
}
```

Source: `@basesignal/core` -- [`packages/core/src/types/profile.ts`](../../../packages/core/src/types/profile.ts)

## Field Reference

### RevenueArchitecture

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `model` | `string` | Yes | Revenue model (e.g., "Per-seat SaaS subscription") | Non-empty |
| `billingUnit` | `string` | No | What the customer pays per (e.g., "seat", "usage") | -- |
| `hasFreeTier` | `boolean` | Yes | Whether a free plan exists | -- |
| `tiers` | `PricingTier[]` | Yes | Available pricing tiers | Array |
| `expansionPaths` | `string[]` | Yes | Upsell/cross-sell vectors | Array of strings |
| `contractionRisks` | `string[]` | Yes | Downgrade trigger scenarios | Array of strings |
| `confidence` | `number` | Yes | Extraction confidence | 0-1 |
| `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

### PricingTier

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `name` | `string` | Yes | Tier name (e.g., "Free", "Standard", "Plus") | Non-empty |
| `price` | `string` | Yes | Price description (e.g., "$8/user/month") | Non-empty |
| `features` | `string[]` | Yes | Features included in this tier | Array of strings |

## Example

```json
{
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
}
```

## Confidence Scoring

The `confidence` field (0-1) reflects how completely the revenue model was extracted from crawled pages.

- **High (0.8-1.0)**: Product has a public pricing page with explicit tier names, prices, and feature lists. Billing model clearly stated. Expansion and contraction paths can be directly inferred from tier differences.
- **Medium (0.5-0.79)**: Pricing page exists but details are incomplete (e.g., "Contact sales" for enterprise tier). Some expansion paths inferred from feature comparisons.
- **Low (0.0-0.49)**: No public pricing page found. Revenue model inferred from indirect signals (e.g., "Sign up for free" implies freemium). Tier structure unknown.

## Evidence

The `evidence` array links revenue architecture data back to specific URLs and text excerpts. Evidence for revenue typically comes from pricing pages, plan comparison tables, and enterprise contact pages. Multiple evidence entries are valuable when different pages confirm different aspects of the revenue model (e.g., pricing page for tiers, features page for expansion triggers).
