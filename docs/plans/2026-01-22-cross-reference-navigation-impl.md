# Cross-Reference Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable bidirectional navigation between Metric Catalog and Measurement Plan sections.

**Architecture:** URL query parameters enable cross-page navigation. Each page reads its own params on mount and highlights/selects the relevant item.

**Tech Stack:** React Router (useSearchParams), Tailwind CSS (cn utility), existing component patterns

---

## Status: ALREADY IMPLEMENTED

After thorough codebase exploration, this feature is **already fully implemented**. The plan below documents the verification tasks to confirm all functionality works correctly.

---

## Current Implementation Summary

### Metric Catalog → Measurement Plan (Viewing Source Activity)

**Files:**
- `src/components/metrics/MetricDetailPanel.tsx:90-102` - Source Activity link
- `src/routes/MetricCatalogPage.tsx:66-78` - Lookup source activity name

**Flow:**
1. Metric has `sourceActivityId` linking to a `measurementActivities` record
2. `MetricCatalogPage` queries activities and looks up the name
3. `MetricDetailPanel` renders a "Source Activity" section with a Link to `/measurement-plan?highlight={activityName}`
4. User clicks → navigates to Measurement Plan with activity highlighted

### Measurement Plan → Metric Catalog (Viewing Derived Metrics)

**Files:**
- `src/routes/MeasurementPlanPage.tsx:277-283` - "View Metrics" link on activity rows
- `src/routes/MeasurementPlanPage.tsx:68-79` - getDerivedMetrics helper
- `src/components/measurement/ActivityDetailPanel.tsx:82-99` - Derived metrics list

**Flow:**
1. Activity row has "View Metrics" link to `/metric-catalog?activity={activityName}`
2. Clicking activity opens `ActivityDetailPanel` showing derived metrics
3. `MeasurementPlanPage` filters metrics by `sourceActivityId` matching the activity
4. `MetricCatalogPage` reads `?activity=` param and filters metrics grid

### URL Parameter Handling

**Measurement Plan (`?highlight=`):**
- `src/routes/MeasurementPlanPage.tsx:21-24` - Reads highlight from URL or location.state
- `src/routes/MeasurementPlanPage.tsx:215` - Auto-expands entity containing highlighted activity
- `src/routes/MeasurementPlanPage.tsx:244-246` - Applies ring-2 highlight styling

**Metric Catalog (`?activity=`):**
- `src/routes/MetricCatalogPage.tsx:65` - Reads activity filter from URL
- `src/routes/MetricCatalogPage.tsx:81-87` - Filters metrics by activity name
- `src/routes/MetricCatalogPage.tsx:152-168` - Filter indicator with clear button

---

## Task 1: Verify Metric to Activity Navigation

**Files:**
- Test: `src/components/metrics/MetricDetailPanel.test.tsx`
- Test: `src/routes/MetricCatalogPage.test.tsx`

**Step 1: Run existing tests**

Run: `npm test -- --run src/components/metrics/MetricDetailPanel.test.tsx`

Expected: All tests pass, including:
- "renders Source Activity link when sourceActivityName is provided"
- "does not render Source Activity section when sourceActivityName is not provided"

**Step 2: Run MetricCatalogPage integration tests**

Run: `npm test -- --run src/routes/MetricCatalogPage.test.tsx`

Expected: All tests pass, including:
- "shows source activity link in detail panel when metric has sourceActivityId"

---

## Task 2: Verify Activity to Metric Navigation

**Files:**
- Test: `src/routes/MeasurementPlanPage.test.tsx`
- Test: `src/components/measurement/ActivityDetailPanel.test.tsx`

**Step 1: Run MeasurementPlanPage tests**

Run: `npm test -- --run src/routes/MeasurementPlanPage.test.tsx`

Expected: All tests pass, including:
- "activity row has View Metrics link"
- "auto-expands entity card containing highlighted activity"
- "highlights activity when URL has highlight param"

**Step 2: Run ActivityDetailPanel tests**

Run: `npm test -- --run src/components/measurement/ActivityDetailPanel.test.tsx`

Expected: All tests pass, including:
- "renders derived metrics list"
- "calls onMetricClick when metric is clicked"

---

## Task 3: Verify Activity Filter in Metric Catalog

**Files:**
- Test: `src/routes/MetricCatalogPage.test.tsx`

**Step 1: Run filter-related tests**

Run: `npm test -- --run src/routes/MetricCatalogPage.test.tsx`

Expected: All tests pass, including:
- "filters metrics by activity when URL has activity param"
- "shows filter indicator and clear button when activity filter is active"
- "shows empty state when activity filter matches no metrics"

---

## Task 4: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test -- --run`

Expected: All tests pass

---

## Summary

This feature is **already implemented** with comprehensive test coverage:

| Flow | Implementation | Tests |
|------|---------------|-------|
| Metric → Activity | `MetricDetailPanel` Source Activity link | 2 tests |
| Activity → Metrics | "View Metrics" link + `ActivityDetailPanel` | 3+ tests |
| URL `?highlight=` | Auto-expand + highlight styling | 3 tests |
| URL `?activity=` | Filter metrics + indicator | 3 tests |

**No additional code changes required** - only verification that tests pass.
