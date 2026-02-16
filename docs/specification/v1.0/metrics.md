# MetricsSection and OutcomesSection

This document covers two related sections of the ProductProfile: **MetricsSection** and **OutcomesSection**. They are combined here because they are closely related in the P&L framework -- metrics measure product performance, and outcomes describe the business results those metrics drive.

---

## MetricsSection

### Purpose

MetricsSection catalogs the key performance metrics for a product, organized by the P&L framework layers: Reach, Engagement, Value Delivery, and Value Capture. Each metric is linked to the product features it measures, creating a traceable connection from feature to business outcome.

### Type Definition

```typescript
interface MetricsSection {
  items: MetricItem[];
  confidence: number;
  evidence: Evidence[];
}

interface MetricItem {
  name: string;
  category: string;
  formula?: string;
  linkedTo: string[];
}
```

Source: `@basesignal/core` -- [`packages/core/src/types/profile.ts`](../../../packages/core/src/types/profile.ts)

### Field Reference

#### MetricsSection

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `items` | `MetricItem[]` | Yes | Catalog of metrics | Array |
| `confidence` | `number` | Yes | Extraction confidence | 0-1 |
| `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

#### MetricItem

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `name` | `string` | Yes | Metric name (e.g., "Weekly Active Users") | Non-empty |
| `category` | `string` | Yes | P&L layer category | Non-empty |
| `formula` | `string` | No | How the metric is calculated | -- |
| `linkedTo` | `string[]` | Yes | Features this metric relates to | Array of strings |

### P&L Framework Mapping

Metric categories map to the four layers of the Basesignal P&L framework:

| Category | What It Measures | Example Metrics |
|----------|-----------------|-----------------|
| `reach` | New user volume, trial starts, activation rate | Signup Rate, Trial Starts, Website Visitors |
| `engagement` | Active rate, feature adoption, usage intensity | Weekly Active Users, Feature Adoption Rate, Sessions Per Week |
| `value_delivery` | User-defined activation/active rules, derived account states | Activation Rate, First Value Time, Active Account Rate |
| `value_capture` | Conversion, retention, expansion rates | Trial-to-Paid Conversion, Net Revenue Retention, Expansion Rate |

### Example

```json
{
  "items": [
    { "name": "Weekly Active Users", "category": "engagement", "formula": "COUNT(DISTINCT users WHERE active_last_7d)", "linkedTo": ["Issue tracking", "Sprint planning"] },
    { "name": "Trial-to-Paid Conversion", "category": "value_capture", "formula": "paid_users / trial_users", "linkedTo": ["Onboarding flow"] },
    { "name": "Signup Rate", "category": "reach", "linkedTo": ["Landing page", "Pricing page"] }
  ],
  "confidence": 0.78,
  "evidence": [
    { "url": "https://linear.app/pricing", "excerpt": "Start free, upgrade when ready" }
  ]
}
```

---

## OutcomesSection

### Purpose

OutcomesSection describes the business results the product enables and links them to specific features. While metrics measure what is happening, outcomes describe why it matters -- the value proposition as experienced by the customer.

### Type Definition

```typescript
interface OutcomesSection {
  items: OutcomeItem[];
  confidence: number;
  evidence: Evidence[];
}

interface OutcomeItem {
  description: string;
  type: string;
  linkedFeatures: string[];
}
```

Source: `@basesignal/core` -- [`packages/core/src/types/profile.ts`](../../../packages/core/src/types/profile.ts)

### Field Reference

#### OutcomesSection

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `items` | `OutcomeItem[]` | Yes | Business outcomes | Array |
| `confidence` | `number` | Yes | Extraction confidence | 0-1 |
| `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

#### OutcomeItem

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `description` | `string` | Yes | The outcome statement | Non-empty |
| `type` | `string` | Yes | Outcome category (e.g., "efficiency", "visibility", "cost_reduction") | Non-empty |
| `linkedFeatures` | `string[]` | Yes | Features that drive this outcome | Array of strings |

### Example

```json
{
  "items": [
    { "description": "Engineering teams ship features 2x faster", "type": "efficiency", "linkedFeatures": ["Issue tracking", "Cycles", "Auto-triage"] },
    { "description": "Product managers gain real-time project visibility", "type": "visibility", "linkedFeatures": ["Roadmaps", "Project views", "Updates"] }
  ],
  "confidence": 0.72,
  "evidence": [
    { "url": "https://linear.app/customers", "excerpt": "Teams ship faster with Linear" }
  ]
}
```

---

## Confidence Scoring

For both sections, the `confidence` field (0-1) reflects how reliably the metrics or outcomes were identified.

- **High (0.8-1.0)**: Product explicitly publishes performance claims, case studies, or documented metrics. Outcomes directly quoted from customer testimonials or marketing.
- **Medium (0.5-0.79)**: Metrics inferred from product features and typical patterns for the product category. Outcomes extrapolated from feature descriptions.
- **Low (0.0-0.49)**: Metrics and outcomes are largely assumed based on the product type. Limited direct evidence from crawled pages.

## Evidence

Evidence arrays in both sections link extracted data back to source URLs. Metrics evidence typically comes from pricing pages, feature comparisons, and analytics descriptions. Outcomes evidence comes from customer stories, case studies, and marketing pages that describe business impact.
