// src/components/profile/JourneyMapSection.test.tsx

import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JourneyMapSection } from "./JourneyMapSection";
import { MemoryRouter } from "react-router-dom";
import type { Id } from "../../../convex/_generated/dataModel";

const mockUseQuery = vi.fn();
const mockNavigate = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  mockUseQuery.mockReset();
  mockNavigate.mockReset();
});

interface SetupOptions {
  journeyId?: Id<"journeys"> | null;
  stages?: Array<{
    _id: Id<"stages">;
    name: string;
    lifecycleSlot?: string;
  }>;
}

function setup(options: SetupOptions = {}) {
  const { journeyId = null, stages = [] } = options;
  const user = userEvent.setup();

  // Mock query returns stages
  mockUseQuery.mockReturnValue(stages);

  render(
    <MemoryRouter>
      <JourneyMapSection journeyId={journeyId} />
    </MemoryRouter>
  );

  return { user };
}

test("renders with not_started status when no journeyId", () => {
  setup({ journeyId: null });

  expect(screen.getByText("Journey Map")).toBeInTheDocument();
  expect(screen.getByText("Not Started")).toBeInTheDocument();
  // No Edit Journey button when no journey exists
  expect(
    screen.queryByRole("button", { name: /edit journey/i })
  ).not.toBeInTheDocument();
});

test("renders with not_started status when journeyId exists but no stages", () => {
  setup({ journeyId: "j1" as Id<"journeys">, stages: [] });

  expect(screen.getByText("Journey Map")).toBeInTheDocument();
  expect(screen.getByText("Not Started")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /edit journey/i })
  ).toBeInTheDocument();
});

test("renders discovery-oriented empty state copy when no stages", () => {
  setup({ journeyId: "j1" as Id<"journeys">, stages: [] });

  expect(
    screen.getByText("See where users thrive—and where they vanish.")
  ).toBeInTheDocument();
  expect(
    screen.getByText("Mapping your journey reveals the critical transitions where growth happens or stalls.")
  ).toBeInTheDocument();
});

test("renders with in_progress status when some required slots filled", () => {
  setup({
    journeyId: "j1" as Id<"journeys">,
    stages: [
      {
        _id: "s1" as Id<"stages">,
        name: "Account Created",
        lifecycleSlot: "account_creation",
      },
      {
        _id: "s2" as Id<"stages">,
        name: "Activated",
        lifecycleSlot: "activation",
      },
    ],
  });

  expect(screen.getByText("Journey Map")).toBeInTheDocument();
  expect(screen.getByText("In Progress")).toBeInTheDocument();
});

test("renders with complete status when all required slots filled", () => {
  setup({
    journeyId: "j1" as Id<"journeys">,
    stages: [
      {
        _id: "s1" as Id<"stages">,
        name: "Account Created",
        lifecycleSlot: "account_creation",
      },
      {
        _id: "s2" as Id<"stages">,
        name: "Activated",
        lifecycleSlot: "activation",
      },
      {
        _id: "s3" as Id<"stages">,
        name: "Using Daily",
        lifecycleSlot: "core_usage",
      },
    ],
  });

  expect(screen.getByText("Journey Map")).toBeInTheDocument();
  expect(screen.getByText("Complete")).toBeInTheDocument();
});

test("navigates to journey editor when Edit Journey clicked", async () => {
  const { user } = setup({
    journeyId: "test-journey-id" as Id<"journeys">,
    stages: [],
  });

  await user.click(screen.getByRole("button", { name: /edit journey/i }));

  expect(mockNavigate).toHaveBeenCalledWith("/journeys/test-journey-id");
});

test("renders JourneyDiagram with stages", () => {
  setup({
    journeyId: "j1" as Id<"journeys">,
    stages: [
      {
        _id: "s1" as Id<"stages">,
        name: "Account Created",
        lifecycleSlot: "account_creation",
      },
    ],
  });

  // JourneyDiagram should render the stage name
  expect(screen.getByText("Account Created")).toBeInTheDocument();
  // And all lifecycle slot labels
  expect(screen.getByText("Account Creation")).toBeInTheDocument();
  expect(screen.getByText("Activation")).toBeInTheDocument();
});
