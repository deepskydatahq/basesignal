# MeasurementPlanSection Preview Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance entity cards with per-entity activity and property counts, removing the redundant aggregate summary.

**Architecture:** Extend PlanEntityCard to accept activityCount and propertyCount props, display them as a meta-line below the activity list. Remove the section-level aggregate summary paragraph since per-card counts make it redundant.

**Tech Stack:** React, Vitest, React Testing Library

---

## Task 1: Add test for per-entity activity count display

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Write the failing test**

Add this test after the existing tests:

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

  expect(screen.getByText("2 activities · 0 properties")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run MeasurementPlanSection`
Expected: FAIL - "2 activities · 0 properties" not found

**Step 3: Commit the failing test**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add test for per-entity activity count display"
```

---

## Task 2: Add test for per-entity property count display

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Write the failing test**

Add this test:

```typescript
test("displays property count in each entity card", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [
        { _id: "act1" as Id<"measurementActivities">, name: "Signed Up" },
      ],
      properties: [
        { _id: "prop1" as Id<"measurementProperties">, name: "Email" },
        { _id: "prop2" as Id<"measurementProperties">, name: "Plan" },
        { _id: "prop3" as Id<"measurementProperties">, name: "Country" },
      ],
    },
  ]);

  expect(screen.getByText("1 activity · 3 properties")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run MeasurementPlanSection`
Expected: FAIL - "1 activity · 3 properties" not found

**Step 3: Commit the failing test**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add test for per-entity property count display"
```

---

## Task 3: Implement per-entity meta-line in PlanEntityCard

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.tsx:15-39` (PlanEntityCard)

**Step 1: Update PlanEntityCard to accept and display counts**

Replace the PlanEntityCard function:

```typescript
function PlanEntityCard({
  name,
  activities,
  activityCount,
  propertyCount,
}: {
  name: string;
  activities: string[];
  activityCount: number;
  propertyCount: number;
}) {
  const activityText = activityCount === 1 ? "activity" : "activities";
  const propertyText = propertyCount === 1 ? "property" : "properties";

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 className="font-medium text-gray-900 mb-2">{name}</h4>
      {activities.length > 0 ? (
        <ul className="space-y-1">
          {activities.map((activity, i) => (
            <li key={i} className="text-sm text-gray-600 flex items-start">
              <span className="mr-2">•</span>
              <span>{activity}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 italic">No activities</p>
      )}
      <p className="text-sm text-slate-500 mt-3">
        {activityCount} {activityText} · {propertyCount} {propertyText}
      </p>
    </div>
  );
}
```

**Step 2: Update PlanEntityCard usage to pass counts**

Replace lines 70-75 (the map call):

```typescript
{plan.map(({ entity, activities, properties }) => (
  <PlanEntityCard
    key={entity._id}
    name={entity.name}
    activities={activities.map((a) => a.name)}
    activityCount={activities.length}
    propertyCount={properties.length}
  />
))}
```

**Step 3: Run tests to verify they pass**

Run: `npm test -- --run MeasurementPlanSection`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.tsx
git commit -m "feat: add per-entity activity and property counts to entity cards"
```

---

## Task 4: Add test verifying aggregate summary is removed

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Write the test**

Add this test:

```typescript
test("does not display aggregate summary at section level", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [
        { _id: "act1" as Id<"measurementActivities">, name: "Signed Up" },
        { _id: "act2" as Id<"measurementActivities">, name: "Logged In" },
      ],
      properties: [
        { _id: "prop1" as Id<"measurementProperties">, name: "Email" },
      ],
    },
    {
      entity: { _id: "entity2" as Id<"measurementEntities">, name: "Account" },
      activities: [
        { _id: "act3" as Id<"measurementActivities">, name: "Created" },
      ],
      properties: [
        { _id: "prop2" as Id<"measurementProperties">, name: "Plan" },
        { _id: "prop3" as Id<"measurementProperties">, name: "Status" },
      ],
    },
  ]);

  // Aggregate would show "3 activities · 3 properties" at section level
  // But per-entity lines show "2 activities · 1 property" and "1 activity · 2 properties"
  // Verify the aggregate is NOT present (we only have per-entity counts)
  const allText = document.body.textContent || "";

  // Per-entity counts should exist
  expect(screen.getByText("2 activities · 1 property")).toBeInTheDocument();
  expect(screen.getByText("1 activity · 2 properties")).toBeInTheDocument();

  // Aggregate count should NOT exist as a standalone element
  // The text "3 activities" should not appear (aggregate would be "3 activities · 3 properties")
  expect(screen.queryByText("3 activities · 3 properties")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run MeasurementPlanSection`
Expected: FAIL - the aggregate summary still exists

**Step 3: Commit the failing test**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: verify aggregate summary is not displayed"
```

---

## Task 5: Remove aggregate summary from MeasurementPlanSection

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.tsx:46-68`

**Step 1: Remove unused aggregate calculations and summary paragraph**

Remove lines 47-48 (activityCount and propertyCount calculations at section level):
```typescript
const activityCount = plan.reduce((sum, e) => sum + e.activities.length, 0);
const propertyCount = plan.reduce((sum, e) => sum + e.properties.length, 0);
```

Remove the aggregate summary paragraph (lines 65-68):
```typescript
<p className="text-sm text-gray-600 mb-4">
  {activityCount} {activityCount === 1 ? "activity" : "activities"} ·{" "}
  {propertyCount} {propertyCount === 1 ? "property" : "properties"}
</p>
```

The children of ProfileSection when hasEntities should become:
```typescript
{hasEntities ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {plan.map(({ entity, activities, properties }) => (
      <PlanEntityCard
        key={entity._id}
        name={entity.name}
        activities={activities.map((a) => a.name)}
        activityCount={activities.length}
        propertyCount={properties.length}
      />
    ))}
  </div>
) : (
  <p className="text-sm text-gray-500">
    No measurement plan yet. Complete the Overview Interview to generate
    your first entities and activities.
  </p>
)}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- --run MeasurementPlanSection`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.tsx
git commit -m "refactor: remove redundant aggregate summary from MeasurementPlanSection"
```

---

## Task 6: Run full test suite and verify build

**Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests PASS

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Final commit if any cleanup needed**

If tests or build revealed issues, fix and commit. Otherwise, no action needed.

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add test for per-entity activity count |
| 2 | Add test for per-entity property count |
| 3 | Implement per-entity meta-line in PlanEntityCard |
| 4 | Add test verifying aggregate summary removed |
| 5 | Remove aggregate summary from section |
| 6 | Run full test suite and verify build |

Total: 6 tasks following TDD approach
