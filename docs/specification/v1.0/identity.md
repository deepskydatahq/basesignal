# CoreIdentity

## Purpose

CoreIdentity captures the foundational product identity extracted from crawled website pages. It is populated during the initial analysis phase from homepage, about, and features pages. This section answers the question: "What is this product, who is it for, and how does it make money?"

## Type Definition

```typescript
interface CoreIdentity {
  productName: string;
  description: string;
  targetCustomer: string;
  businessModel: string;
  industry?: string;
  companyStage?: string;
  confidence: number;
  evidence: Evidence[];
}

interface Evidence {
  url: string;
  excerpt: string;
}
```

Source: `@basesignal/core` -- [`packages/core/src/types/profile.ts`](../../../packages/core/src/types/profile.ts)

## Field Reference

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `productName` | `string` | Yes | The product's name | Non-empty |
| `description` | `string` | Yes | Brief product description | Non-empty |
| `targetCustomer` | `string` | Yes | Who the product serves | Non-empty |
| `businessModel` | `string` | Yes | How the product generates revenue | Non-empty |
| `industry` | `string` | No | Industry vertical | -- |
| `companyStage` | `string` | No | Company maturity stage | -- |
| `confidence` | `number` | Yes | Extraction confidence score | 0-1 |
| `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

## Example

```json
{
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
}
```

## Confidence Scoring

The `confidence` field (0-1) reflects how reliably the identity was extracted from the crawled pages.

- **High (0.8-1.0)**: Product name and description found on multiple pages. Pricing page confirms business model. Target customer explicitly stated.
- **Medium (0.5-0.79)**: Fewer corroborating sources. Business model inferred from indirect signals (e.g., "sign up" button implies SaaS but no pricing page found).
- **Low (0.0-0.49)**: Single source only. Significant inference required. Product name or business model may be ambiguous.

## Evidence

The `evidence` array links each extracted data point back to a specific URL and text excerpt from the crawled page. Each entry contains:

- `url`: The page URL where the information was found.
- `excerpt`: A short text snippet from that page supporting the extracted data.

Evidence serves two purposes: it provides an audit trail for the extraction, and it allows users to verify or correct the analysis by visiting the source pages.
