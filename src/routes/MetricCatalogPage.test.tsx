import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MetricCatalogPage from "./MetricCatalogPage";

// Mock useQuery to return empty metrics
vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: () => [],
  };
});

test("renders Metric Catalog heading", () => {
  render(<MetricCatalogPage />);

  expect(screen.getByRole("heading", { name: /metric catalog/i })).toBeInTheDocument();
});

test("shows empty state message when no metrics", () => {
  render(<MetricCatalogPage />);

  expect(screen.getByText(/no metrics yet/i)).toBeInTheDocument();
});
