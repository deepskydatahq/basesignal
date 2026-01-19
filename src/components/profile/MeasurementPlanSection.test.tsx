// src/components/profile/MeasurementPlanSection.test.tsx

import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MeasurementPlanSection } from "./MeasurementPlanSection";
import type { Id } from "../../../convex/_generated/dataModel";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

type PlanItem = {
  entity: { _id: Id<"measurementEntities">; name: string };
  activities: Array<{ _id: Id<"measurementActivities">; name: string }>;
  properties: Array<{ _id: Id<"measurementProperties">; name: string }>;
};

function setup(plan: PlanItem[] = []) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <MeasurementPlanSection plan={plan} />
    </MemoryRouter>
  );
  return { user };
}

beforeEach(() => {
  mockNavigate.mockReset();
});

test("renders empty state when no plan provided", () => {
  setup([]);

  expect(screen.getByText("Measurement Plan")).toBeInTheDocument();
  expect(screen.getByText("Not started")).toBeInTheDocument();
  expect(
    screen.getByText("The blueprint for understanding user behavior.")
  ).toBeInTheDocument();
  expect(
    screen.getByText("Entities and activities reveal what users do and how they move through your product.")
  ).toBeInTheDocument();
});

test("renders entity count in status label when plan has entities", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [
        { _id: "act1" as Id<"measurementActivities">, name: "Signed Up" },
      ],
      properties: [],
    },
    {
      entity: { _id: "entity2" as Id<"measurementEntities">, name: "Account" },
      activities: [],
      properties: [],
    },
    {
      entity: { _id: "entity3" as Id<"measurementEntities">, name: "Feature" },
      activities: [],
      properties: [],
    },
  ]);

  expect(screen.getByText("Measurement Plan")).toBeInTheDocument();
  expect(screen.getByText("3 entities")).toBeInTheDocument();
});

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

  // Per-entity counts should exist
  expect(screen.getByText("2 activities · 1 property")).toBeInTheDocument();
  expect(screen.getByText("1 activity · 2 properties")).toBeInTheDocument();

  // Aggregate count should NOT exist as a standalone element
  expect(screen.queryByText("3 activities · 3 properties")).not.toBeInTheDocument();
});
