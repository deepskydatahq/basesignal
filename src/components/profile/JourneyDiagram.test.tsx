// src/components/profile/JourneyDiagram.test.tsx

import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { JourneyDiagram } from "./JourneyDiagram";
import type { LifecycleSlot } from "../../shared/lifecycleSlots";

interface Stage {
  _id: string;
  name: string;
  lifecycleSlot: LifecycleSlot;
  entity?: string;
  action?: string;
}

function setup(stages: Stage[] = []) {
  render(<JourneyDiagram stages={stages} />);
}

test("renders all 5 lifecycle slots as empty placeholders when no stages", () => {
  setup([]);

  expect(screen.getByText("Account Creation")).toBeInTheDocument();
  expect(screen.getByText("Activation")).toBeInTheDocument();
  expect(screen.getByText("Core Usage")).toBeInTheDocument();
  expect(screen.getByText("Revenue")).toBeInTheDocument();
  expect(screen.getByText("Churn")).toBeInTheDocument();
});

test("renders filled slot with stage name", () => {
  setup([
    { _id: "s1", name: "Account Created", lifecycleSlot: "account_creation" },
  ]);

  expect(screen.getByText("Account Creation")).toBeInTheDocument();
  expect(screen.getByText("Account Created")).toBeInTheDocument();
});

test("renders mix of filled and empty slots", () => {
  setup([
    { _id: "s1", name: "Account Created", lifecycleSlot: "account_creation" },
    { _id: "s2", name: "Project Published", lifecycleSlot: "activation" },
  ]);

  // Filled slots show stage name
  expect(screen.getByText("Account Created")).toBeInTheDocument();
  expect(screen.getByText("Project Published")).toBeInTheDocument();

  // All slot labels present
  expect(screen.getByText("Account Creation")).toBeInTheDocument();
  expect(screen.getByText("Activation")).toBeInTheDocument();
  expect(screen.getByText("Core Usage")).toBeInTheDocument();
  expect(screen.getByText("Revenue")).toBeInTheDocument();
  expect(screen.getByText("Churn")).toBeInTheDocument();
});

test("renders slots in LIFECYCLE_SLOTS order", () => {
  setup([
    { _id: "s1", name: "Churned", lifecycleSlot: "churn" },
    { _id: "s2", name: "Account Created", lifecycleSlot: "account_creation" },
  ]);

  const container = screen.getByTestId("journey-diagram");
  const slots = container.querySelectorAll("[data-slot]");

  // Should be in canonical order regardless of input order
  expect(slots[0]).toHaveAttribute("data-slot", "account_creation");
  expect(slots[4]).toHaveAttribute("data-slot", "churn");
});

test("uses first stage when multiple stages have same slot", () => {
  setup([
    { _id: "s1", name: "First Activity", lifecycleSlot: "account_creation" },
    { _id: "s2", name: "Second Activity", lifecycleSlot: "account_creation" },
  ]);

  expect(screen.getByText("First Activity")).toBeInTheDocument();
  expect(screen.queryByText("Second Activity")).not.toBeInTheDocument();
});

test("renders complete status when stage has both entity and action", () => {
  setup([
    {
      _id: "s1",
      name: "Account Created",
      lifecycleSlot: "account_creation",
      entity: "Account",
      action: "Created",
    },
  ]);

  const slot = screen.getByTestId("journey-diagram").querySelector('[data-slot="account_creation"]');
  const box = slot?.querySelector("div > div");

  // Complete: solid blue border, blue-50 background
  expect(box).toHaveClass("border-solid", "border-blue-500", "bg-blue-50");
});

test("renders partial status when stage has entity but no action", () => {
  setup([
    {
      _id: "s1",
      name: "Account Created",
      lifecycleSlot: "account_creation",
      entity: "Account",
    },
  ]);

  const slot = screen.getByTestId("journey-diagram").querySelector('[data-slot="account_creation"]');
  const box = slot?.querySelector("div > div");

  // Partial: solid amber border, amber-50 background
  expect(box).toHaveClass("border-solid", "border-amber-500", "bg-amber-50");
});

test("renders partial status when stage has action but no entity", () => {
  setup([
    {
      _id: "s1",
      name: "Account Created",
      lifecycleSlot: "account_creation",
      action: "Created",
    },
  ]);

  const slot = screen.getByTestId("journey-diagram").querySelector('[data-slot="account_creation"]');
  const box = slot?.querySelector("div > div");

  // Partial: solid amber border, amber-50 background
  expect(box).toHaveClass("border-solid", "border-amber-500", "bg-amber-50");
});

test("renders partial status when stage has neither entity nor action", () => {
  setup([
    {
      _id: "s1",
      name: "Account Created",
      lifecycleSlot: "account_creation",
    },
  ]);

  const slot = screen.getByTestId("journey-diagram").querySelector('[data-slot="account_creation"]');
  const box = slot?.querySelector("div > div");

  // Partial: solid amber border, amber-50 background (stage exists but incomplete)
  expect(box).toHaveClass("border-solid", "border-amber-500", "bg-amber-50");
});
