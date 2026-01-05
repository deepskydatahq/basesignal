# Overview Interview Layout Improvements - Design

## Goal

Improve the Overview Interview screen layout to feel balanced and have clear visual hierarchy.

## Current State

- 50/50 split: interview chat (left) + journey map (right)
- Content left-heavy, not centered
- No headline for interview section
- Interview prompt blends in without structure
- Feels like work-in-progress UI

## Design Decisions

### Layout Structure

**Keep 50/50 split.** Journey map stays as right sidebar.

**Center interview content** within its half:
- Vertically centered in available space
- Max-width constraint (~480-520px) so lines aren't too wide
- As conversation grows, scrolls naturally

```
┌─────────────────────────┬─────────────────────────┐
│                         │                         │
│   ┌─────────────────┐   │   Journey stages...     │
│   │ Headline        │   │                         │
│   │ Subheadline     │   │   ✓ Signup              │
│   │                 │   │   ○ Setup               │
│   │ [Messages...]   │   │   ○ Activated           │
│   │                 │   │   ...                   │
│   │ [Input]         │   │                         │
│   │ [Button]        │   │                         │
│   └─────────────────┘   │                         │
│                         │                         │
└─────────────────────────┴─────────────────────────┘
```

### Headline & Typography

**Headline block** at top of centered content (stays fixed, doesn't scroll):

```
Define your user lifecycle
Tell us how users move through your product
```

- Headline: `text-xl font-semibold text-gray-900`
- Subheadline: `text-sm text-gray-500 mt-1`
- Spacing below: `mb-6` before messages area

### Messages Area

**Minimal style** - keep current look, improve spacing:

- Padding: `p-6` (up from p-4)
- Message gaps: `space-y-6` (up from space-y-4)
- Slightly larger line-height for readability

**Subtle message differentiation:**
- AI messages: Left-aligned, `text-gray-700`, no background
- User messages: Left-aligned with `pl-4 border-l-2 border-gray-200`

### Input Area & Button

- Larger textarea: 2 rows default (up from 1)
- More breathing room around input section
- Better spacing between input and button (`mt-4`)
- Keep current button states and "missing stages" hint

## Files to Modify

- `src/routes/SetupInterviewPage.tsx` - Add centering wrapper
- `src/components/overview/OverviewInterviewPanel.tsx` - Add headline, adjust structure
- `src/components/interview/MessageList.tsx` - Adjust spacing
- `src/components/interview/MessageBubble.tsx` - Add user message styling
- `src/components/interview/InputArea.tsx` - Larger textarea, spacing

## Out of Scope

- Journey map styling (right panel unchanged)
- Chat bubble visual overhaul
- Moving journey map below as progress indicator
