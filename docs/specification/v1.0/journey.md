# UserJourney

## Purpose

The UserJourney represents lifecycle stages from first touch through activation, core usage, expansion, and potential churn. It is populated during analysis from product pages that describe user onboarding, workflows, and growth paths. This section maps the progression a user follows as they discover, adopt, and grow with the product.

## Type Definition

```typescript
interface UserJourney {
  stages: JourneyStage[];
  confidence: number;
  evidence: Evidence[];
}

interface JourneyStage {
  name: string;
  description: string;
  order: number;
}
```

Source: `@basesignal/core` -- [`packages/core/src/types/profile.ts`](../../../packages/core/src/types/profile.ts)

## Field Reference

### UserJourney

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `stages` | `JourneyStage[]` | Yes | Ordered lifecycle stages | Array |
| `confidence` | `number` | Yes | Extraction confidence | 0-1 |
| `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

### JourneyStage

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `name` | `string` | Yes | Stage name | Non-empty |
| `description` | `string` | Yes | What happens in this stage | Non-empty |
| `order` | `number` | Yes | Position in the journey | Number |

## Example

```json
{
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
}
```

## Confidence Scoring

The `confidence` field (0-1) reflects how reliably the journey stages were identified from the crawled pages.

- **High (0.8-1.0)**: Product has explicit onboarding documentation or getting-started guides. Stages map directly to described user flows.
- **Medium (0.5-0.79)**: Stages inferred from feature descriptions and marketing pages. Some stages are assumptions based on typical SaaS patterns.
- **Low (0.0-0.49)**: Limited information about user progression. Stages are largely inferred from product category norms.

## Evidence

The `evidence` array links the journey analysis back to specific URLs and text excerpts from crawled pages. Each entry contains:

- `url`: The page URL where onboarding or journey information was found.
- `excerpt`: A short text snippet supporting the stage identification.

Journey evidence typically comes from getting-started guides, onboarding pages, feature tours, and documentation that describes user workflows.
