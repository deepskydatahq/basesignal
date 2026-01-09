// Property templates for suggesting entity properties during import

export interface PropertyTemplate {
  name: string;
  dataType: "string" | "number" | "boolean" | "timestamp";
  description: string;
  isRequired: boolean;
}

interface EntityPattern {
  patterns: string[];
  properties: PropertyTemplate[];
}

const ENTITY_PATTERNS: EntityPattern[] = [
  {
    patterns: ["account", "organization", "company", "org", "workspace", "team"],
    properties: [
      {
        name: "created_at",
        dataType: "timestamp",
        description: "When the account was created",
        isRequired: true,
      },
      {
        name: "plan_type",
        dataType: "string",
        description: "Subscription plan tier (free, pro, enterprise)",
        isRequired: false,
      },
      {
        name: "mrr",
        dataType: "number",
        description: "Monthly recurring revenue",
        isRequired: false,
      },
      {
        name: "seats",
        dataType: "number",
        description: "Number of user seats",
        isRequired: false,
      },
      {
        name: "owner_email",
        dataType: "string",
        description: "Email of the account owner",
        isRequired: false,
      },
    ],
  },
  {
    patterns: ["user", "member", "person", "contact"],
    properties: [
      {
        name: "email",
        dataType: "string",
        description: "User email address",
        isRequired: true,
      },
      {
        name: "created_at",
        dataType: "timestamp",
        description: "When the user signed up",
        isRequired: true,
      },
      {
        name: "role",
        dataType: "string",
        description: "User role (admin, member, viewer)",
        isRequired: false,
      },
      {
        name: "last_active_at",
        dataType: "timestamp",
        description: "Last activity timestamp",
        isRequired: false,
      },
    ],
  },
  {
    patterns: ["subscription", "plan", "billing"],
    properties: [
      {
        name: "started_at",
        dataType: "timestamp",
        description: "When the subscription started",
        isRequired: true,
      },
      {
        name: "plan_name",
        dataType: "string",
        description: "Name of the subscription plan",
        isRequired: true,
      },
      {
        name: "billing_interval",
        dataType: "string",
        description: "Billing frequency (monthly, yearly)",
        isRequired: false,
      },
      {
        name: "amount",
        dataType: "number",
        description: "Subscription amount",
        isRequired: false,
      },
    ],
  },
  {
    patterns: ["project", "document", "item", "file", "workspace", "board"],
    properties: [
      {
        name: "created_at",
        dataType: "timestamp",
        description: "When the item was created",
        isRequired: true,
      },
      {
        name: "owner_id",
        dataType: "string",
        description: "ID of the owner",
        isRequired: false,
      },
      {
        name: "collaborator_count",
        dataType: "number",
        description: "Number of collaborators",
        isRequired: false,
      },
    ],
  },
];

/**
 * Get suggested properties for an entity name based on pattern matching.
 * Returns properties sorted by required status (required first).
 */
export function getPropertyTemplates(entityName: string): PropertyTemplate[] {
  const nameLower = entityName.toLowerCase();

  // Find matching pattern
  for (const pattern of ENTITY_PATTERNS) {
    if (pattern.patterns.some((p) => nameLower.includes(p))) {
      // Sort so required properties come first
      return [...pattern.properties].sort((a, b) => {
        if (a.isRequired && !b.isRequired) return -1;
        if (!a.isRequired && b.isRequired) return 1;
        return 0;
      });
    }
  }

  // Default properties for unknown entities
  return [
    {
      name: "created_at",
      dataType: "timestamp",
      description: "When this item was created",
      isRequired: true,
    },
  ];
}

/**
 * Check if a property name looks like it should be required based on common patterns.
 */
export function isLikelyRequired(propertyName: string): boolean {
  const requiredPatterns = [
    "created_at",
    "id",
    "email",
    "started_at",
    "plan_name",
  ];
  return requiredPatterns.some((p) =>
    propertyName.toLowerCase().includes(p.toLowerCase())
  );
}

/**
 * Infer data type from property name based on common patterns.
 */
export function inferDataType(
  propertyName: string
): "string" | "number" | "boolean" | "timestamp" {
  const nameLower = propertyName.toLowerCase();

  // Timestamp patterns
  if (
    nameLower.endsWith("_at") ||
    nameLower.endsWith("_date") ||
    nameLower.includes("timestamp")
  ) {
    return "timestamp";
  }

  // Number patterns
  if (
    nameLower.includes("count") ||
    nameLower.includes("amount") ||
    nameLower.includes("mrr") ||
    nameLower.includes("seats") ||
    nameLower.includes("quantity") ||
    nameLower.includes("total")
  ) {
    return "number";
  }

  // Boolean patterns
  if (
    nameLower.startsWith("is_") ||
    nameLower.startsWith("has_") ||
    nameLower.includes("_enabled") ||
    nameLower.includes("_active")
  ) {
    return "boolean";
  }

  // Default to string
  return "string";
}

/**
 * Available data types for properties
 */
export const DATA_TYPES = ["string", "number", "boolean", "timestamp"] as const;
export type DataType = (typeof DATA_TYPES)[number];
