# MeasurementPlanSection Preview Enhancement Design

## Overview

Enhance entity cards in the MeasurementPlanSection preview with per-entity activity and property counts, removing the redundant top-level aggregate summary.

## Problem Statement

The current MeasurementPlanSection preview shows entities with activity lists but doesn't communicate the depth/value of what users have built. An aggregate summary at the top ("4 activities · 12 properties") doesn't help users understand individual entity completeness.

## Expert Perspectives

### Product

- **Completeness signals over depth indicators**: Show activity count + property count per entity. Let numbers speak simply without visual complexity (no rings/bars/categories).
- **Keep activity lists visible**: Users need to see actual activity names ("Signed Up", "Logged In") to understand scope at a glance. Don't replace with counts-only.
- **Remove aggregate redundancy**: Once per-entity counts exist, the top-level aggregate becomes noise. Keep only "N entities" status label.
- **Meta-line below for emotional reward**: Place counts below the activity list so users scan activities first (understanding), then see counts (affirmation/victory lap).

### Technical

- Properties are stored per-entity (not per-activity), so property count is simply `entity.properties.length`.
- Activity count is `entity.activities.length`.
- Implementation is trivial - no new components needed, just extend PlanEntityCard.

### Simplification Review

- **Removed**: Top-level aggregate summary line ("X activities · Y properties")
- **Kept minimal**: Single meta-line per card, muted styling, no visual embellishments
- **No over-engineering**: Simple computed values + display

## Proposed Solution

Add a meta-line to each entity card showing that entity's activity and property counts. Remove the section-level aggregate summary (redundant once per-card counts exist).

## Design Details

### Entity Card Structure

```
┌─────────────────────────────┐
│ 👤 User                     │  ← Entity name with icon
│                             │
│ • signed_up                 │  ← Activity list (existing)
│ • activated                 │
│ • subscribed                │
│                             │
│ 3 activities · 8 properties │  ← NEW: meta-line (muted text)
└─────────────────────────────┘
```

### Meta-line Styling

- Font: `text-sm text-slate-500` (muted, smaller than activity list)
- Separator: middle dot (·) between counts
- Position: Bottom of card, after activity list
- Padding: Small top margin to separate from list

### Count Display

- Singular/plural handling: "1 activity" vs "N activities", "1 property" vs "N properties"
- Activity count: `entity.activities.length`
- Property count: `entity.properties.length`

### Changes to MeasurementPlanSection

1. **Remove** aggregate summary line (currently shows "X activities · Y properties")
2. **Keep** "N entities" status label in ProfileSection header
3. **Enhance** PlanEntityCard to accept and display per-entity counts

## Alternatives Considered

1. **Keep aggregate summary + add per-card counts**: Rejected - creates redundancy and cognitive overhead
2. **Counts-only cards (no activity list)**: Rejected - loses the "what am I measuring" scannability magic
3. **Visual indicators (bars/rings)**: Rejected - adds complexity without proportional value

## Success Criteria

- Summary statistics are prominently displayed (via per-entity meta-lines)
- Entity cards communicate value (counts show measurement depth)
- Users feel rewarded for building out their measurement plan (meta-line as "victory lap")
- Preview balances information density with visual appeal (muted styling, not cluttered)
