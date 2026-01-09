# First Value Candidate Detection & Confirmation Design

## Overview

Enhance the First Value Interview to detect and confirm the "aha moment" - the first point where users experience real value. The AI proposes candidates mid-conversation, users confirm via the journey map UI, and the definition is stored as rich product data.

## Problem Statement

Currently the First Value Interview collects activities but doesn't distinguish which activity represents the actual First Value moment. Users have no way to mark, confirm, or refine which activity is their product's activation point.

## Proposed Solution

1. **AI-driven candidate detection** - During the interview, AI calls a tool to propose a First Value candidate when confident
2. **Visual confirmation on journey map** - Candidate appears highlighted with reasoning and confirm/explore buttons
3. **Follow-up questions** - After confirmation, AI asks about timeframe and success criteria
4. **Rich definition storage** - Store activity, reasoning, timeframe, and success criteria
5. **Dashboard editing** - View and edit the definition, or refine via interview

---

## Design Details

### Data Model

**New `firstValueDefinitions` table:**

```typescript
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
  .index("by_user", ["userId"])
```

**Update to `measurementActivities`:**
- Existing `isFirstValue: boolean` field is set when First Value is confirmed
- Only one activity per user should have `isFirstValue: true`

---

### AI Tool: `propose_first_value_candidate`

**Tool definition:**

```typescript
{
  name: "propose_first_value_candidate",
  description: "Propose an activity as the First Value moment when you have high confidence this is where users first experience value. Only call when confident.",
  input_schema: {
    type: "object",
    properties: {
      activity_name: {
        type: "string",
        description: "The Entity Action name (e.g., 'Project Published')"
      },
      reasoning: {
        type: "string",
        description: "Why this is the First Value moment - what value does the user experience?"
      }
    },
    required: ["activity_name", "reasoning"]
  }
}
```

**System prompt addition for `first_value` interview:**

```
FIRST VALUE DETECTION:
When you identify a strong First Value candidate during the conversation:
- The activity should represent the FIRST moment users get real value
- Not just completing setup, but actually experiencing the benefit
- Look for moments where users SEE RESULTS, not just take actions
- Call propose_first_value_candidate with clear reasoning
- Only propose when confident - it's okay to gather more context first

Examples of good First Value moments:
- "Project Published" - user sees their work live
- "First Report Generated" - user gets actionable insights
- "First Message Sent" - user experiences core communication value

Examples of NOT First Value (too early):
- "Account Created" - just setup, no value yet
- "Profile Completed" - configuration, not value
- "Tutorial Finished" - learning, not experiencing
```

---

### Backend Flow

**1. Tool execution in `convex/ai.ts`:**

When `propose_first_value_candidate` is called:

```typescript
case "propose_first_value_candidate": {
  const { activity_name, reasoning } = toolArgs;

  // Store pending candidate on session
  await ctx.runMutation(internal.interviews.setPendingCandidate, {
    sessionId,
    candidate: { activityName: activity_name, reasoning }
  });

  // Return special marker for frontend
  return {
    success: true,
    pending_confirmation: true,
    message: `Proposed "${activity_name}" as First Value candidate. Awaiting user confirmation.`
  };
}
```

**2. Session schema update:**

```typescript
interviewSessions: defineTable({
  // ... existing fields
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
```

**3. Confirmation mutation:**

```typescript
export const confirmFirstValueCandidate = mutation({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session?.pendingCandidate) throw new Error("No pending candidate");

    // Move pending to confirmed
    await ctx.db.patch(args.sessionId, {
      confirmedFirstValue: {
        ...session.pendingCandidate,
        confirmedAt: Date.now(),
      },
      pendingCandidate: undefined,
    });

    return { confirmed: true };
  }
});

export const dismissFirstValueCandidate = mutation({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      pendingCandidate: undefined,
    });
    return { dismissed: true };
  }
});
```

**4. Save definition on interview complete:**

```typescript
export const completeFirstValueInterview = mutation({
  args: {
    sessionId: v.id("interviewSessions"),
    expectedTimeframe: v.string(),
    successCriteria: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session?.confirmedFirstValue) {
      throw new Error("No confirmed First Value");
    }

    // Find or create the activity in measurement plan
    const activity = await findOrCreateActivity(ctx, session.confirmedFirstValue.activityName);

    // Mark as First Value
    await ctx.db.patch(activity._id, { isFirstValue: true });

    // Clear any previous First Value for this user
    // ... (unset isFirstValue on other activities)

    // Create definition record
    await ctx.db.insert("firstValueDefinitions", {
      userId: session.userId,
      activityId: activity._id,
      activityName: session.confirmedFirstValue.activityName,
      reasoning: session.confirmedFirstValue.reasoning,
      expectedTimeframe: args.expectedTimeframe,
      successCriteria: args.successCriteria,
      confirmedAt: session.confirmedFirstValue.confirmedAt,
      source: "interview",
    });

    // Complete the session
    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt: Date.now(),
    });
  }
});
```

---

### Frontend: Confirmation UI

**Component: `FirstValueCandidateCard.tsx`**

Renders when `session.pendingCandidate` exists:

