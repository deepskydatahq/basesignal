# Mini Entity-Relationship Diagram Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the grid-based entity list in MeasurementPlanSection into a horizontal mini-diagram showing entities as connected nodes.

**Architecture:** Replace the grid layout with a horizontal flexbox layout following the existing JourneyDiagram pattern. Entity nodes connected by simple SVG lines. Remove the PlanEntityCard component and render inline.

**Tech Stack:** React, Tailwind CSS, inline SVG

---

## Task 1: Update Tests for New Diagram Layout

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Write test for diagram container with test-id**

Add a new test that verifies the diagram container exists when entities are present:

```typescript
test("renders entity diagram when entities exist", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "Account" },
      activities: [
        { _id: "act1" as Id<"measurementActivities">, name: "Created" },
      ],
      properties: [],
    },
  ]);

  expect(screen.getByTestId("entity-diagram")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run MeasurementPlanSection`
Expected: FAIL - TestingLibraryElementError: Unable to find an element by: [data-testid="entity-diagram"]

**Step 3: Write test for entity names in diagram**

Add test verifying entity names are displayed:

```typescript
test("displays entity names in diagram nodes", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "Account" },
      activities: [],
      properties: [],
    },
    {
      entity: { _id: "entity2" as Id<"measurementEntities">, name: "User" },
      activities: [],
      properties: [],
    },
  ]);

  expect(screen.getByText("Account")).toBeInTheDocument();
  expect(screen.getByText("User")).toBeInTheDocument();
});
```

**Step 4: Write test for activity counts in diagram**

Add test verifying activity counts are shown with correct format:

```typescript
test("displays activity count in each entity node", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "Account" },
      activities: [
        { _id: "act1" as Id<"measurementActivities">, name: "Created" },
        { _id: "act2" as Id<"measurementActivities">, name: "Upgraded" },
        { _id: "act3" as Id<"measurementActivities">, name: "Churned" },
      ],
      properties: [],
    },
    {
      entity: { _id: "entity2" as Id<"measurementEntities">, name: "User" },
      activities: [
        { _id: "act4" as Id<"measurementActivities">, name: "Signed Up" },
      ],
      properties: [],
    },
  ]);

  expect(screen.getByText("3 activities")).toBeInTheDocument();
  expect(screen.getByText("1 activity")).toBeInTheDocument();
});
```

**Step 5: Write test for singular activity text**

This is already covered by the test above (1 activity vs 3 activities). No additional test needed.

**Step 6: Remove or update tests that rely on old card layout**

Update the existing test "displays activity count in each entity card" to match new format.

The old test checks for `"2 activities · 0 properties"` but the new diagram only shows activity count (no properties in the mini view).

Update the existing test at line 78-91:

```typescript
test("displays activity count in each entity card", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [
        { _id: "act1" as Id<"measurementActivities">, name: "Signed Up" },
        { _id: "act2" as Id<"measurementActivities">, name: "Logged In" },
      ],
      properties: [],
    },
  ]);

  expect(screen.getByText("2 activities")).toBeInTheDocument();
});
```

Update the test at line 93-109:

```typescript
test("displays singular activity text when one activity", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [
        { _id: "act1" as Id<"measurementActivities">, name: "Signed Up" },
      ],
      properties: [],
    },
  ]);

  expect(screen.getByText("1 activity")).toBeInTheDocument();
});
```

Remove the test "does not display aggregate summary at section level" (lines 111-141) - it tested the old property count display which is being removed from the mini view.

**Step 7: Run tests to verify failures**

Run: `npm test -- --run MeasurementPlanSection`
Expected: Multiple failures related to missing diagram elements and old assertion patterns

**Step 8: Commit test changes**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "$(cat <<'EOF'
test: update MeasurementPlanSection tests for diagram layout

- Add test for entity-diagram container
- Add test for entity names in diagram nodes
- Update activity count tests to match new format (no properties in mini view)
- Remove aggregate summary test (no longer applicable)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Implement Diagram Layout in MeasurementPlanSection

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.tsx`

**Step 1: Remove PlanEntityCard component**

Delete the entire `PlanEntityCard` function (lines 15-49).

**Step 2: Replace grid layout with diagram layout**

Replace the grid div (lines 70-81) with the new diagram layout:

```tsx
{hasEntities ? (
  <div
    data-testid="entity-diagram"
    className="flex items-center gap-2 overflow-x-auto py-2"
  >
    {plan.map(({ entity, activities }, index) => {
      const isLast = index === plan.length - 1;
      const activityText =
        activities.length === 1 ? "activity" : "activities";

      return (
        <div key={entity._id} className="flex items-center">
          {/* Entity node */}
          <div className="flex flex-col items-center justify-center w-28 h-16 rounded-lg border-2 border-gray-300 bg-gray-50 px-2">
            <span className="text-sm font-medium text-gray-900 text-center truncate w-full">
              {entity.name}
            </span>
            <span className="text-xs text-gray-500 mt-1">
              {activities.length} {activityText}
            </span>
          </div>

          {/* Connector line */}
          {!isLast && (
            <svg
              className="w-6 h-4 text-gray-300 mx-1"
              viewBox="0 0 24 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="0" y1="8" x2="24" y2="8" />
            </svg>
          )}
        </div>
      );
    })}
  </div>
) : (
  /* empty state unchanged */
)}
```

**Step 3: Run tests to verify they pass**

Run: `npm test -- --run MeasurementPlanSection`
Expected: All tests PASS

**Step 4: Commit implementation**

```bash
git add src/components/profile/MeasurementPlanSection.tsx
git commit -m "$(cat <<'EOF'
feat: transform entity grid into mini diagram in MeasurementPlanSection

Replace grid layout with horizontal flexbox diagram showing:
- Entity nodes with name and activity count
- Simple SVG line connectors between nodes
- Horizontal scroll for overflow

Follows JourneyDiagram pattern for visual consistency.

Closes #77

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Visual Verification and Edge Case Testing

**Files:**
- No file changes - manual verification

**Step 1: Run dev server**

Run: `npm run dev`

**Step 2: Visual verification checklist**

Navigate to the profile page and verify:
- [ ] Single entity displays correctly without connector
- [ ] Multiple entities show connectors between them
- [ ] Entity names truncate properly with ellipsis
- [ ] Activity count shows singular/plural correctly
- [ ] Horizontal scroll works when many entities present
- [ ] Empty state still displays correctly
- [ ] Visual consistency with JourneyDiagram section above

**Step 3: Test with edge cases**

If possible, test with:
- 1 entity (no connectors)
- 2-3 entities (normal case)
- 5+ entities (should scroll horizontally)
- Entity with long name (should truncate)
- Entity with 0 activities (should show "0 activities")

**Step 4: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass

---

## Task 4: Final Verification

**Step 1: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Final commit if any fixes needed**

Only commit if linter or build required fixes.

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Update tests for diagram layout | 4 test changes |
| 2 | Implement diagram layout | Component modification |
| 3 | Visual verification | Manual check |
| 4 | Final verification | Lint + build |

**Total estimated scope:** ~30 lines of test changes, ~40 lines of component changes
