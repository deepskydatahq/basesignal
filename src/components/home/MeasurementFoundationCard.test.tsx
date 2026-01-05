import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeasurementFoundationCard } from "./MeasurementFoundationCard";
import { MemoryRouter } from "react-router-dom";
import type { Id } from "../../../convex/_generated/dataModel";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  mockNavigate.mockClear();
});

type FoundationStatus = Parameters<typeof MeasurementFoundationCard>[0]["status"];

function setup(status: Partial<FoundationStatus> = {}) {
  const user = userEvent.setup();
  const defaultStatus: FoundationStatus = {
    overviewInterview: { status: "not_started", journeyId: null, slotsCompleted: 0, slotsTotal: 5 },
    firstValue: { status: "not_defined", journeyId: null },
    measurementPlan: { status: "locked" },
    metricCatalog: { status: "locked" },
    ...status,
  };
  render(
    <MemoryRouter>
      <MeasurementFoundationCard status={defaultStatus} />
    </MemoryRouter>
  );
  return { user };
}

test("renders header with Measurement Foundation title", () => {
  setup();

  expect(screen.getByText("Measurement Foundation")).toBeInTheDocument();
});

test("renders all four stage cards", () => {
  setup();

  expect(screen.getByText("Overview Interview")).toBeInTheDocument();
  expect(screen.getByText("First Value")).toBeInTheDocument();
  expect(screen.getByText("Measurement Plan")).toBeInTheDocument();
  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
});

test("shows Start button for not_started overview", () => {
  setup({
    overviewInterview: { status: "not_started", journeyId: null, slotsCompleted: 0, slotsTotal: 5 },
  });

  const startButtons = screen.getAllByRole("button", { name: /start/i });
  expect(startButtons.length).toBeGreaterThanOrEqual(1);
});

test("shows progress text for in_progress overview", () => {
  setup({
    overviewInterview: { status: "in_progress", journeyId: null, slotsCompleted: 2, slotsTotal: 5 },
  });

  expect(screen.getByText("2 of 5 lifecycle slots")).toBeInTheDocument();
});

test("navigates to setup interview when clicking Start on overview", async () => {
  const { user } = setup({
    overviewInterview: { status: "not_started", journeyId: null, slotsCompleted: 0, slotsTotal: 5 },
  });

  // Overview Interview is the first card with a Start button
  const startButtons = screen.getAllByRole("button", { name: /start/i });
  await user.click(startButtons[0]);
  expect(mockNavigate).toHaveBeenCalledWith("/setup/interview");
});

test("navigates to journey when clicking View on complete overview", async () => {
  const { user } = setup({
    overviewInterview: { status: "complete", journeyId: "journey123" as Id<"journeys">, slotsCompleted: 5, slotsTotal: 5 },
  });

  const viewButton = screen.getByRole("button", { name: /view/i });
  await user.click(viewButton);

  expect(mockNavigate).toHaveBeenCalledWith("/journeys/journey123");
});

test("shows Coming soon for locked stages", () => {
  setup();

  const comingSoonTexts = screen.getAllByText(/coming soon/i);
  expect(comingSoonTexts).toHaveLength(2); // Measurement Plan + Metric Catalog
});
