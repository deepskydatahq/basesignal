import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfilePage } from "./ProfilePage";
import { MemoryRouter } from "react-router-dom";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

function setup(queryResult: unknown) {
  mockUseQuery.mockReturnValue(queryResult);
  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );
}

test("shows loading state when data is undefined", () => {
  setup(undefined);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

test("redirects to sign-in when data is null", () => {
  setup(null);

  const navigate = screen.getByTestId("navigate");
  expect(navigate).toHaveAttribute("data-to", "/sign-in");
});

test("renders product name from profile data", () => {
  setup({
    identity: {
      productName: "My Awesome Product",
      websiteUrl: "https://example.com",
    },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [],
      completed: 2,
      total: 11,
      percentage: 18,
    },
  });

  expect(screen.getByText("My Awesome Product")).toBeInTheDocument();
});

test("shows default product name when not set", () => {
  setup({
    identity: {
      productName: undefined,
    },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [],
      completed: 0,
      total: 11,
      percentage: 0,
    },
  });

  expect(screen.getByText("Your Product")).toBeInTheDocument();
});

test("displays completeness indicator", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [],
      completed: 4,
      total: 11,
      percentage: 36,
    },
  });

  expect(screen.getByText("4/11")).toBeInTheDocument();
});

test("renders section placeholders", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [],
      completed: 0,
      total: 11,
      percentage: 0,
    },
  });

  expect(screen.getByText("Core Identity Section")).toBeInTheDocument();
  expect(screen.getByText("Journey Map Section")).toBeInTheDocument();
  expect(screen.getByText("First Value Section")).toBeInTheDocument();
  expect(screen.getByText("Metric Catalog Section")).toBeInTheDocument();
  expect(screen.getByText("Measurement Plan Section")).toBeInTheDocument();
});
