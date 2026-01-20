# Metric Source Event Reference Design

## Overview

Add source event traceability to metric display components. Users see which measurement plan activity powers each metric, with clickable navigation to the Measurement Plan page.

## Problem Statement

Metrics are generated from measurement plan activities, but users can't see this connection. When reviewing metrics, they have no way to verify which event a metric measures or navigate to its source.

## Expert Perspectives

### Product
- **Job to be done**: Users want to verify a metric is measuring the right thing before trusting it in a decision
- **Magic moment**: "I clicked and instantly saw exactly what I needed without losing context"
- **Highlight approach**: Scroll into view with subtle visual indicator - no modal, no URL params, keep it fast and ephemeral

### Technical
- **Reference measurementActivities directly**: The measurement plan is the system of record, not the journey stages
- **Temporary bridge pattern**: Use a client-side lookup helper that matches stage names to measurement activities. Delete when schema refactor ships
- **Client-side lookup**: A simple `.find()` loop in the component is explicit and local - no new backend queries for temporary code

### Simplification Review
- **Removed**: Separate helper file - inline the 5-line lookup in MetricCatalogPage
- **Simplified**: Highlight animation - just scrollIntoView, no 2-second fade
- **Kept**: Optional props pattern - components legitimately need source name independently

## Proposed Solution

Add source event display to MetricCard and MetricDetailPanel. Use a client-side lookup to resolve the source activity name from the current schema. Navigate to Measurement Plan with scroll-into-view on click.

## Design Details

### Data Flow

1. `MetricCatalogPage` fetches metrics (with `relatedActivityId` → stages)
2. `MetricCatalogPage` fetches `stages` and `measurementActivities`
3. Inline lookup: find stage by ID → get name → find matching activity
4. Pass resolved `sourceEventName` to child components

### UI Changes

**MetricCard**
- Add optional `sourceEventName?: string` prop
- Render small gray text "Source: {name}" below definition when provided
- Style: `text-xs text-gray-500 mt-1`

**MetricDetailPanel**
- Add optional `sourceEventName?: string` and `onSourceEventClick?: () => void` props
- Add "Source Event" section after "How to Improve" when source available
- Clickable activity name styled as link

### Navigation

1. Click source event in MetricDetailPanel
2. Navigate to `/setup/measurement` with route state `{ highlightActivity: activityName }`
3. MeasurementPlanPage reads `location.state?.highlightActivity`
4. On mount: find activity row, call `scrollIntoView({ behavior: 'smooth', block: 'center' })`
5. Apply brief highlight class (CSS handles visual)

### Files Modified

- `src/components/metrics/MetricCard.tsx` - add sourceEventName prop + display
- `src/components/metrics/MetricDetailPanel.tsx` - add Source Event section
- `src/routes/MetricCatalogPage.tsx` - add lookup logic, pass props, navigation handler
- `src/routes/MeasurementPlanPage.tsx` - add highlight-on-nav behavior

### No New Files

The lookup helper is ~5 lines and inlined in MetricCatalogPage.

## Alternatives Considered

1. **Wait for schema refactor**: Rejected - blocks useful feature for indefinite time
2. **Server-side join query**: Rejected - adds API surface for temporary code
3. **URL params for highlight**: Rejected - maintenance debt without user benefit
4. **Full highlight animation**: Rejected - scrollIntoView is sufficient

## Success Criteria

- [ ] MetricCard shows "Source: {Event Name}" when available
- [ ] MetricDetailPanel shows clickable source event section
- [ ] Click navigates to Measurement Plan with activity scrolled into view
- [ ] Metrics without source gracefully omit the display
