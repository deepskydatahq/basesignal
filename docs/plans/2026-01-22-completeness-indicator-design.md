# CompletenessIndicator Component Design

## Overview

A popover-based completeness indicator that shows profile progress in collapsed form (progress bar + "X of 11" count) and expands on click to show a checklist of all 11 profile sections with their completion status, plus a "Complete Next Section" CTA.

## Problem Statement

Users need a quick way to see their overall profile progress and identify which section to work on next. The ProfilePage shows all sections, but scrolling through them doesn't provide an at-a-glance view of total progress or an easy way to jump to the next incomplete section.

## Expert Perspectives

### Product
- Focus on the user's job: "know what's blocking me and what to do next"
- Popover pattern respects user time - quick glance, find next action, close
- Section counts (not percentages) are the meaningful unit of progress in this domain
- Status labels map to the P&L framework's natural cognitive breaks

### Technical
- Convention-based DOM IDs (`id="section-{sectionId}"`) for scroll targeting - zero props plumbing
- Popover from shadcn/ui is a well-tested primitive already in the codebase
- Simple `scrollIntoView` for navigation - no complex ref management
- Component receives pre-calculated section data, keeps logic out of view layer

### Simplification Review
- Kept status labels as required, but implementation is a simple threshold check
- Scroll behavior is native `scrollIntoView` only - no animation libraries
- No additional state management - popover open/close is internal
- Component is self-contained with minimal props interface

## Proposed Solution

Create `CompletenessIndicator.tsx` that:
1. Renders a clickable trigger showing progress bar + count
2. Opens a popover with full section checklist
3. Shows status label based on completion count thresholds
4. Provides CTA that scrolls to the first incomplete section

## Design Details

### Component Interface

```typescript
interface Section {
  id: string           // e.g., "journey_map", "metric_catalog"
  label: string        // e.g., "Journey Map", "Metric Catalog"
  isComplete: boolean
}

interface CompletenessIndicatorProps {
  sections: Section[]
}
```

### Status Label Thresholds

| Completed | Status Label | Badge Variant |
|-----------|--------------|---------------|
| 0-3 | "Getting Started" | gray/muted |
| 4-6 | "Taking Shape" | blue/info |
| 7-9 | "Well Defined" | amber/warning |
| 10-11 | "Complete" | green/success |

### Visual States

**Collapsed (trigger button):**
```
[████████░░░░] 7 of 11 ▼
```

**Expanded (popover):**
```
┌─────────────────────────────┐
│  Well Defined               │
├─────────────────────────────┤
│ ✓ Core Identity             │
│ ✓ Journey Map               │
│ ✓ First Value Moment        │
│ ✓ Metric Catalog            │
│ ○ Measurement Plan          │ ← first incomplete
│ ○ Heartbeat Event           │
│ ○ Activation Definition     │
│ ○ Active Definition         │
│ ○ At-Risk Signals           │
│ ○ Churn Definition          │
│ ○ Expansion Triggers        │
├─────────────────────────────┤
│ [Complete Measurement Plan] │
└─────────────────────────────┘
```

### Scroll Behavior

Convention-based DOM IDs allow scroll targeting without props:
- ProfilePage sections have `id="section-{sectionId}"`
- CompletenessIndicator uses `document.getElementById(`section-${id}`).scrollIntoView({ behavior: 'smooth', block: 'start' })`
- Popover closes after CTA click

### UI Components Used

- `Popover`, `PopoverTrigger`, `PopoverContent` from shadcn/ui
- `Progress` component for progress bar
- `Badge` for status label
- `Button` for trigger and CTA
- `CheckCircle2`, `Circle`, `ChevronDown` icons from lucide-react

## Alternatives Considered

1. **Collapsible (inline expansion)** - Rejected because it would push header content down and disrupt reading flow. Popover is more appropriate for transient, glance-and-go interactions.

2. **Percentage-based status labels** - Rejected because section counts are the meaningful unit in the P&L framework. "4 of 11" communicates progress more clearly than "36%".

3. **Props-based scroll targeting** - Rejected in favor of convention-based DOM IDs. Section IDs already exist in data; using them in DOM `id` attributes is simpler and self-documenting.

4. **Navigate away instead of scroll** - Rejected because ProfilePage is the "command center". Scrolling keeps context; external navigation (if needed) is a second click.

## Success Criteria

- [ ] Progress bar accurately reflects completion count
- [ ] Status label matches threshold (verify at 3→4, 6→7, 9→10 boundaries)
- [ ] Popover opens/closes correctly
- [ ] All 11 sections display with correct icons
- [ ] CTA scrolls to first incomplete section
- [ ] Tests cover all completion levels (0, 3, 4, 6, 7, 9, 10, 11)
