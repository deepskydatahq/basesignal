import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProductsListPage from "./ProductsListPage";
import type { Id } from "../../convex/_generated/dataModel";

let mockProducts: unknown = undefined;

vi.mock("convex/react", () => ({
  useQuery: (queryName: unknown) => {
    if (queryName === "products:listWithProfiles") {
      return mockProducts;
    }
    return undefined;
  },
  useMutation: () => vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    products: {
      listWithProfiles: "products:listWithProfiles",
    },
  },
}));

function setup() {
  render(
    <MemoryRouter>
      <ProductsListPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockProducts = undefined;
});

test("renders loading state when data is undefined", () => {
  setup();
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

test("renders empty state when no products exist", () => {
  mockProducts = [];
  setup();
  expect(screen.getByText(/no products yet/i)).toBeInTheDocument();
});

test("renders product cards from query", () => {
  mockProducts = [
    {
      _id: "p1" as Id<"products">,
      name: "Acme App",
      url: "https://acme.com",
      profile: {
        completeness: 0.75,
        overallConfidence: 0.8,
        hasConvergence: false,
        hasOutputs: false,
      },
    },
    {
      _id: "p2" as Id<"products">,
      name: "Beta Tool",
      url: "https://beta.io",
      profile: null,
    },
  ];
  setup();

  expect(screen.getByText("Acme App")).toBeInTheDocument();
  expect(screen.getByText("Beta Tool")).toBeInTheDocument();
});

test("shows product name, URL, and completeness percentage", () => {
  mockProducts = [
    {
      _id: "p1" as Id<"products">,
      name: "Acme App",
      url: "https://acme.com",
      profile: {
        completeness: 0.75,
        overallConfidence: 0.8,
        hasConvergence: false,
        hasOutputs: false,
      },
    },
  ];
  setup();

  expect(screen.getByText("Acme App")).toBeInTheDocument();
  expect(screen.getByText("https://acme.com")).toBeInTheDocument();
  expect(screen.getByText("75%")).toBeInTheDocument();
});

test("shows 0% completeness when profile is null", () => {
  mockProducts = [
    {
      _id: "p1" as Id<"products">,
      name: "New Product",
      url: "https://new.com",
      profile: null,
    },
  ];
  setup();

  expect(screen.getByText("0%")).toBeInTheDocument();
});

test("shows badges when hasConvergence and hasOutputs are true", () => {
  mockProducts = [
    {
      _id: "p1" as Id<"products">,
      name: "Full Product",
      url: "https://full.com",
      profile: {
        completeness: 1.0,
        overallConfidence: 0.9,
        hasConvergence: true,
        hasOutputs: true,
      },
    },
  ];
  setup();

  expect(screen.getByText("Convergence")).toBeInTheDocument();
  expect(screen.getByText("Outputs")).toBeInTheDocument();
});

test("does not show badges when hasConvergence and hasOutputs are false", () => {
  mockProducts = [
    {
      _id: "p1" as Id<"products">,
      name: "Basic Product",
      url: "https://basic.com",
      profile: {
        completeness: 0.5,
        overallConfidence: 0.5,
        hasConvergence: false,
        hasOutputs: false,
      },
    },
  ];
  setup();

  expect(screen.queryByText("Convergence")).not.toBeInTheDocument();
  expect(screen.queryByText("Outputs")).not.toBeInTheDocument();
});

test("each card links to /products/:productId", () => {
  mockProducts = [
    {
      _id: "p1" as Id<"products">,
      name: "Acme App",
      url: "https://acme.com",
      profile: {
        completeness: 0.5,
        overallConfidence: 0.5,
        hasConvergence: false,
        hasOutputs: false,
      },
    },
  ];
  setup();

  const link = screen.getByRole("link");
  expect(link).toHaveAttribute("href", "/products/p1");
});
