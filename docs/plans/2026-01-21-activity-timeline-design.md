# Activity Timeline Design

## Overview
Add an inline "Recent Activity" timeline to ProfilePage showing how the product profile has evolved over time. Uses read-time derivation from existing timestamps - no new storage required.

## Problem Statement
Users need to see how their product profile evolved - when interviews were completed, stages added, metrics created. This provides audit trail visibility and helps them understand the history of their measurement model.

## Expert Perspectives

### Product
- Show what changed, not just that something changed - but only for real decision points
- "Updated Journey Map" is useless noise; specific events like "Added Expansion stage" tell users when their framework evolved
- Start with inline timeline only (last 5 items), defer full activity page - the magic moment is at-a-glance evolution
- Suppress trivial changes - let users ask for detail rather than scroll through noise

### Technical
- Use existing `createdAt`/`updatedAt` timestamps as the audit trail
- Avoid write-side burden (updating changes arrays) which creates bugs when mutations are missed
- Read-side derivation from timestamps is simpler and guarantees consistency
- Start minimal, add complexity only when proven necessary

### Simplification Review (Jobs)
**Removed:**
- `changes` arrays on entities - use existing timestamps instead
- Separate `ActivityItem` component - inline rendering is simpler
- `userId` tracking - not needed for MVP
- Relative timestamps - use absolute until evidence says otherwise
- 8 activity types reduced to 3 core types

**Key insight:** The original design over-engineered storage. Timestamp-based derivation at read time eliminates mutation burden, guarantees consistency, and ships in half the code.

## Proposed Solution

### Approach
1. Create a query that derives activity from existing timestamps across tables
2. Build a simple ActivityTimeline component showing last 5 entries
3. Integrate into ProfilePage as a collapsible section
4. No schema changes required

### Data Sources (All Existing)
| Event | Source Table | Timestamp Field |
|-------|--------------|-----------------|
| Profile created | profiles | createdAt |
| Interview completed | interviewSessions | completedAt |
| Stage added | stages | createdAt |

### Why Only 3 Event Types
Start minimal. These three cover the core "how did my profile evolve" question. Add more event types (metrics, entities) only after shipping and observing real usage patterns.

## Design Details

### Backend
Single new query:

```typescript
// convex/activity.ts
export const getRecentActivity = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    const sessions = await ctx.db
      .query("interviewSessions")
      .withIndex("by_profile", q => q.eq("profileId", profileId))
      .filter(q => q.neq(q.field("completedAt"), undefined))
      .collect();
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_profile", q => q.eq("profileId", profileId))
      .collect();

    const activities = [
      profile && { type: "profile_created", timestamp: profile._creationTime, description: "Created product profile" },
      ...sessions.map(s => ({ type: "interview_completed", timestamp: s.completedAt, description: `Completed ${s.type} interview` })),
      ...stages.map(s => ({ type: "stage_added", timestamp: s._creationTime, description: `Added ${s.name} stage` })),
    ].filter(Boolean);

    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  },
});
```

### Frontend
Single component:

```typescript
// src/components/ActivityTimeline.tsx
export function ActivityTimeline({ profileId }: { profileId: Id<"profiles"> }) {
  const activities = useQuery(api.activity.getRecentActivity, { profileId });

  if (!activities?.length) return null;

  return (
    <ProfileSection title="Recent Activity" collapsible defaultCollapsed>
      <ul className="space-y-3">
        {activities.map((activity, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="text-gray-400">{formatDate(activity.timestamp)}</span>
            <span>{activity.description}</span>
          </li>
        ))}
      </ul>
    </ProfileSection>
  );
}
```

### Integration
Add to ProfilePage after existing sections:

```tsx
<ActivityTimeline profileId={profile._id} />
```

## Alternatives Considered

### Dedicated activityLog table
**Rejected:** Requires modifying all mutations to log events. Creates write-side burden and risks of missed logs. The timestamps already exist.

### Changes arrays on entities
**Rejected:** Same write-side burden problem. Also requires schema changes to multiple tables.

### Full activity page with View All
**Deferred:** Ship inline timeline first. Add full page only if users actually want to see more than 5 items.

## Success Criteria
- [ ] ActivityTimeline component renders on ProfilePage
- [ ] Shows last 5 activities sorted by timestamp descending
- [ ] Displays: profile creation, interview completions, stage additions
- [ ] Collapsible section that defaults to collapsed
- [ ] No schema changes required
