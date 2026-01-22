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

function setup(plan: PlanItem[] = [], primaryEntityId?: Id<"measurementEntities">) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <MeasurementPlanSection plan={plan} primaryEntityId={primaryEntityId} />
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

test("displays Primary badge for the primary entity", () => {
  const primaryEntityId = "entity1" as Id<"measurementEntities">;

  setup(
    [
      {
        entity: { _id: primaryEntityId, name: "Account" },
        activities: [],
        properties: [],
      },
      {
        entity: { _id: "entity2" as Id<"measurementEntities">, name: "User" },
        activities: [],
        properties: [],
      },
    ],
    primaryEntityId
  );

  expect(screen.getByText("Primary")).toBeInTheDocument();
  // Should only appear once
  expect(screen.getAllByText("Primary")).toHaveLength(1);
});

test("does not display Primary badge when no primary entity set", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "Account" },
      activities: [],
      properties: [],
    },
  ]);

  expect(screen.queryByText("Primary")).not.toBeInTheDocument();
});
