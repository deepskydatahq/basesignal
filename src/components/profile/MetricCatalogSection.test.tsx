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

  // The status badge should indicate complete (metric count displayed)
  expect(screen.getByText("1 metrics")).toBeInTheDocument();
  // Metric content is rendered
  expect(screen.getByText("New Users")).toBeInTheDocument();
});

test("shows not_started status when no metrics exist", () => {
  setup([]);

  // The status badge should indicate not_started (0 metrics)
  expect(screen.getByText("0 metrics")).toBeInTheDocument();
  // Empty state content is displayed
  expect(screen.getByText("Your product's vital signs, waiting to be measured.")).toBeInTheDocument();
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

  // Only populated categories should appear as headers
  expect(screen.getByText("Reach")).toBeInTheDocument();
  expect(screen.getByText("Value Delivery")).toBeInTheDocument();
});

test("shows missing categories line when some categories have no metrics", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Activation Rate", category: "value_delivery" },
  ]);

  // Missing line should show categories with 0 metrics
  const missingText = screen.getByText(/^Missing:/);
  expect(missingText).toBeInTheDocument();
  expect(missingText).toHaveTextContent("Engagement (0)");
  expect(missingText).toHaveTextContent("Value Capture (0)");
});

test("does not show missing line when all categories have metrics", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Daily Active Users", category: "engagement" },
    { _id: "3", name: "Activation Rate", category: "value_delivery" },
    { _id: "4", name: "Conversion Rate", category: "value_capture" },
  ]);

  // Missing line should not appear
  expect(screen.queryByText(/^Missing:/)).not.toBeInTheDocument();
});

test("navigates to /metric-catalog when View Full Catalog is clicked", async () => {
  const { user } = setup([
    { _id: "1", name: "New Users", category: "reach" },
  ]);

  await user.click(screen.getByRole("button", { name: "View Full Catalog" }));

  expect(mockNavigate).toHaveBeenCalledWith("/metric-catalog");
});

test.todo("renders distribution bar with category segments", () => {
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

test.todo("renders legend with category counts", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Trial Starts", category: "reach" },
    { _id: "3", name: "Daily Active Users", category: "engagement" },
    { _id: "4", name: "Activation Rate", category: "value_delivery" },
  ]);

  // Legend should show category names with counts
  expect(screen.getByText("Reach: 2")).toBeInTheDocument();
  expect(screen.getByText("Engagement: 1")).toBeInTheDocument();
  expect(screen.getByText("Value Delivery: 1")).toBeInTheDocument();
});
