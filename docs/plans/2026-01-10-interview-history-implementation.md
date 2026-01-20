# Interview History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the ability to view past interview sessions and transcripts from the journey editor.

**Architecture:** Backend queries fetch session history and transcript data from existing `interviewSessions` and `interviewMessages` tables. Frontend adds a History button to the journey editor toolbar that opens a slide-out drawer showing session list and transcript views.

**Tech Stack:** Convex queries, React components, Tailwind CSS

---

## Task 1: Add `getSessionHistory` Query

**Files:**
- Modify: `convex/interviews.ts:347+`
- Test: `convex/interviews.test.ts` (create)

**Step 1: Write the failing test**

Create the test file:

```typescript
// convex/interviews.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

describe("getSessionHistory", () => {
  it("returns empty array when no sessions exist", async () => {
    const t = convexTest(schema);

    // Create user and journey
    const { journeyId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Test Journey",
        isDefault: true,
        createdAt: Date.now(),
      });
      return { journeyId };
    });

    const history = await t.query(api.interviews.getSessionHistory, { journeyId });
    expect(history).toEqual([]);
  });

  it("returns sessions with message count and activities added", async () => {
    const t = convexTest(schema);

    const { journeyId, sessionId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Test Journey",
        isDefault: true,
        createdAt: Date.now(),
      });
      const sessionId = await ctx.db.insert("interviewSessions", {
        journeyId,
        interviewType: "overview",
        status: "completed",
        startedAt: Date.now() - 3600000,
        completedAt: Date.now(),
      });
      // Add messages with tool calls
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "assistant",
        content: "Let me add a stage.",
        toolCalls: [{ name: "add_stage", arguments: { name: "Signup" }, result: "success" }],
        createdAt: Date.now() - 1000,
      });
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "user",
        content: "Thanks!",
        createdAt: Date.now(),
      });
      return { journeyId, sessionId };
    });

    const history = await t.query(api.interviews.getSessionHistory, { journeyId });

    expect(history).toHaveLength(1);
    expect(history[0]._id).toBe(sessionId);
    expect(history[0].messageCount).toBe(2);
    expect(history[0].activitiesAdded).toBe(1);
    expect(history[0].interviewType).toBe("overview");
    expect(history[0].status).toBe("completed");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/interviews.test.ts`
Expected: FAIL with "getSessionHistory is not a function" or similar

**Step 3: Write minimal implementation**

Add to `convex/interviews.ts`:

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
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/interviews.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/interviews.ts convex/interviews.test.ts
git commit -m "$(cat <<'EOF'
feat(interviews): add getSessionHistory query

Returns all sessions for a journey with message count and activities
added count computed from tool calls.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `getTranscript` Query

**Files:**
- Modify: `convex/interviews.ts`
- Test: `convex/interviews.test.ts`

**Step 1: Write the failing test**

Add to `convex/interviews.test.ts`:

```typescript
describe("getTranscript", () => {
  it("returns messages in chronological order with formatted data", async () => {
    const t = convexTest(schema);

    const { sessionId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Test Journey",
        isDefault: true,
        createdAt: Date.now(),
      });
      const sessionId = await ctx.db.insert("interviewSessions", {
        journeyId,
        interviewType: "overview",
        status: "completed",
        startedAt: Date.now(),
      });
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "assistant",
        content: "Hello!",
        createdAt: 1000,
      });
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "user",
        content: "Hi there!",
        createdAt: 2000,
      });
      return { sessionId };
    });

    const transcript = await t.query(api.interviews.getTranscript, { sessionId });

    expect(transcript).toHaveLength(2);
    expect(transcript[0].role).toBe("assistant");
    expect(transcript[0].content).toBe("Hello!");
    expect(transcript[0].timestamp).toBe(1000);
    expect(transcript[1].role).toBe("user");
    expect(transcript[1].content).toBe("Hi there!");
    expect(transcript[1].timestamp).toBe(2000);
  });

  it("includes tool calls in transcript", async () => {
    const t = convexTest(schema);

    const { sessionId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Test Journey",
        isDefault: true,
        createdAt: Date.now(),
      });
      const sessionId = await ctx.db.insert("interviewSessions", {
        journeyId,
        interviewType: "overview",
        status: "completed",
        startedAt: Date.now(),
      });
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "assistant",
        content: "Adding stage.",
        toolCalls: [{ name: "add_stage", arguments: { name: "Entry" }, result: "success" }],
        createdAt: 1000,
      });
      return { sessionId };
    });

    const transcript = await t.query(api.interviews.getTranscript, { sessionId });

    expect(transcript[0].toolCalls).toBeDefined();
    expect(transcript[0].toolCalls?.[0].name).toBe("add_stage");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/interviews.test.ts`
