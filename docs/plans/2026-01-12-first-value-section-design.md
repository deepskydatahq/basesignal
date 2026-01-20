# FirstValueSection Design

## Overview

A self-contained card component displaying the user's first value moment definition with inline editing capability. Shows activity name, expected timeframe, and confirmation status.

## Problem Statement

Users need to see and edit their "first value moment" definition - the key activity that signals a user has gotten value from the product. This section must handle three states: undefined, defined, and confirmed.

## Expert Perspectives

### Product
The asymmetry between "Define" (interview) and "Edit" (modal) is intentional but context-dependent. On the Profile page, users already know their measurement structure - they're filling in a known gap, not exploring. A modal respects that context and removes unnecessary friction. The interview flow belongs in Setup where guided exploration adds value.

### Technical
Use `updateDefinition` mutation for both create and update - it already handles both seamlessly. Keep the component self-contained rather than depending on ProfileSection (which doesn't exist yet). Inline form is simpler than modal abstraction for this use case.

### Simplification Review
- Removed modal as separate component - inline form directly
- Removed reasoning from display - show only: activity name, timeframe, confirmation date
- Removed successCriteria - not captured by interview yet
- Removed ProfileSection dependency - standalone card first
- Reduced tests from 5 to 3 core states

## Proposed Solution

Build FirstValueSection as a standalone card that:
1. Fetches first value data via `useQuery(api.firstValue.getDefinition)`
2. Displays current state with appropriate styling
3. Opens inline edit form for both "Define" and "Edit" actions
4. Uses `updateDefinition` mutation for persistence

## Design Details

### Component Structure

```typescript
// src/components/profile/FirstValueSection.tsx
export function FirstValueSection() {
  const definition = useQuery(api.firstValue.getDefinition);
  const [isEditing, setIsEditing] = useState(false);

  // Three states: undefined, defined, confirmed
  const status = !definition
    ? "not_started"
    : definition.confirmedAt
      ? "complete"
      : "in_progress";
}
```

### State Display

| State | Status Badge | Display | Action |
|-------|-------------|---------|--------|
| Undefined | "Not defined" (gray) | Empty state message | "Define" button |
| Defined | "Pending confirmation" (blue) | Activity + timeframe | "Edit" button |
| Confirmed | "Confirmed" (green) | Activity + timeframe + date | "Edit" button |

### Display Layout (Defined/Confirmed)

```
┌─────────────────────────────────────────────────────────┐
│ First Value Moment                    ✓ Confirmed [Edit]│
│ ─────────────────────────────────────────────────────── │
│ "Created First Report"                                  │
│                                                         │
│ Expected: Within 3 days    Confirmed: Jan 10, 2026      │
└─────────────────────────────────────────────────────────┘
```

### Display Layout (Undefined)

```
┌─────────────────────────────────────────────────────────┐
│ First Value Moment                  ○ Not defined       │
│ ─────────────────────────────────────────────────────── │
│ Define the moment when users first experience value     │
│                                                         │
│                                              [Define]   │
└─────────────────────────────────────────────────────────┘
```

### Edit Form Fields

Inline form when editing (not a modal):
- `activityName` - Text input, required
- `reasoning` - Textarea, optional (captured but not displayed)
- `expectedTimeframe` - Select (Within 1 day, 3 days, 1 week, 2 weeks, 1 month)

### Data Flow

```
useQuery(api.firstValue.getDefinition)
  ↓
FirstValueSection renders current state
  ↓
User clicks Define/Edit
  ↓
Inline form appears
  ↓
User submits
  ↓
useMutation(api.firstValue.updateDefinition)
  ↓
Query invalidates, UI updates
```

## Alternatives Considered

1. **Modal for editing** - Rejected. Inline editing is simpler and sufficient for 3 form fields.

2. **Navigate to interview for "Define"** - Rejected for Profile page context. Users here know their product; modal is faster. Interview stays in Setup flow.

3. **Depend on ProfileSection wrapper** - Rejected. ProfileSection doesn't exist yet. Build standalone, compose later.

4. **Show reasoning in display** - Rejected. Clutters the card. Activity name + timeframe + confirmation date is sufficient.

## Success Criteria

- Component renders correctly for all three states (undefined, defined, confirmed)
- Define/Edit actions open inline form
- Form submission persists via updateDefinition mutation
- Tests cover the three core states
