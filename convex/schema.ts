import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  orgs: defineTable({
    name: v.string(),
    slug: v.string(),
    githubRepoUrl: v.string(),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  users: defineTable({
    // Clerk identity (optional for migration from old auth)
    clerkId: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    name: v.optional(v.string()),

    // Onboarding
    onboardingComplete: v.optional(v.boolean()),
    onboardingStep: v.optional(v.string()),

    // Onboarding context (collected during onboarding)
    productName: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    userTerminology: v.optional(v.string()), // DEPRECATED: kept for migration
    role: v.optional(v.string()),

    // Business model context
    hasMultiUserAccounts: v.optional(v.boolean()), // Can account have multiple users?
    businessType: v.optional(v.string()), // "b2c" | "b2b" (only set if single-user)
    revenueModels: v.optional(v.array(v.string())), // ["transactions", "tier_subscription", "seat_subscription", "volume_based"]

    // Setup Mode (replaces onboarding fields)
    setupStatus: v.optional(v.string()),  // "not_started" | "in_progress" | "complete"
    setupCompletedAt: v.optional(v.number()),

    createdAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("email", ["email"]),

  setupProgress: defineTable({
    userId: v.id("users"),

    // Current state
    currentStep: v.string(),  // "overview_interview" | "review_save"
    status: v.string(),       // "active" | "paused" | "completed"

    // Progress tracking
    stepsCompleted: v.array(v.string()),

    // Timing
    startedAt: v.number(),
    lastActiveAt: v.number(),
    pausedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),

    // Re-engagement
    remindersSent: v.number(),
    lastReminderAt: v.optional(v.number()),

    // Outputs created (references)
    overviewJourneyId: v.optional(v.id("journeys")),
    // Future: measurementPlanId, metricCatalogId

  }).index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_paused_status", ["status", "lastActiveAt"]),

  entities: defineTable({
    orgId: v.id("orgs"),
    name: v.string(),
    sourceType: v.string(),
    sourceConfig: v.optional(v.object({
      type: v.string(),
      project: v.optional(v.string()),
      dataset: v.optional(v.string()),
      table: v.optional(v.string()),
      duckdbPath: v.optional(v.string()),
      entityName: v.optional(v.string()),
      sourceEntity: v.optional(v.string()),
      groupBy: v.optional(v.array(v.string())),
    })),
    // Source mapping with field mappings
    sourceMapping: v.optional(v.object({
      fieldMappings: v.optional(v.object({
        // Dynamic keys mapping entity field -> source field
      })),
      // Store as array of {entityField, sourceField} for Convex
      fieldMappingsList: v.optional(v.array(v.object({
        entityField: v.string(),
        sourceField: v.string(),
      }))),
    })),
    // Tenant extension metadata
    tenantExtension: v.optional(v.object({
      tenantId: v.string(),
      // Tenant-specific computed columns (separate from core)
      tenantComputedColumns: v.optional(v.array(v.object({
        name: v.string(),
        primitiveName: v.string(),
        params: v.any(),
        sql: v.string(),
      }))),
      // Tenant-specific measures
      tenantMeasures: v.optional(v.array(v.object({
        name: v.string(),
        expression: v.string(),
      }))),
    })),
    fields: v.array(v.object({
      name: v.string(),
      type: v.string(),
      description: v.optional(v.string()),
      nullable: v.boolean(),
    })),
    computedColumns: v.array(v.object({
      name: v.string(),
      primitiveName: v.string(),
      params: v.any(),
      sql: v.string(),
      origin: v.optional(v.string()), // "core" | "layer" | "tenant"
    })),
    currentBranch: v.optional(v.string()),
    validationErrors: v.optional(v.array(v.string())),
    lastModified: v.number(),

    // Sync-service fields (for Git sync integration)
    tenant_id: v.optional(v.string()),
    entity_type: v.optional(v.string()),
    live_version: v.optional(v.any()),
    draft_version: v.optional(v.any()),
    status: v.optional(v.string()), // "live", "draft", "pending_deployment", "conflict"

    // Track what Git commit the draft was based on
    draft_base_sha: v.optional(v.string()),

    // Timestamp when conflict was detected
    conflict_detected_at: v.optional(v.number()),

    // Current Git commit SHA
    git_commit_sha: v.optional(v.string()),

    // Timestamps for sync-service
    updated_at: v.optional(v.number()),
  }).index("by_org", ["orgId"])
    .index("by_org_and_name", ["orgId", "name"]),

  sources: defineTable({
    name: v.string(),
    displayName: v.string(),
    dagsterJobUrl: v.optional(v.string()),
    tables: v.array(
      v.object({
        name: v.string(),
        bqTable: v.string(),
        freshnessThresholdHours: v.number(),
        lastSyncAt: v.optional(v.string()),
        rowCount: v.optional(v.number()),
      })
    ),
    lastCheckedAt: v.string(),
  }).index("by_name", ["name"]),

  amplitudeConnections: defineTable({
    name: v.string(),
    apiKey: v.string(),
    secretKey: v.string(),
    projectId: v.optional(v.string()),
    status: v.string(), // "pending" | "creating" | "connected" | "syncing" | "error"
    selectedEvents: v.array(v.string()),
    lastRunAt: v.optional(v.string()),
    lastRowCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    // GitOps integration fields
    configPath: v.optional(v.string()),      // Path to config file in Git
    secretName: v.optional(v.string()),      // GitHub secret name
    scheduleEnabled: v.optional(v.boolean()),
    scheduleCron: v.optional(v.string()),
    workflowRunId: v.optional(v.number()),   // Latest workflow run ID
    workflowUrl: v.optional(v.string()),     // Latest workflow URL
  }).index("by_name", ["name"]),

  accountMappings: defineTable({
    // Which Amplitude connection this mapping belongs to
    connectionId: v.id("amplitudeConnections"),
    // Which field identifies an account (e.g., "user_id", "device_id", or a user property)
    accountIdField: v.string(),
    // Optional: field type to help with validation
    accountIdFieldType: v.optional(v.string()), // "standard" | "user_property" | "event_property"
    // Field mappings: account field -> source field
    fieldMappings: v.array(v.object({
      targetField: v.string(),   // e.g., "signup_date", "plan"
      sourceField: v.string(),   // e.g., "user_properties__plan"
      sourceType: v.string(),    // "user_property" | "event_property" | "computed"
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_connection", ["connectionId"]),

  activityDefinitions: defineTable({
    // Which Amplitude connection this belongs to
    connectionId: v.id("amplitudeConnections"),
    // Activity name (canonical, e.g., "completed_onboarding")
    name: v.string(),
    // Description for UI
    description: v.optional(v.string()),
    // Type of mapping
    type: v.string(), // "simple" | "filtered" | "synthetic"

    // For "simple": just rename an event
    sourceEvent: v.optional(v.string()),

    // For "filtered": event + property conditions
    propertyFilters: v.optional(v.array(v.object({
      property: v.string(),
      operator: v.string(), // "equals" | "not_equals" | "contains" | "gt" | "lt"
      value: v.any(),
    }))),

    // For "synthetic": combine multiple events (Phase 2)
    syntheticRule: v.optional(v.object({
      events: v.array(v.string()),
      condition: v.string(), // "all" | "any" | "n_of"
      count: v.optional(v.number()),
      timeWindow: v.optional(v.string()), // "7d", "14d", "30d"
    })),

    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_connection", ["connectionId"])
    .index("by_connection_and_name", ["connectionId", "name"]),

  valueRules: defineTable({
    // Which Amplitude connection this belongs to
    connectionId: v.id("amplitudeConnections"),
    // Rule type: what state flag this computes
    ruleType: v.string(), // "activation" | "active" | "at_risk"
    // Human-readable name
    name: v.string(),
    // Description for UI
    description: v.optional(v.string()),
    // Which activities to check
    activities: v.array(v.string()), // Activity names from activityDefinitions
    // Condition: how to combine activities
    condition: v.string(), // "all" | "any" | "n_of"
    // For "n_of": how many activities required
    count: v.optional(v.number()),
    // Time window context
    timeWindow: v.string(), // "first_7d" | "first_14d" | "first_30d" | "last_7d" | "last_30d" | "ever"
    // Is this rule active?
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_connection", ["connectionId"])
    .index("by_connection_and_type", ["connectionId", "ruleType"]),

  journeys: defineTable({
    userId: v.id("users"),
    type: v.string(),  // "overview" | "first_value" | "retention" | "value_outcomes" | "value_capture" | "churn"
    name: v.string(),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_type", ["userId", "type"]),

  stages: defineTable({
    journeyId: v.id("journeys"),
    name: v.string(),
    type: v.string(), // "entry" | "activity"
    description: v.optional(v.string()),
    position: v.object({ x: v.number(), y: v.number() }),

    // Structured activity fields for Overview Interview
    entity: v.optional(v.string()),        // "Account", "Project", "Subscription"
    action: v.optional(v.string()),        // "Created", "Verified", "Upgraded"
    lifecycleSlot: v.optional(v.string()), // "account_creation" | "activation" | "core_usage" | "revenue" | "churn"

    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_journey", ["journeyId"]),

  transitions: defineTable({
    journeyId: v.id("journeys"),
    fromStageId: v.id("stages"),
    toStageId: v.id("stages"),
    label: v.optional(v.string()),
    type: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_journey", ["journeyId"])
    .index("by_from", ["fromStageId"])
    .index("by_to", ["toStageId"]),

  interviewSessions: defineTable({
    journeyId: v.id("journeys"),
    interviewType: v.optional(v.string()), // "first_value" | "retention" | "value_outcomes" | "value_capture" | "churn"
    status: v.string(), // "active" | "completed" | "archived"
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_journey", ["journeyId"])
    .index("by_journey_and_type", ["journeyId", "interviewType"]),

  interviewMessages: defineTable({
    sessionId: v.id("interviewSessions"),
    role: v.string(), // "user" | "assistant"
    content: v.string(),
    toolCalls: v.optional(
      v.array(
        v.object({
          name: v.string(),
          arguments: v.any(),
          result: v.optional(v.string()),
        })
      )
    ),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"]),

  metrics: defineTable({
    // Identity - using userId for now (products table doesn't exist yet)
    userId: v.id("users"),

    // Content
    name: v.string(),                    // "Activation Rate"
    definition: v.string(),              // Plain language, personalized
    formula: v.string(),                 // Human-readable, with activity names
    whyItMatters: v.string(),            // Business context
    howToImprove: v.string(),            // Actionable levers

    // Categorization (for UI badges)
    category: v.string(),                // "reach" | "engagement" | "value_delivery" | "value_capture"

    // Metadata
    metricType: v.string(),              // "default" | "generated"
    templateKey: v.optional(v.string()), // "activation_rate" - links to template
    relatedActivityId: v.optional(v.id("stages")),  // Optional journey link
    order: v.number(),                   // Display sequence
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_order", ["userId", "order"]),
});
