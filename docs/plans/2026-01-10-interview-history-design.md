# Interview History Display Design

## Overview

Add the ability to view past interview sessions from the journey editor. Users can see a list of all interviews conducted for a map and read full transcripts in a document-style format, providing audit trail and context for how the journey was built.

## Problem Statement

Interview sessions are already persisted (interviewSessions + interviewMessages tables), but there's no UI to access past sessions. Users can't answer "why did we define First Value this way?" without this history. New team members have no way to understand the context behind decisions.

## Proposed Solution

Add a "History" button to the journey editor that opens a slide-out drawer. The drawer shows all interview sessions for that journey with summary metadata. Clicking a session displays the full transcript in a document format optimized for reading and scanning.

---

## Design Details

### Data Layer

**No schema changes required.** Existing tables have everything needed:

| Table | Fields Used |
|-------|-------------|
| `interviewSessions` | journeyId, interviewType, status, startedAt, completedAt |
| `interviewMessages` | sessionId, role, content, toolCalls, createdAt |

**New queries in `convex/interviews.ts`:**

```typescript
// Get all sessions for a journey with computed metadata
export const getSessionHistory = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("interviewSessions")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    return Promise.all(sessions.map(async (session) => {
      const messages = await ctx.db
        .query("interviewMessages")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      // Count activities added from tool calls
      const activitiesAdded = messages.reduce((count, msg) => {
        if (!msg.toolCalls) return count;
        return count + msg.toolCalls.filter(tc =>
          tc.name === "add_activity" || tc.name === "add_stage"
        ).length;
      }, 0);

      return {
        ...session,
        messageCount: messages.length,
        activitiesAdded,
      };
    }));
  },
});

// Get formatted transcript for a session
export const getTranscript = query({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("interviewMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.createdAt,
      toolCalls: msg.toolCalls,
    }));
  },
});
```

---

### UI Components

**New files:**

| File | Purpose |
|------|---------|
| `src/components/interview/InterviewHistoryButton.tsx` | Button with session count badge |
| `src/components/interview/InterviewHistoryDrawer.tsx` | Slide-out drawer container |
| `src/components/interview/SessionCard.tsx` | Session summary card |
| `src/components/interview/TranscriptView.tsx` | Document-style transcript display |

**InterviewHistoryButton:**

```typescript
interface InterviewHistoryButtonProps {
  journeyId: Id<"journeys">;
  onClick: () => void;
}

// Renders: [History (3)] or [History] if no sessions
// Uses useQuery to get session count
```

**InterviewHistoryDrawer:**

```typescript
interface InterviewHistoryDrawerProps {
  journeyId: Id<"journeys">;
  isOpen: boolean;
  onClose: () => void;
}

// State: selectedSessionId (null = show list, set = show transcript)
// Renders SessionCard list or TranscriptView based on selection
```

**SessionCard:**

```typescript
interface SessionCardProps {
  session: {
    _id: Id<"interviewSessions">;
    interviewType: string;
    status: string;
    startedAt: number;
    completedAt?: number;
    messageCount: number;
    activitiesAdded: number;
  };
  onClick: () => void;
}
```

Display format:
```
┌─────────────────────────────────────────────────────────┐
│ Overview Interview                      Jan 8, 2026     │
│ ✓ Completed · 12 messages · Added 8 activities          │
└─────────────────────────────────────────────────────────┘
```

**TranscriptView:**

```typescript
interface TranscriptViewProps {
  sessionId: Id<"interviewSessions">;
  interviewType: string;
  date: number;
  onBack: () => void;
}
```

Document format for each message:
```
ASSISTANT · 2:34 PM
────────────────────────────────────────────────
Let's map out your user journey. What's the first thing
a new user does when they sign up?

YOU · 2:35 PM
────────────────────────────────────────────────
They create an account and then set up their first project.
```

Tool calls displayed as inline badges:
```
┌─────────────────────────────────────────┐
│ Added: Account Created, Project Created │
└─────────────────────────────────────────┘
```

---

### Integration

**Entry point in `JourneyEditorPage.tsx`:**

Add History button to the page header/toolbar:

```tsx
const [historyOpen, setHistoryOpen] = useState(false);

// In header area:
<InterviewHistoryButton
  journeyId={journeyId}
  onClick={() => setHistoryOpen(true)}
/>

// At page level:
<InterviewHistoryDrawer
  journeyId={journeyId}
  isOpen={historyOpen}
  onClose={() => setHistoryOpen(false)}
/>
```

**Drawer behavior:**
- Slides in from right side
- Overlays content (doesn't shift layout)
- Click outside or X button to close
- Width: ~500px (enough for readable transcript)

**Empty state:**
```
No interview sessions yet

Start an interview from the panel on the right
to begin building your journey map.
```

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/components/interview/InterviewHistoryButton.tsx` | Entry point button |
| `src/components/interview/InterviewHistoryDrawer.tsx` | Drawer container |
| `src/components/interview/SessionCard.tsx` | Session summary display |
| `src/components/interview/TranscriptView.tsx` | Document-style transcript |

### Modified Files

| File | Changes |
|------|---------|
| `convex/interviews.ts` | Add `getSessionHistory` and `getTranscript` queries |
| `src/routes/JourneyEditorPage.tsx` | Add History button and drawer |

---

## Alternatives Considered

### User ID on sessions
- **Rejected for v1**: Query via journey relationship works fine
- Sessions already link to journeys which have userId
- Can add direct index later if "all my sessions" view needed

### Global sessions list view
- **Deferred**: Map detail view covers primary use case
- Audit trail happens in context of specific journey
- Can add `/interviews` route later for cross-journey view

### Chat replay format
- **Rejected**: Document view better for audit trail scanning
- Users aren't replaying live, they're searching for decisions
- Collapsible sections better for long transcripts

### Full diff tracking
- **Rejected for v1**: Too complex, needs snapshot system
- Extracting activity count from tool calls provides value
- Can add before/after snapshots later if needed

---

## Success Criteria

1. History button visible in journey editor
2. Drawer opens showing all sessions for journey
3. Session cards show type, status, date, message count, activities added
4. Clicking session shows full transcript in document format
5. Tool calls displayed as inline summary badges
6. Back navigation returns to session list
7. Empty state shown when no sessions exist
8. Drawer closes on X click or outside click

---

## Future Enhancements

- Global sessions list view (`/interviews` route)
- Search within transcripts
- Export transcript as markdown/PDF
- Session annotations/notes
- Filter sessions by type or date range
- Diff view showing what changed per session
