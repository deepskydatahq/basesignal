# Measurement Plan (3-Layer Framework) Design

## Overview

A measurement plan feature that defines the "ideal" tracking state using a 3-layer framework: Entities, Activities, and Properties. This creates the foundation for later comparing against actual tracking setup to identify gaps.

## Problem Statement

Users need to define what *should* be tracked before connecting their analytics tools. Currently, the Overview Interview creates journey stages, but there's no structured way to capture the full measurement plan including entities and properties.

## Design Decisions

1. **Separate tables for ideal plan** - New `measurementEntities`, `measurementActivities`, `measurementProperties` tables, separate from existing `entities`/`stages`/`activityDefinitions` which represent actual tracking.

2. **Suggested but overridable entity extraction** - When adding activities, suggest entity based on the "Entity + Action" name format, but allow user to assign to any entity.

3. **Hybrid templates + LLM for properties** - Offer template property sets based on entity name patterns, with LLM refinement based on product context.

4. **Import with diff from journeys** - Support incremental import from journey stages, showing what's new vs already exists.

5. **Both Setup + Standalone access** - Available in Setup Mode for new users, accessible from sidebar after setup for ongoing refinement.

## Data Model

```typescript
// convex/schema.ts additions

measurementEntities: defineTable({
  userId: v.id("users"),
  name: v.string(),           // "Account", "User", "Subscription"
  description: v.optional(v.string()),
  suggestedFrom: v.optional(v.string()), // "overview_interview", "first_value", "manual"
  createdAt: v.number(),
})

measurementActivities: defineTable({
  userId: v.id("users"),
  entityId: v.id("measurementEntities"),
  name: v.string(),           // Full "Account Created" format
  action: v.string(),         // Just the action part: "Created"
  description: v.optional(v.string()),
  lifecycleSlot: v.optional(v.string()), // account_creation, activation, core_usage, revenue, churn
  isFirstValue: v.boolean(),  // Marks the activation moment
  suggestedFrom: v.optional(v.string()),
  createdAt: v.number(),
})

measurementProperties: defineTable({
  userId: v.id("users"),
  entityId: v.id("measurementEntities"),
  name: v.string(),           // "plan_type", "created_at"
  dataType: v.string(),       // "string", "number", "boolean", "timestamp"
  description: v.optional(v.string()),
  isRequired: v.boolean(),    // Required for analytics
  suggestedFrom: v.optional(v.string()), // "template", "llm", "manual"
  createdAt: v.number(),
})
```

## UI/UX Design

### Setup Mode Integration

After Overview Interview completes, the Review & Save step shows:
- Journey Map section (existing)
- Measurement Foundation section with "Generate" button

Clicking Generate opens a modal showing entities/activities extracted from journey stages. User confirms what to include in their plan.

### Standalone Page (`/measurement-plan`)

Hierarchical card layout:
- Each entity is a collapsible card
- Card shows activities (with lifecycle slot badges, first value indicator)
- Card shows properties (with data type, required flag)
- Actions: Add Entity, Add Activity, Add Property, Import from Journey

### Import from Journeys (Diff Flow)

Modal shows:
- NEW items (entities/activities not in plan) - checked by default
- ALREADY EXISTS items - shown as info only
- SUGGESTED PROPERTIES for new entities
- Summary of what will be added

### Property Templates

When adding properties, show suggestions based on entity name pattern:

| Entity Pattern | Suggested Properties |
|----------------|---------------------|
| Account, Organization, Company | created_at, plan_type, mrr, seats, owner_email |
| User, Member | email, created_at, role, last_active_at |
| Subscription, Plan | started_at, plan_name, billing_interval, amount |
| Project, Document, Item | created_at, owner_id, collaborator_count |

## Child Issues

1. **Data Model: Measurement Plan Schema** - Create tables + CRUD operations
2. **Measurement Plan Page** - Standalone hierarchical view
3. **Entity Management UI** - Add/edit/delete entities
4. **Activity Management UI** - Add/edit/delete with entity suggestion
5. **Property Management UI + Templates** - Add/edit/delete with template suggestions
6. **Setup Mode Integration** - Generate from Review & Save step
7. **Import from Journeys** - Diff-based incremental import

## Success Criteria

- User can define entities, activities, and properties for their ideal tracking plan
- Plan auto-populates from interview outputs with user confirmation
- Plan accessible both during setup and from dashboard
- Clear provenance showing where each item came from
