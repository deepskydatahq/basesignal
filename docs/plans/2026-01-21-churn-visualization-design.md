# Churn/Loss Visualization Design

## Overview
Restructure JourneyDiagram to display churn as a visually distinct terminal state below the main flow, communicating that users can churn from any lifecycle stage.

## Problem Statement
The current JourneyDiagram shows churn inline with other stages, making it appear as sequential progression rather than a terminal state reachable from any point. Product leaders need to see that churn economics differ by stage (activation retention vs revenue retention).

## Expert Perspectives

### Product
The accurate mental model matters more than simplicity for financially-literate users. They already understand churn can happen at any lifecycle stage. Showing churn as a terminal state below the main flow makes their existing mental model explicit, reducing cognitive load. The magic moment: "I need to optimize activation retention differently than Revenue retention."

### Technical
Keep the component lightweight - no React Flow migration needed. The real question isn't "SVG vs React Flow" but whether we need converging edges at all. Churn semantically isn't a downstream stage in a linear flow - it's a terminal state.

### Simplification Review
**Removed:**
- SVG overlay layer with curved paths (over-engineering)
- Bezier curve calculations and fixed pixel assumptions
- Multiple overlapping visual signals (red + dashed + opacity combinations)

**Simplified:**
- Use pure layout (two flex rows) instead of SVG paths to communicate the mental model
- Single visual treatment for churn (red-tinted styling only)
- No coordinate calculations needed

## Proposed Solution
Move churn to a second row below the main lifecycle stages with distinct red-tinted styling. The spatial separation alone communicates that churn is a terminal state reachable from any stage, without needing explicit connecting lines.

```
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│ Account │      │         │      │  Core   │      │         │
│Creation │ ───▶ │Activate │ ───▶ │  Usage  │ ───▶ │ Revenue │
└─────────┘      └─────────┘      └─────────┘      └─────────┘

                       ┌─────────┐
                       │  Churn  │  ← red-tinted, centered below
                       └─────────┘
```

## Design Details

### Layout Changes
1. **Filter churn from main loop**: Exclude "churn" from horizontal stage rendering
2. **Two-row structure**:
   - Top row: 4 main stages with forward arrows (existing)
   - Bottom row: Churn box centered with margin-top gap
3. **No SVG overlay**: Layout alone communicates the mental model

### Churn Styling
Single consistent visual treatment:
- `border-red-300` - red-tinted border
- `bg-red-50` - subtle red background
- `text-red-700` - red text for the label
- Keep dashed border if slot is empty (consistent with other empty slots)

### Implementation Steps
1. Modify `JourneyDiagram.tsx` to separate churn rendering
2. Add flex column wrapper with two rows
3. Apply churn-specific color styles
4. Update tests to verify new layout structure

## Alternatives Considered

### SVG Paths from Each Stage to Churn
Rejected. Over-engineering - adds visual complexity and implementation burden without meaningfully improving mental model clarity. The layout change alone achieves the goal.

### React Flow Migration
Rejected. Too heavy for this read-only presentational component. React Flow is appropriate for the interactive JourneyCanvas editor, not the profile overview.

### Churn Beside Revenue (Single Edge)
Rejected. Misrepresents the mental model - churn can happen from any stage, not just post-Revenue.

## Success Criteria
- Churn renders in a separate row below the main flow
- Churn has distinct red-tinted styling
- Visual hierarchy clearly communicates churn as terminal state
- No performance regression (no heavy SVG calculations)
- Existing tests pass with minimal updates