Expected: FAIL with "getTranscript is not a function"

**Step 3: Write minimal implementation**

Add to `convex/interviews.ts`:

```typescript
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

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/interviews.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/interviews.ts convex/interviews.test.ts
git commit -m "$(cat <<'EOF'
feat(interviews): add getTranscript query

Returns messages in chronological order with role, content, timestamp,
and tool calls for transcript display.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create SessionCard Component

**Files:**
- Create: `src/components/interview/SessionCard.tsx`
- Test: `src/components/interview/SessionCard.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/interview/SessionCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SessionCard from "./SessionCard";

describe("SessionCard", () => {
  const mockSession = {
    _id: "session1" as any,
    interviewType: "overview",
    status: "completed",
    startedAt: new Date("2026-01-08T14:00:00").getTime(),
    completedAt: new Date("2026-01-08T15:00:00").getTime(),
    messageCount: 12,
    activitiesAdded: 5,
  };

  function setup(props = {}) {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const result = render(
      <SessionCard session={mockSession} onClick={onClick} {...props} />
    );
    return { user, onClick, ...result };
  }

  it("displays interview type label", () => {
    setup();
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("displays completed status", () => {
    setup();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("displays message count", () => {
    setup();
    expect(screen.getByText(/12 messages/)).toBeInTheDocument();
  });

  it("displays activities added", () => {
    setup();
    expect(screen.getByText(/5 activities/)).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const { user, onClick } = setup();
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("displays in-progress status for active sessions", () => {
    const activeSession = { ...mockSession, status: "active", completedAt: undefined };
    render(<SessionCard session={activeSession} onClick={vi.fn()} />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/interview/SessionCard.test.tsx`
Expected: FAIL with "Cannot find module './SessionCard'"

**Step 3: Write minimal implementation**

```typescript
// src/components/interview/SessionCard.tsx
import { Check, Loader2 } from "lucide-react";
import { INTERVIEW_TYPES, type InterviewType } from "../../shared/interviewTypes";
import type { Id } from "../../../convex/_generated/dataModel";

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

export default function SessionCard({ session, onClick }: SessionCardProps) {
  const typeLabel = INTERVIEW_TYPES[session.interviewType as InterviewType]?.name
    ?? session.interviewType.replace(/_/g, " ");

  const isComplete = session.status === "completed";
  const date = new Date(session.startedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900">{typeLabel}</h3>
        <span className="text-sm text-gray-500">{date}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {isComplete ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            <span>Completed</span>
          </>
        ) : (
          <>
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <span>In Progress</span>
          </>
        )}
        <span>·</span>
        <span>{session.messageCount} messages</span>
        <span>·</span>
        <span>{session.activitiesAdded} activities</span>
      </div>
    </button>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/interview/SessionCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/interview/SessionCard.tsx src/components/interview/SessionCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(interview): add SessionCard component

Displays session summary with type, status, date, message count, and
activities added for the interview history drawer.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create TranscriptView Component

**Files:**
- Create: `src/components/interview/TranscriptView.tsx`
- Test: `src/components/interview/TranscriptView.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/interview/TranscriptView.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import TranscriptView from "./TranscriptView";

// Mock the Convex query
vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn(() => [
      { role: "assistant", content: "Hello!", timestamp: 1000, toolCalls: undefined },
      { role: "user", content: "Hi there!", timestamp: 2000, toolCalls: undefined },
    ]),
  };
});

describe("TranscriptView", () => {
  function setup() {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(
      <TranscriptView
        sessionId={"session1" as any}
        interviewType="overview"
        date={new Date("2026-01-08").getTime()}
        onBack={onBack}
      />
    );
    return { user, onBack };
  }

  it("displays header with interview type and date", () => {
    setup();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText(/Jan 8, 2026/)).toBeInTheDocument();
  });

  it("displays back button", () => {
    setup();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("displays messages with role labels", () => {
    setup();
    expect(screen.getByText("ASSISTANT")).toBeInTheDocument();
    expect(screen.getByText("YOU")).toBeInTheDocument();
    expect(screen.getByText("Hello!")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("calls onBack when back button clicked", async () => {
    const { user, onBack } = setup();
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/interview/TranscriptView.test.tsx`
Expected: FAIL with "Cannot find module './TranscriptView'"

**Step 3: Write minimal implementation**

```typescript
// src/components/interview/TranscriptView.tsx
import { ArrowLeft } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { INTERVIEW_TYPES, type InterviewType } from "../../shared/interviewTypes";
import { ScrollArea } from "../ui/scroll-area";

interface TranscriptViewProps {
  sessionId: Id<"interviewSessions">;
  interviewType: string;
  date: number;
  onBack: () => void;
}

export default function TranscriptView({
  sessionId,
  interviewType,
  date,
  onBack,
}: TranscriptViewProps) {
  const transcript = useQuery(api.interviews.getTranscript, { sessionId });
  const typeLabel = INTERVIEW_TYPES[interviewType as InterviewType]?.name
    ?? interviewType.replace(/_/g, " ");
  const dateStr = new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
        <button
          onClick={onBack}
          className="p-1 text-gray-400 hover:text-gray-600"
          aria-label="Back to session list"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-medium text-gray-900">{typeLabel}</h2>
          <p className="text-sm text-gray-500">{dateStr}</p>
        </div>
      </div>

      {/* Transcript */}
      <ScrollArea className="flex-1 p-4">
        {transcript === undefined ? (
          <div className="text-gray-500 text-sm">Loading transcript...</div>
        ) : transcript.length === 0 ? (
          <div className="text-gray-500 text-sm">No messages in this session.</div>
        ) : (
          <div className="space-y-6">
            {transcript.map((message, index) => (
              <div key={index}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">
                    {message.role === "assistant" ? "ASSISTANT" : "YOU"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.toolCalls.map((tc, tcIndex) => (
                        <span
                          key={tcIndex}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded"
                        >
                          Added: {tc.arguments?.name || tc.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/interview/TranscriptView.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/interview/TranscriptView.tsx src/components/interview/TranscriptView.test.tsx
git commit -m "$(cat <<'EOF'
feat(interview): add TranscriptView component

Displays interview transcript in document format with role labels,
timestamps, and tool call badges.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create InterviewHistoryDrawer Component

**Files:**
- Create: `src/components/interview/InterviewHistoryDrawer.tsx`
- Test: `src/components/interview/InterviewHistoryDrawer.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/interview/InterviewHistoryDrawer.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewHistoryDrawer from "./InterviewHistoryDrawer";

// Mock Convex query
const mockHistory = [
  {
    _id: "session1",
    interviewType: "overview",
    status: "completed",
    startedAt: new Date("2026-01-08").getTime(),
    completedAt: new Date("2026-01-08").getTime(),
    messageCount: 10,
    activitiesAdded: 3,
  },
];

vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn((queryRef) => {
      // Return different data based on which query is called
      if (queryRef?.toString?.()?.includes("getSessionHistory")) {
        return mockHistory;
      }
      if (queryRef?.toString?.()?.includes("getTranscript")) {
        return [{ role: "assistant", content: "Hello", timestamp: 1000 }];
      }
      return mockHistory;
    }),
  };
});

describe("InterviewHistoryDrawer", () => {
  function setup(isOpen = true) {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <InterviewHistoryDrawer
        journeyId={"journey1" as any}
        isOpen={isOpen}
        onClose={onClose}
      />
    );
    return { user, onClose };
  }

  it("renders nothing when closed", () => {
    setup(false);
    expect(screen.queryByText("Interview History")).not.toBeInTheDocument();
  });

  it("displays header with title", () => {
    setup();
    expect(screen.getByText("Interview History")).toBeInTheDocument();
  });

  it("displays close button", () => {
    setup();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("displays session cards", () => {
    setup();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText(/10 messages/)).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/interview/InterviewHistoryDrawer.test.tsx`
Expected: FAIL with "Cannot find module './InterviewHistoryDrawer'"

**Step 3: Write minimal implementation**

```typescript
// src/components/interview/InterviewHistoryDrawer.tsx
import { useState } from "react";
import { X } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ScrollArea } from "../ui/scroll-area";
import SessionCard from "./SessionCard";
import TranscriptView from "./TranscriptView";

interface InterviewHistoryDrawerProps {
  journeyId: Id<"journeys">;
  isOpen: boolean;
  onClose: () => void;
}

export default function InterviewHistoryDrawer({
  journeyId,
  isOpen,
  onClose,
}: InterviewHistoryDrawerProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<Id<"interviewSessions"> | null>(null);
  const history = useQuery(api.interviews.getSessionHistory, { journeyId });

  if (!isOpen) return null;

  const selectedSession = history?.find((s) => s._id === selectedSessionId);

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {selectedSession ? (
        <TranscriptView
          sessionId={selectedSession._id}
          interviewType={selectedSession.interviewType}
          date={selectedSession.startedAt}
          onBack={() => setSelectedSessionId(null)}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="font-medium text-gray-900">Interview History</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Session List */}
          <ScrollArea className="flex-1 p-4">
            {history === undefined ? (
              <div className="text-gray-500 text-sm">Loading sessions...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No interview sessions yet</p>
                <p className="text-sm text-gray-400">
                  Start an interview from the panel on the left to begin building your journey map.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((session) => (
                  <SessionCard
                    key={session._id}
                    session={session}
                    onClick={() => setSelectedSessionId(session._id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/interview/InterviewHistoryDrawer.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/interview/InterviewHistoryDrawer.tsx src/components/interview/InterviewHistoryDrawer.test.tsx
git commit -m "$(cat <<'EOF'
feat(interview): add InterviewHistoryDrawer component

Slide-out drawer showing session list and transcript view. Manages
state to toggle between list and detail views.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create InterviewHistoryButton Component

**Files:**
- Create: `src/components/interview/InterviewHistoryButton.tsx`
- Test: `src/components/interview/InterviewHistoryButton.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/interview/InterviewHistoryButton.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewHistoryButton from "./InterviewHistoryButton";

// Mock useQuery with different return values
let mockSessionCount = 3;
vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn(() => Array(mockSessionCount).fill({
      _id: "session",
      interviewType: "overview",
      status: "completed",
      startedAt: Date.now(),
      messageCount: 5,
      activitiesAdded: 2,
    })),
  };
});

describe("InterviewHistoryButton", () => {
  function setup() {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<InterviewHistoryButton journeyId={"journey1" as any} onClick={onClick} />);
    return { user, onClick };
  }

  it("displays History label", () => {
    setup();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("displays session count badge", () => {
    setup();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const { user, onClick } = setup();
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("hides badge when no sessions", () => {
    mockSessionCount = 0;
    render(<InterviewHistoryButton journeyId={"journey1" as any} onClick={vi.fn()} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/interview/InterviewHistoryButton.test.tsx`
Expected: FAIL with "Cannot find module './InterviewHistoryButton'"

**Step 3: Write minimal implementation**

```typescript
// src/components/interview/InterviewHistoryButton.tsx
import { History } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";

interface InterviewHistoryButtonProps {
  journeyId: Id<"journeys">;
  onClick: () => void;
}

export default function InterviewHistoryButton({
  journeyId,
  onClick,
}: InterviewHistoryButtonProps) {
  const history = useQuery(api.interviews.getSessionHistory, { journeyId });
  const count = history?.length ?? 0;

  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <History className="w-4 h-4 mr-1" />
      History
      {count > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
          {count}
        </span>
      )}
    </Button>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/interview/InterviewHistoryButton.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/interview/InterviewHistoryButton.tsx src/components/interview/InterviewHistoryButton.test.tsx
git commit -m "$(cat <<'EOF'
feat(interview): add InterviewHistoryButton component

Button with session count badge for opening the history drawer.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Export New Components from Barrel File

**Files:**
- Modify: `src/components/interview/index.ts`

**Step 1: Read current barrel file**

Check current exports in `src/components/interview/index.ts`

**Step 2: Add exports for new components**

Add to `src/components/interview/index.ts`:

```typescript
export { default as InterviewHistoryButton } from "./InterviewHistoryButton";
export { default as InterviewHistoryDrawer } from "./InterviewHistoryDrawer";
export { default as SessionCard } from "./SessionCard";
export { default as TranscriptView } from "./TranscriptView";
```

**Step 3: Commit**

```bash
git add src/components/interview/index.ts
git commit -m "$(cat <<'EOF'
chore(interview): export history components from barrel file

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Integrate History Button and Drawer into JourneyEditorPage

**Files:**
- Modify: `src/routes/JourneyEditorPage.tsx`
- Test: `src/routes/JourneyEditorPage.test.tsx` (create integration test)

**Step 1: Write the failing test**

```typescript
// src/routes/JourneyEditorPage.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import JourneyEditorPage from "./JourneyEditorPage";

// Mock Convex hooks
vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn((queryRef) => {
      const queryStr = queryRef?.toString?.() || "";
      if (queryStr.includes("journeys.get")) {
        return { _id: "journey1", name: "Test Journey", type: "overview", userId: "user1" };
      }
      if (queryStr.includes("stages.listByJourney")) {
        return [{ _id: "stage1", name: "Entry", type: "entry", position: { x: 0, y: 0 } }];
      }
      if (queryStr.includes("transitions.listByJourney")) {
        return [];
      }
      if (queryStr.includes("getSessionHistory")) {
        return [{ _id: "session1", interviewType: "overview", status: "completed", startedAt: Date.now(), messageCount: 5, activitiesAdded: 2 }];
      }
      if (queryStr.includes("listSessionsWithStatus")) {
        return { overview: { status: "complete", sessionId: "session1" } };
      }
      return null;
    }),
    useMutation: vi.fn(() => vi.fn()),
  };
});

describe("JourneyEditorPage History Integration", () => {
  function setup() {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/journeys/journey1"]}>
        <Routes>
          <Route path="/journeys/:journeyId" element={<JourneyEditorPage />} />
        </Routes>
      </MemoryRouter>
    );
    return { user };
  }

  it("displays History button in toolbar", () => {
    setup();
    expect(screen.getByRole("button", { name: /history/i })).toBeInTheDocument();
  });

  it("opens drawer when History button is clicked", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /history/i }));
    expect(screen.getByText("Interview History")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/routes/JourneyEditorPage.test.tsx`
Expected: FAIL (no History button in toolbar yet)

**Step 3: Modify JourneyEditorPage to add button and drawer**

In `src/routes/JourneyEditorPage.tsx`:

1. Add import:
```typescript
import { InterviewHistoryButton, InterviewHistoryDrawer } from "../components/interview";
```

2. Add state (after line 38):
```typescript
const [isHistoryOpen, setIsHistoryOpen] = useState(false);
```

3. Add button to toolbar (after the Organize button, around line 220):
```typescript
<InterviewHistoryButton
  journeyId={journeyId as Id<"journeys">}
  onClick={() => setIsHistoryOpen(true)}
/>
```

4. Add drawer (at end of component, before final `</div>`):
```typescript
<InterviewHistoryDrawer
  journeyId={journeyId as Id<"journeys">}
  isOpen={isHistoryOpen}
  onClose={() => setIsHistoryOpen(false)}
/>
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/routes/JourneyEditorPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/JourneyEditorPage.tsx src/routes/JourneyEditorPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(journey-editor): integrate interview history button and drawer

Adds History button to toolbar and drawer overlay for viewing past
interview sessions and transcripts.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Run Full Test Suite and Verify

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

**Step 4: Final commit if any fixes needed**

If fixes were made:
```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: address test/lint issues from interview history feature

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add `getSessionHistory` query | `convex/interviews.ts`, `convex/interviews.test.ts` |
| 2 | Add `getTranscript` query | `convex/interviews.ts`, `convex/interviews.test.ts` |
| 3 | Create `SessionCard` component | `src/components/interview/SessionCard.tsx`, test |
| 4 | Create `TranscriptView` component | `src/components/interview/TranscriptView.tsx`, test |
| 5 | Create `InterviewHistoryDrawer` component | `src/components/interview/InterviewHistoryDrawer.tsx`, test |
| 6 | Create `InterviewHistoryButton` component | `src/components/interview/InterviewHistoryButton.tsx`, test |
| 7 | Export components from barrel | `src/components/interview/index.ts` |
| 8 | Integrate into JourneyEditorPage | `src/routes/JourneyEditorPage.tsx`, test |
| 9 | Full test suite verification | Run `npm run test:run` |
