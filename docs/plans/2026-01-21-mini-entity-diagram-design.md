# Mini Entity-Relationship Diagram Design

## Overview
Transform the entity grid in MeasurementPlanSection into a horizontal mini-diagram showing entities as connected nodes. A glanceable preview that communicates "measurement plan structure at a glance" without competing with the full measurement plan view.

## Problem Statement
The current grid layout of entity cards doesn't visually communicate how entities relate or form a cohesive measurement plan. Users need a quick visual summary showing their measurement entities exist together as part of a unified plan.

## Expert Perspectives

### Product
The magic moment isn't relationship labels—it's **confidence that the measurement plan is complete and connected**. Users need to understand their model structure to configure it correctly, not become data modelers. Starting simple (without relationship labels) respects their mental model and leaves room to add complexity later based on real user feedback.

### Technical
If relationships are shown, inference from activity patterns is the honest path—activities like "Interview Completed" under Account entity already encode relationships semantically. However, question whether explicit relationship labels are needed at all. No schema changes required; activity patterns provide an escape hatch to inference later.

### Simplification Review
The initial design was over-specified for a preview component. Removed:
- `EntityNode` sub-component abstraction (render inline instead)
- Hover/click expansion with tooltips (doesn't belong in mini preview)
- Responsive stacked layout fallback (unnecessary complexity)
- Activity list array prop (only need name + count for preview)
- Relationship labels (start simple, add based on user feedback)

## Proposed Solution
Replace the grid layout with a horizontal flexbox layout showing entity nodes connected by simple SVG lines. Each node displays entity name and activity count only. No interactivity beyond what exists today.

## Design Details

### Visual Structure
```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  Account   │─────│   User     │─────│  Project   │
│  3 acts    │     │  2 acts    │     │  1 act     │
└────────────┘     └────────────┘     └────────────┘
```

### Implementation Approach
Inline implementation in `MeasurementPlanSection.tsx` following the existing `JourneyDiagram` pattern:

```tsx
{hasEntities ? (
  <div className="flex items-center gap-2 overflow-x-auto py-2">
    {plan.map((entity, i) => (
      <div key={entity._id} className="flex items-center">
        <div className="flex flex-col items-center rounded-lg border border-gray-300 px-3 py-2">
          <span className="font-medium text-gray-900">{entity.name}</span>
          <span className="text-xs text-gray-500">{entity.activities.length} activities</span>
        </div>
        {i < plan.length - 1 && (
          <svg className="w-6 h-4 text-gray-300 mx-1" viewBox="0 0 24 16">
            <line x1="0" y1="8" x2="24" y2="8" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </div>
    ))}
  </div>
) : /* empty state unchanged */ }
```

### Key Decisions
1. **No new component files** - Inline implementation keeps it simple and follows existing patterns
2. **No relationship labels** - Start without "has many"/"belongs to" text; add later based on user feedback
3. **No hover/click interactivity** - Mini preview should be glanceable; detailed view is in full measurement plan
4. **Follow JourneyDiagram pattern** - Use same Tailwind styles and inline SVG approach for consistency
5. **Simple horizontal line connector** - No arrowheads initially (adds complexity, minimal value without labels)

### Scope
- Modify `MeasurementPlanSection.tsx` only
- No new component files
- No schema changes
- No new dependencies

## Alternatives Considered

1. **Full React Flow diagram** - Overkill for a preview; React Flow is used for the full Journey Editor, not appropriate for a mini section preview.

2. **Relationship labels ("has many", "belongs to")** - Rejected for v1. Would require either schema changes or activity name inference. Both add complexity without proven user need. Can be added later if users request it.

3. **Expandable activity lists on hover** - Rejected. Doesn't belong in a "mini" preview. Users who want activity details can view the full measurement plan.

4. **Separate EntityDiagram/EntityNode components** - Rejected. Over-abstraction for ~20 lines of JSX. Inline implementation is simpler and follows existing codebase patterns.

## Success Criteria
- Entities display horizontally with visual connectors
- Each entity shows name and activity count
- Layout scrolls horizontally if many entities (overflow-x-auto)
- Visually consistent with JourneyDiagram section styling
- Empty state behavior unchanged
