# Primary Entity Badge Design

## Overview

Add a "Primary" badge to the designated core business entity in MeasurementPlanSection. This replaces the original per-entity type badges (billable vs value) with a simpler single-designation model.

## Problem Statement

Users need to understand which entity represents their core unit of business success when viewing their measurement plan. The original proposal for per-entity "billable" vs "value" badges creates false categorization - the real distinction is "which ONE entity is my primary business entity?"

## Expert Perspectives

### Product
- Per-entity categorization (billable vs value) creates false distinctions
- Users have ONE primary business entity (Stripe = Accounts, Slack = Workspaces)
- This is a structural choice, not a per-entity property
- Set during onboarding, rarely changed

### Technical
- Add `primaryEntityId` to the `users` table (fits existing pattern)
- Keep it simple: one field, one mutation
- Use existing `<Badge>` component from UI library

### Simplification Review
- **Removed:** Separate `PrimaryEntityBadge` component (just inline the JSX)
- **Removed:** Custom Tailwind styling (use existing Badge component)
- **Simplified:** Deliver as vertical slice (schema + UI together)
- **Changed:** Per-entity type badges to single primary designation

## Proposed Solution

Minimal vertical slice:
1. Add `primaryEntityId` field to users schema
2. Add mutation to set primary entity
3. Display "Primary" badge inline with entity name in MeasurementPlanSection
4. Add simple "Set as primary" action in entity card overflow menu

## Design Details

### Schema Change
```typescript
// convex/schema.ts - users table
primaryEntityId: v.optional(v.id("measurementEntities")),
```

### Mutation
```typescript
// convex/users.ts
export const setPrimaryEntity = mutation({
  args: { entityId: v.id("measurementEntities") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await ctx.db.patch(userId, { primaryEntityId: args.entityId });
  },
});
```

### UI Display
In `MeasurementPlanSection`, for each entity:
```tsx
{entity._id === user.primaryEntityId && (
  <Badge variant="secondary">Primary</Badge>
)}
```

### Setting Primary
Add to entity card overflow menu (existing pattern):
- "Set as primary" action
- Calls `setPrimaryEntity` mutation
- Immediate visual feedback (badge appears)

## Alternatives Considered

1. **Per-entity type badges (original)** - Rejected: creates false categorization
2. **UI-only with no schema** - Rejected: incomplete, creates tech debt
3. **Onboarding-only designation** - Deferred: can add later, start with manual setting

## Success Criteria

- [ ] Primary entity shows "Primary" badge in MeasurementPlanSection
- [ ] Users can set any entity as primary via overflow menu
- [ ] Only one entity can be primary at a time
- [ ] Badge uses existing UI library component
