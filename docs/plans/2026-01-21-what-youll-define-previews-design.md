# "What you'll define" Previews Design

## Overview

Add "What you'll define:" preview lists to empty state cards, showing users a concrete picture of what completing each section will create. Uses ✦ bullets to convey aspiration.

## Problem Statement

Empty states have compelling hook text but don't preview what users will actually define. Adding preview lists reduces uncertainty and creates curiosity about the outcome.

## Expert Perspectives

### Product
- Time estimates only matter for commitment decisions (interviews), not inline editing
- The ✦ character is aspirational ("here's the shape of your future") vs checkmarks which signal completion
- Users in empty states need hope, not verification

### Technical
- Using checkmarks for both "completed" and "future-to-define" creates semantic confusion
- FirstValueSection uses inline editing (no time estimate needed)
- JourneyMapSection triggers interview (time estimate appropriate)
- Keep implementation simple - inline the markup rather than extracting a component

### Simplification Review
- Don't extract a PreviewList component - only 2 uses, inline is simpler
- Time estimates only on interview-based sections (JourneyMapSection)
- Keep preview items hardcoded in each section - simple and explicit

## Proposed Solution

Add "What you'll define:" preview lists to FirstValueSection and JourneyMapSection empty states. Use ✦ bullets for visual distinction from completion checkmarks.

## Design Details

### Structure

```
┌─────────────────────────────────────────────────────────┐
│ [Icon] Section Title                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Hook text (compelling question/statement)               │
│                                                         │
│ Insight text (educational context)                      │
│                                                         │
│ What you'll define:                                     │
│ ✦ Preview item 1                                        │
│ ✦ Preview item 2                                        │
│ ✦ Preview item 3                                        │
│                                                         │
│ [Button: CTA text]              ~X min (if interview)   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### FirstValueSection (inline editing, no time estimate)

```
What you'll define:
✦ Your product's key entities (users, accounts, workspaces)
✦ The moment a user becomes "activated"
✦ What makes a user "active" in your product
```

### JourneyMapSection (triggers interview, show time estimate)

```
What you'll define:
✦ How users discover your product
✦ Key actions in the trial experience
✦ Conversion and retention milestones

~5 min
```

### Styling

- **✦ color**: `text-primary-500` for brand alignment
- **Spacing**: `mt-0.5` on bullet aligns with first line of text
- **Typography**: `text-sm text-gray-600` for preview items (secondary to hook/insight)
- **Time estimate**: Right-aligned, `text-sm text-gray-500`

## Files to Modify

1. `src/features/product-profile/components/FirstValueSection.tsx` - Add preview list to empty state
2. `src/features/product-profile/components/JourneyMapSection.tsx` - Add preview list with time estimate

## Alternatives Considered

1. **Extract PreviewList component** - Rejected. Only 2 uses, inline markup is simpler and more explicit.
2. **Use Check icons like BriefingScreen** - Rejected. Check icons connote "completed" which creates semantic confusion for future/aspirational items.
3. **Add time estimates to all sections** - Rejected. Time estimates only matter for interview commitment decisions, not inline editing.

## Success Criteria

- Empty states show "What you'll define:" with ✦ bullets
- FirstValueSection and JourneyMapSection updated
- Time estimate appears only on JourneyMapSection
- Visual styling matches existing empty state patterns
