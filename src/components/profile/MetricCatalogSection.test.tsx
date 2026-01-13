import { expect, test, vi } from "vitest";
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

test("renders empty state when no metrics provided", () => {
  setup([]);

  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
  expect(screen.getByText("0 metrics")).toBeInTheDocument();
  expect(
    screen.getByText(/No metrics in your catalog yet/)
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
