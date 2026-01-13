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
