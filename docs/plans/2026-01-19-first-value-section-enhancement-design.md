# FirstValueSection Enhancement Design

## Overview
Enhance the FirstValueSection display to show activity name and timeframe more prominently, with clear confirmation status when defined. Follow CoreIdentitySection's established label:value pattern for consistency.

## Problem Statement
The current FirstValueSection shows activity name and timeframe in a minimal layout with inline text. Users should be able to quickly scan and understand their First Value Moment definition, with clear visual hierarchy that makes completion status instantly readable.

## Expert Perspectives

### Product
- Focus on clarity, not celebration - users are reviewing product performance, not celebrating themselves
- The "celebratory" feeling should come from the data (users reaching first value), not from design ornamentation
- Make completion instantly readable so users can quickly assess "Are we winning on this metric or not?"
- A colored card background or visual flourish is friction that slows users down

### Technical
- Follow existing patterns from CoreIdentitySection (label:value pairs with space-y-3)
- Use established color tokens (text-green-600 for success states)
- Keep implementation simple - no new abstractions or components needed

### Simplification Review
The Jobs-style review identified and removed:
- Clock icon from timeframe (doesn't add information)
- "Target timeframe:" label prefix (redundant with label:value pattern)
- Separate confirmation date span (collapsed to single line)
- Green pill badge background (checkmark + green text is sufficient)
- Complex flex wrapping (replaced with simple vertical stacking)
- h3 promotion for activity name (respects card hierarchy)

## Proposed Solution

Replace the current inline display with CoreIdentitySection's label:value pattern:

```tsx
<div className="space-y-3">
  {/* Activity - primary information */}
  <div>
    <span className="text-sm text-gray-500">Activity</span>
    <p className="text-gray-900 font-medium">{definition.activityName}</p>
  </div>

  {/* Timeframe */}
  <div>
    <span className="text-sm text-gray-500">Expected</span>
    <p className="text-gray-900">{definition.expectedTimeframe}</p>
  </div>

  {/* Confirmation status - only when confirmed */}
  {definition.confirmedAt && (
    <div>
      <span className="text-sm text-gray-500">Status</span>
      <p className="text-green-600 flex items-center gap-1">
        <Check className="w-4 h-4" />
        Confirmed {formatDate(definition.confirmedAt)}
      </p>
    </div>
  )}
</div>
```

## Design Details

### Visual Hierarchy

| Element | Style | Rationale |
|---------|-------|-----------|
| Labels | `text-sm text-gray-500` | Matches CoreIdentitySection |
| Activity value | `text-gray-900 font-medium` | Primary info, bold for prominence |
| Timeframe value | `text-gray-900` | Secondary info, normal weight |
| Confirmed status | `text-green-600` + Check icon | Clear success signal without being gaudy |

### Confirmation Display

Single line with green text and checkmark:
```tsx
<p className="text-green-600 flex items-center gap-1">
  <Check className="w-4 h-4" />
  Confirmed {formatDate(definition.confirmedAt)}
</p>
```

### Empty State (unchanged)
```tsx
<p className="text-gray-400 italic">
  Define the moment when users first experience value from your product.
</p>
```

## Alternatives Considered

1. **Prominent card with colored background** - Rejected as "celebration over clarity"
2. **Pills and badges for timeframe/status** - Rejected as visual noise without information gain
3. **Icons for each field** - Rejected; labels are sufficient
4. **Promoting activity name to h3** - Rejected; fights with ProfileSection h2 hierarchy

## Success Criteria

- [ ] Activity name displays with `font-medium` on its own labeled line
- [ ] Timeframe has its own label:value block (not inline text)
- [ ] Confirmation shows green checkmark + date when confirmed
- [ ] Layout matches CoreIdentitySection's space-y-3 pattern
- [ ] No new dependencies or components required