```tsx
interface FirstValueCandidateCardProps {
  activityName: string;
  reasoning: string;
  onConfirm: () => void;
  onKeepExploring: () => void;
}

export function FirstValueCandidateCard({
  activityName,
  reasoning,
  onConfirm,
  onKeepExploring,
}: FirstValueCandidateCardProps) {
  return (
    <div className="border-2 border-yellow-400 bg-yellow-50 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
        <span className="font-semibold text-gray-900">{activityName}</span>
      </div>

      <p className="text-sm text-gray-600 mb-4">{reasoning}</p>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onKeepExploring}>
          Keep Exploring
        </Button>
        <Button onClick={onConfirm}>
          Confirm First Value
        </Button>
      </div>
    </div>
  );
}
```

**Integration in journey map:**

- When candidate exists, highlight the matching activity in the activation slot
- Render `FirstValueCandidateCard` below the highlighted activity
- Dim other activities slightly to draw focus

---

### Frontend: Follow-up Flow

**After confirmation, AI triggers follow-up questions:**

The backend detects confirmation and AI's next response includes follow-up prompts:

```typescript
// In AI system prompt, after confirmation detected:
`The user just confirmed "${activityName}" as their First Value moment.

Ask these follow-up questions one at a time:
1. "How quickly should new users reach this moment?"
   Offer options: Within first session, Within 24 hours, Within first week, or custom
2. "What does success look like when they reach this moment?"
   Ask for a brief description of the successful outcome

After both answers, summarize and complete the interview.`
```

**Timeframe quick-select component:**

```tsx
const TIMEFRAME_OPTIONS = [
  { value: "first_session", label: "Within first session" },
  { value: "24_hours", label: "Within 24 hours" },
  { value: "first_week", label: "Within first week" },
  { value: "custom", label: "Other" },
];
```

---

### Frontend: Dashboard Display

**Component: `FirstValueDefinitionCard.tsx`**

```tsx
export function FirstValueDefinitionCard() {
  const definition = useQuery(api.firstValue.getDefinition);
  const [isEditing, setIsEditing] = useState(false);

  if (!definition) {
    return (
      <Card>
        <CardHeader>First Value Moment</CardHeader>
        <CardContent>
          <p className="text-gray-500">Not yet defined</p>
          <Button onClick={startFirstValueInterview}>
            Define First Value
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex justify-between">
        <span>First Value Moment</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={startRefineInterview}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-2">
          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          <span className="font-semibold">{definition.activityName}</span>
        </div>
        <p className="text-sm text-gray-600 mb-3">{definition.reasoning}</p>
        <div className="text-sm space-y-1">
          <p><span className="text-gray-500">Timeframe:</span> {definition.expectedTimeframe}</p>
          {definition.successCriteria && (
            <p><span className="text-gray-500">Success:</span> {definition.successCriteria}</p>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Confirmed via {definition.source} • {formatDate(definition.confirmedAt)}
        </p>
      </CardContent>

      {isEditing && (
        <EditFirstValueModal
          definition={definition}
          onClose={() => setIsEditing(false)}
        />
      )}
    </Card>
  );
}
```

**Edit modal fields:**
- Activity selector (dropdown of measurement activities)
- Reasoning (textarea)
- Expected timeframe (dropdown with custom option)
- Success criteria (textarea)

**Refine flow:**
- Opens First Value interview
- AI sees current definition as context
- Can propose new candidate or user can confirm existing is still correct

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `convex/firstValue.ts` | Queries and mutations for First Value definitions |
| `src/components/interview/FirstValueCandidateCard.tsx` | Confirmation UI component |
| `src/components/dashboard/FirstValueDefinitionCard.tsx` | Dashboard display/edit |
| `src/components/dashboard/EditFirstValueModal.tsx` | Edit modal for definition |

### Modified Files

| File | Changes |
|------|---------|
| `convex/schema.ts` | Add `firstValueDefinitions` table, update `interviewSessions` |
| `convex/ai.ts` | Add `propose_first_value_candidate` tool, handle confirmation flow |
| `convex/interviews.ts` | Add confirmation mutations, complete with definition |
| `src/components/overview/OverviewJourneyMap.tsx` | Highlight candidate, render confirmation card |
| `src/routes/HomePage.tsx` or similar | Add First Value Definition card |

---

## Alternatives Considered

### Detection at interview end vs mid-interview
- **Rejected**: End-of-interview detection loses the interactive confirmation moment
- Mid-interview allows natural "is this it?" conversation flow

### Modal overlay vs inline confirmation
- **Rejected**: Modal interrupts the interview flow too abruptly
- Inline on journey map keeps context visible while confirming

### Simple boolean vs rich definition
- **Rejected**: Boolean only marks which activity, loses valuable context
- Rich definition enables better metrics, onboarding guidance, and team alignment

---

## Success Criteria

1. AI successfully proposes First Value candidate during interview when appropriate
2. Candidate appears highlighted on journey map with reasoning
3. User can confirm or keep exploring
4. Follow-up questions capture timeframe and success criteria
5. Definition saved and visible on dashboard
6. Definition editable without re-interviewing
7. Refine option reopens interview with context

---

## Implementation Phases

**Phase 1: Core Detection & Confirmation**
- Schema changes
- AI tool implementation
- Confirmation UI on journey map
- Basic definition storage

**Phase 2: Follow-up Questions**
- Timeframe and success criteria collection
- Interview completion flow
- Definition save on complete

**Phase 3: Dashboard & Editing**
- First Value Definition card
- Edit modal
- Refine interview flow
