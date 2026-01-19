import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MetricCatalogSection } from "./MetricCatalogSection";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

interface Metric {
  _id: string;
  name: string;
  category: string;
}

function setup(metrics: Metric[] = []) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <MetricCatalogSection metrics={metrics} />
    </MemoryRouter>
  );
  return { user };
}

beforeEach(() => {
  mockNavigate.mockReset();
});

test("renders empty state when no metrics provided", () => {
  setup([]);

  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
  expect(screen.getByText("0 metrics")).toBeInTheDocument();
  expect(
    screen.getByText("Your product's vital signs, waiting to be measured.")
  ).toBeInTheDocument();
  expect(
    screen.getByText("Discover which numbers actually matter for your business.")
  ).toBeInTheDocument();
});

test("renders metric count in status label when metrics exist", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Daily Active Users", category: "engagement" },
    { _id: "3", name: "Activation Rate", category: "value_delivery" },
  ]);

  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
  expect(screen.getByText("3 metrics")).toBeInTheDocument();
});

test("shows complete status when metrics exist", () => {
  setup([{ _id: "1", name: "New Users", category: "reach" }]);

  // The status badge should indicate complete (green styling)
  const statusBadge = screen.getByText("1 metrics").closest("div");
  expect(statusBadge).toHaveClass("text-green-700");
});

test("shows not_started status when no metrics exist", () => {
  setup([]);

  // The status badge should indicate not_started (gray styling)
  const statusBadge = screen.getByText("0 metrics").closest("div");
  expect(statusBadge).toHaveClass("text-gray-500");
});

test("groups metrics by category with category headers", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Trial Starts", category: "reach" },
    { _id: "3", name: "Daily Active Users", category: "engagement" },
    { _id: "4", name: "Activation Rate", category: "value_delivery" },
  ]);

  // Category headers should be visible
  expect(screen.getByText("Reach")).toBeInTheDocument();
  expect(screen.getByText("Engagement")).toBeInTheDocument();
  expect(screen.getByText("Value Delivery")).toBeInTheDocument();

  // Metrics should be listed
  expect(screen.getByText("New Users")).toBeInTheDocument();
  expect(screen.getByText("Trial Starts")).toBeInTheDocument();
  expect(screen.getByText("Daily Active Users")).toBeInTheDocument();
  expect(screen.getByText("Activation Rate")).toBeInTheDocument();
});

test("hides categories that have no metrics", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Activation Rate", category: "value_delivery" },
  ]);

  // Only populated categories should appear
  expect(screen.getByText("Reach")).toBeInTheDocument();
  expect(screen.getByText("Value Delivery")).toBeInTheDocument();

  // Empty categories should not appear
  expect(screen.queryByText("Engagement")).not.toBeInTheDocument();
  expect(screen.queryByText("Value Capture")).not.toBeInTheDocument();
});

test("navigates to /metric-catalog when View Full Catalog is clicked", async () => {
  const { user } = setup([
    { _id: "1", name: "New Users", category: "reach" },
  ]);

  await user.click(screen.getByRole("button", { name: "View Full Catalog" }));

  expect(mockNavigate).toHaveBeenCalledWith("/metric-catalog");
});

test("renders distribution bar with category segments", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Trial Starts", category: "reach" },
    { _id: "3", name: "Daily Active Users", category: "engagement" },
    { _id: "4", name: "Activation Rate", category: "value_delivery" },
  ]);

  // Distribution bar should exist
  const distributionBar = screen.getByTestId("metric-distribution-bar");
  expect(distributionBar).toBeInTheDocument();

  // Should have segments for each populated category
  expect(screen.getByTestId("segment-reach")).toBeInTheDocument();
  expect(screen.getByTestId("segment-engagement")).toBeInTheDocument();
  expect(screen.getByTestId("segment-value_delivery")).toBeInTheDocument();
});
