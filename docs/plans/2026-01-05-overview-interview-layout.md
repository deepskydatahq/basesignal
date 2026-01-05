# Overview Interview Layout Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the Overview Interview screen layout with centered content, headline, and better visual hierarchy.

**Architecture:** UI-only changes across 5 files. Add headline to interview panel, center content with max-width, improve message spacing, and add subtle user message differentiation. No backend changes.

**Tech Stack:** React, Tailwind CSS, Vitest/RTL

---

## Summary of Changes

| File | Change |
|------|--------|
| OverviewInterviewPanel.tsx | Add headline block, restructure for centering |
| SetupInterviewPage.tsx | Add centering wrapper for interview panel |
| MessageList.tsx | Increase padding and message gaps |
| MessageBubble.tsx | Remove bubble styling, add left border for user messages |
| InputArea.tsx | Increase textarea rows, improve spacing |

---

### Task 1: Add headline to OverviewInterviewPanel

**Files:**
- Modify: `src/components/overview/OverviewInterviewPanel.tsx:56-84`

**Step 1: Add headline block after the loading checks**

In `OverviewInterviewPanel.tsx`, update the return statement (starting at line 56) to include the headline:

```tsx
return (
  <div className="flex flex-col h-full">
    {/* Headline */}
    <div className="px-6 pt-6 pb-4">
      <h1 className="text-xl font-semibold text-gray-900">
        Define your user lifecycle
      </h1>
      <p className="text-sm text-gray-500 mt-1">
        Tell us how users move through your product
      </p>
    </div>

    {/* Messages */}
    <MessageList sessionId={activeSession._id} />

    {/* Input */}
    <InputArea sessionId={activeSession._id} />

    {/* Complete button */}
    <div className="p-4 border-t border-gray-200">
      <button
        onClick={handleComplete}
        disabled={!canComplete}
        className={`w-full py-2.5 px-4 text-sm font-medium rounded-lg transition-colors ${
          canComplete
            ? "bg-black text-white hover:bg-gray-800"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        }`}
      >
        {canComplete ? "Complete Interview" : "Complete Interview"}
      </button>
      {!canComplete && completionStatus?.missingRequired && (
        <p className="mt-2 text-xs text-gray-500 text-center">
          Fill in {completionStatus.missingRequired.length} more required{" "}
          {completionStatus.missingRequired.length === 1 ? "stage" : "stages"}
        </p>
      )}
    </div>
  </div>
);
```

**Step 2: Verify the app runs**

Run: `npm run dev` and navigate to `/setup/interview`
Expected: Headline visible at top of interview panel

**Step 3: Commit**

```bash
git add src/components/overview/OverviewInterviewPanel.tsx
git commit -m "feat: add headline to overview interview panel"
```

---

### Task 2: Center interview content in SetupInterviewPage

**Files:**
- Modify: `src/routes/SetupInterviewPage.tsx:60-75`

**Step 1: Update the layout wrapper**

Change the return statement (lines 60-75) to center the interview content:

```tsx
return (
  <div className="flex h-full">
    {/* Left: Interview chat - centered content */}
    <div className="w-1/2 border-r border-gray-200 flex items-center justify-center">
      <div className="w-full max-w-lg h-full">
        <OverviewInterviewPanel
          journeyId={setupProgress.overviewJourneyId}
          onComplete={handleComplete}
        />
      </div>
    </div>

    {/* Right: Journey map */}
    <div className="w-1/2 bg-gray-50">
      <OverviewJourneyMap journeyId={setupProgress.overviewJourneyId} />
    </div>
  </div>
);
```

**Step 2: Verify the app runs**

Run: `npm run dev` and navigate to `/setup/interview`
Expected: Interview content centered horizontally with max-width constraint

**Step 3: Commit**

```bash
git add src/routes/SetupInterviewPage.tsx
git commit -m "feat: center interview content with max-width"
```

---

### Task 3: Improve MessageList spacing

**Files:**
- Modify: `src/components/interview/MessageList.tsx:38-50`

**Step 1: Update padding and gap**

Change the messages container (line 39) from `p-4 space-y-4` to `p-6 space-y-6`:

```tsx
return (
  <div className="flex-1 overflow-y-auto p-6 space-y-6">
    {messages.map((message) => (
      <MessageBubble
        key={message._id}
        role={message.role as "user" | "assistant"}
        content={message.content}
        toolCalls={message.toolCalls}
      />
    ))}
    <div ref={bottomRef} />
  </div>
);
```

**Step 2: Verify the app runs**

Run: `npm run dev` and check message spacing
Expected: More breathing room between messages

**Step 3: Commit**

```bash
git add src/components/interview/MessageList.tsx
git commit -m "feat: increase message list padding and gaps"
```

---

### Task 4: Update MessageBubble to minimal style

**Files:**
- Modify: `src/components/interview/MessageBubble.tsx:22-44`

**Step 1: Replace bubble styling with minimal style**

Update the component return (lines 22-44) to remove bubbles and add left border for user messages:

```tsx
return (
  <div
    className={`${
      isUser
        ? "pl-4 border-l-2 border-gray-300"
        : ""
    }`}
  >
    {/* Message content */}
    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
      {content}
    </p>

    {/* Tool calls (for assistant messages) */}
    {toolCalls && toolCalls.length > 0 && (
      <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
        {toolCalls.map((tool, i) => (
          <ToolCallBadge key={i} toolCall={tool} />
        ))}
      </div>
    )}
  </div>
);
```

**Step 2: Verify the app runs**

Run: `npm run dev` and check message styling
Expected: Clean minimal messages, user messages have subtle left border

**Step 3: Commit**

```bash
git add src/components/interview/MessageBubble.tsx
git commit -m "feat: update message bubble to minimal style"
```

---

### Task 5: Improve InputArea spacing and size

**Files:**
- Modify: `src/components/interview/InputArea.tsx:40-69`

**Step 1: Update textarea and spacing**

Change the input area (lines 40-69) to have larger textarea and better spacing:

```tsx
return (
  <div className="px-6 py-4 border-t border-gray-200">
    {isLoading && (
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Thinking...</span>
      </div>
    )}
    <div className="flex gap-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe your journey..."
        disabled={isLoading}
        rows={2}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-500"
      />
      <button
        onClick={handleSubmit}
        disabled={!message.trim() || isLoading}
        className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed self-end"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
    <p className="mt-2 text-xs text-gray-400">
      Press Enter to send, Shift+Enter for new line
    </p>
  </div>
);
```

**Step 2: Verify the app runs**

Run: `npm run dev` and check input area
Expected: Larger textarea (2 rows), consistent styling with rest of UI

**Step 3: Commit**

```bash
git add src/components/interview/InputArea.tsx
git commit -m "feat: improve input area size and spacing"
```

---

### Task 6: Final verification

**Step 1: Run linting**

Run: `npm run lint`
Expected: No new errors

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 4: Manual verification**

Run `npm run dev` and walk through the interview:
1. Headline "Define your user lifecycle" visible at top
2. Subheadline "Tell us how users move through your product" below
3. Interview content centered with max-width
4. Messages have more spacing, minimal style (no bubbles)
5. User messages have subtle left border
6. Input textarea is 2 rows
7. Journey map on right unchanged

**Step 5: Final commit if any cleanup needed**

If everything passes, the implementation is complete.
