# EntityModel

## Purpose

The EntityModel describes the core data objects a product manages and the relationships between them. It maps the product's domain model as understood from public-facing pages -- documentation, feature descriptions, and API references. This section answers: "What are the key objects in this product, and how do they relate to each other?"

## Type Definition

```typescript
interface EntityModel {
  items: EntityItem[];
  relationships: EntityRelationship[];
  confidence: number;
  evidence: Evidence[];
}

interface EntityItem {
  name: string;
  type: string;
  properties: string[];
}

interface EntityRelationship {
  from: string;
  to: string;
  type: string;
}
```

Source: `@basesignal/core` -- [`packages/core/src/types/profile.ts`](../../../packages/core/src/types/profile.ts)

## Field Reference

### EntityModel

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `items` | `EntityItem[]` | Yes | Entities discovered in the product | Array |
| `relationships` | `EntityRelationship[]` | Yes | Relationships between entities | Array |
| `confidence` | `number` | Yes | Extraction confidence | 0-1 |
| `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

### EntityItem

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `name` | `string` | Yes | Entity name (e.g., "Issue", "Project") | Non-empty |
| `type` | `string` | Yes | Entity classification (e.g., "core", "container", "organization") | Non-empty |
| `properties` | `string[]` | Yes | Key properties of this entity | Array of strings |

### EntityRelationship

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `from` | `string` | Yes | Source entity name | Non-empty |
| `to` | `string` | Yes | Target entity name | Non-empty |
| `type` | `string` | Yes | Relationship type (e.g., "has many", "belongs to", "contains") | Non-empty |

## Example

```json
{
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
}
```

## Confidence Scoring

The `confidence` field (0-1) reflects how completely and accurately the entity model was extracted.

- **High (0.8-1.0)**: Product has public API documentation or detailed feature pages that explicitly describe entities and their properties. Relationships can be directly inferred from documented associations.
- **Medium (0.5-0.79)**: Entities identified from feature descriptions but properties are partially inferred. Relationships assumed from typical patterns in the product category.
- **Low (0.0-0.49)**: Entities inferred from marketing copy with limited detail about properties or relationships. The domain model is speculative.

## Evidence

The `evidence` array links the entity model back to specific URLs and text excerpts. Evidence for entities typically comes from documentation pages, API references, and feature descriptions that name and describe the product's core objects.
