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

    // Tracking Maturity (collected during onboarding)
    trackingStatus: v.optional(v.string()),           // "full" | "partial" | "minimal" | "none"
    trackingPainPoint: v.optional(v.string()),        // "what_to_track" | "inconsistent" | "no_outcomes" | "trust" | "other"
    trackingPainPointOther: v.optional(v.string()),   // Custom text if "other"
    analyticsTools: v.optional(v.array(v.string())), // Array of tool IDs

    // Setup Mode (replaces onboarding fields)
    setupStatus: v.optional(v.string()),  // "not_started" | "in_progress" | "complete"
    setupCompletedAt: v.optional(v.number()),

    // Community join tracking
    communityJoined: v.optional(v.boolean()),
    communityJoinedAt: v.optional(v.number()),
    communityJoinMethod: v.optional(v.string()), // "honor" | "magic_code" | "email_fallback"

    // Primary entity designation
    primaryEntityId: v.optional(v.id("measurementEntities")),

    // Share profile
    shareToken: v.optional(v.string()),

    createdAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("email", ["email"])
    .index("by_share_token", ["shareToken"]),

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

    // Community join status
    communityJoinStatus: v.optional(v.string()), // "pending" | "verified" | "skipped_email"

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

  measurementEntities: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    suggestedFrom: v.optional(v.string()), // "overview_interview", "first_value", "manual"
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_and_name", ["userId", "name"]),

  measurementActivities: defineTable({
    userId: v.id("users"),
    entityId: v.id("measurementEntities"),
    name: v.string(),           // Full "Account Created" format
    action: v.string(),         // Just the action part: "Created"
    description: v.optional(v.string()),
    lifecycleSlot: v.optional(v.string()), // account_creation, activation, core_usage, revenue, churn
    isFirstValue: v.boolean(),  // Marks the activation moment
    suggestedFrom: v.optional(v.string()), // "overview_interview", "first_value", "manual"
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_entity", ["entityId"])
    .index("by_user_and_name", ["userId", "name"]),

  interviewSessions: defineTable({
    journeyId: v.id("journeys"),
    interviewType: v.optional(v.string()), // "first_value" | "retention" | "value_outcomes" | "value_capture" | "churn"
    status: v.string(), // "active" | "completed" | "archived"
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    // First Value candidate state (Issue #32/#33)
    pendingCandidate: v.optional(v.object({
      activityName: v.string(),
      reasoning: v.string(),
    })),
    confirmedFirstValue: v.optional(v.object({
      activityName: v.string(),
      reasoning: v.string(),
      confirmedAt: v.number(),
    })),
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

  firstValueDefinitions: defineTable({
    userId: v.id("users"),
    activityId: v.optional(v.id("measurementActivities")),
    activityName: v.string(),
    reasoning: v.string(),
    expectedTimeframe: v.string(),
    successCriteria: v.optional(v.string()),
    additionalContext: v.optional(v.string()),
    confirmedAt: v.number(),
    source: v.string(), // "interview" | "manual_edit"
  })
    .index("by_user", ["userId"]),

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
    sourceActivityId: v.optional(v.id("measurementActivities")),  // Link to source event
    relatedActivityId: v.optional(v.string()),  // DEPRECATED: migration field, remove after data migrated
    order: v.number(),                   // Display sequence
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_order", ["userId", "order"]),

  measurementProperties: defineTable({
    userId: v.id("users"),
    entityId: v.id("measurementEntities"),
    name: v.string(),
    dataType: v.string(), // "string" | "number" | "boolean" | "timestamp"
    description: v.optional(v.string()),
    isRequired: v.boolean(),
    suggestedFrom: v.optional(v.string()), // "template" | "llm" | "manual"
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_entity", ["entityId"])
    .index("by_entity_and_name", ["entityId", "name"]),

  // === MCP v2 Tables ===

  products: defineTable({
    userId: v.id("users"),
    name: v.string(),
    url: v.string(),
    docsUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  productProfiles: defineTable({
    productId: v.id("products"),

    // === Core Identity ===
    identity: v.optional(v.object({
      productName: v.string(),
      description: v.string(),
      targetCustomer: v.string(),
      businessModel: v.string(),
      industry: v.optional(v.string()),
      companyStage: v.optional(v.string()),
      confidence: v.number(),
      evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
    })),

    // === Revenue Architecture ===
    revenue: v.optional(v.object({
      model: v.string(),
      billingUnit: v.optional(v.string()),
      hasFreeTier: v.boolean(),
      tiers: v.array(v.object({
        name: v.string(),
        price: v.string(),
        features: v.array(v.string()),
      })),
      expansionPaths: v.array(v.string()),
      contractionRisks: v.array(v.string()),
      confidence: v.number(),
      evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
    })),

    // === Entity Model ===
    entities: v.optional(v.object({
      items: v.array(v.object({
        name: v.string(),
        type: v.string(),
        properties: v.array(v.string()),
      })),
      relationships: v.array(v.object({
        from: v.string(),
        to: v.string(),
        type: v.string(),
      })),
      confidence: v.number(),
      evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
    })),

    // === Journey Stages ===
    journey: v.optional(v.object({
      stages: v.array(v.object({
        name: v.string(),
        description: v.string(),
        order: v.number(),
      })),
      confidence: v.number(),
      evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
    })),

    // === Definitions (per-field confidence + source tracking) ===
    definitions: v.optional(v.object({
      activation: v.optional(v.union(
        // Legacy format: flat criteria as string array
        v.object({
          criteria: v.array(v.string()),
          timeWindow: v.optional(v.string()),
          reasoning: v.string(),
          confidence: v.number(),
          source: v.string(),
          evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
        }),
        // New multi-level format
        v.object({
          levels: v.array(v.object({
            level: v.number(),
            name: v.string(),
            signalStrength: v.union(
              v.literal("weak"),
              v.literal("medium"),
              v.literal("strong"),
              v.literal("very_strong"),
            ),
            criteria: v.array(v.object({
              action: v.string(),
              count: v.number(),
              timeWindow: v.optional(v.string()),
            })),
            reasoning: v.string(),
            confidence: v.number(),
            evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
          })),
          primaryActivation: v.optional(v.number()),
          overallConfidence: v.number(),
        }),
      )),
      firstValue: v.optional(v.object({
        description: v.string(),
        criteria: v.array(v.string()),
        reasoning: v.string(),
        confidence: v.number(),
        source: v.string(),
        evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
      })),
      active: v.optional(v.object({
        criteria: v.array(v.string()),
        timeWindow: v.optional(v.string()),
        reasoning: v.string(),
        confidence: v.number(),
        source: v.string(),
        evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
      })),
      atRisk: v.optional(v.object({
        criteria: v.array(v.string()),
        timeWindow: v.optional(v.string()),
        reasoning: v.string(),
        confidence: v.number(),
        source: v.string(),
        evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
      })),
      churn: v.optional(v.object({
        criteria: v.array(v.string()),
        timeWindow: v.optional(v.string()),
        reasoning: v.string(),
        confidence: v.number(),
        source: v.string(),
        evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
      })),
    })),

    // === Outcomes ===
    outcomes: v.optional(v.object({
      items: v.array(v.object({
        description: v.string(),
        type: v.string(),
        linkedFeatures: v.array(v.string()),
      })),
      confidence: v.number(),
      evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
    })),

    // === Metrics ===
    metrics: v.optional(v.object({
      items: v.array(v.object({
        name: v.string(),
        category: v.string(),
        formula: v.optional(v.string()),
        linkedTo: v.array(v.string()),
      })),
      confidence: v.number(),
      evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
    })),

    // === Computed Meta ===
    completeness: v.number(),
    overallConfidence: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_product", ["productId"]),

  scanJobs: defineTable({
    productId: v.id("products"),
    userId: v.id("users"),
    status: v.string(),
    url: v.string(),

    // Progress tracking
    pagesCrawled: v.number(),
    pagesTotal: v.optional(v.number()),
    currentPhase: v.string(),

    // Results
    crawledPages: v.optional(v.array(v.object({
      url: v.string(),
      pageType: v.optional(v.string()),
      title: v.optional(v.string()),
    }))),

    // Discovered resources
    discoveredDocs: v.optional(v.string()),
    discoveredPricing: v.optional(v.string()),

    // Error tracking
    error: v.optional(v.string()),

    // Timing
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_product", ["productId"])
    .index("by_user", ["userId"]),

  crawledPages: defineTable({
    productId: v.id("products"),
    scanJobId: v.id("scanJobs"),
    url: v.string(),
    pageType: v.string(),
    title: v.optional(v.string()),
    content: v.string(),
    contentLength: v.number(),
    metadata: v.optional(v.object({
      description: v.optional(v.string()),
      ogImage: v.optional(v.string()),
      structuredData: v.optional(v.string()),
    })),
    crawledAt: v.number(),
  })
    .index("by_product", ["productId"])
    .index("by_scan_job", ["scanJobId"])
    .index("by_product_type", ["productId", "pageType"]),
});
