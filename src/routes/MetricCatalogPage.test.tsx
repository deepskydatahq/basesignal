import { expect, test, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MetricCatalogPage from "./MetricCatalogPage";

// Mock Convex
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn().mockReturnValue(vi.fn());
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => mockUseMutation(),
}));

// Mock the api import
vi.mock("../../convex/_generated/api", () => ({
  api: {
    metrics: {
      list: "metrics:list",
    },
    setupProgress: {
      foundationStatus: "setupProgress:foundationStatus",
    },
    metricCatalog: {
      generateFromOverview: "metricCatalog:generateFromOverview",
      generateFromFirstValue: "metricCatalog:generateFromFirstValue",
      deleteAll: "metricCatalog:deleteAll",
    },
  },
}));

const mockFoundationStatus = {
  overviewInterview: {
    status: "complete" as const,
    journeyId: "journey1",
    slotsCompleted: 5,
    slotsTotal: 5,
  },
  firstValue: {
    status: "defined" as const,
    journeyId: "journey1",
  },
  measurementPlan: {
    status: "available" as const,
    entitiesCount: 0,
  },
  metricCatalog: {
    status: "complete" as const,
    metricsCount: 2,
  },
};

const mockMetrics = [
  {
    _id: "metric1",
    name: "New Users",
    definition: "Count of new signups per period",
    formula: "Count(signups)",
    category: "reach",
    whyItMatters: "Shows acquisition health",
    howToImprove: "Improve marketing",
    order: 1,
  },
  {
    _id: "metric2",
    name: "DAU",
    definition: "Daily active users count",
    formula: "Count(active users per day)",
    category: "engagement",
    whyItMatters: "Core engagement metric",
    howToImprove: "Add sticky features",
    order: 2,
  },
];

function setup() {
  const user = userEvent.setup();
  render(<MetricCatalogPage />);
  return { user };
}

// Helper to setup mock for both queries
function setupMocks(metricsValue: unknown) {
  mockUseQuery.mockImplementation((query: string) => {
    if (query === "metrics:list") return metricsValue;
    if (query === "setupProgress:foundationStatus") return mockFoundationStatus;
    return undefined;
  });
}

beforeEach(() => {
  mockUseQuery.mockReset();
});

test("shows loading state while metrics are loading", () => {
  setupMocks(undefined);
  setup();

  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

test("shows empty state when no metrics exist", () => {
  setupMocks([]);
  setup();

  // With a completed journey, shows generate button
  expect(screen.getByText(/ready to generate your personalized metric catalog/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /generate metric catalog/i })).toBeInTheDocument();
});

test("renders page title and subtitle", () => {
  setupMocks(mockMetrics);
  setup();

  expect(screen.getByRole("heading", { name: "Metric Catalog" })).toBeInTheDocument();
  expect(screen.getByText(/your personalized metrics/i)).toBeInTheDocument();
});

test("renders metric cards in grid", () => {
  setupMocks(mockMetrics);
  setup();

  expect(screen.getByText("New Users")).toBeInTheDocument();
  expect(screen.getByText("DAU")).toBeInTheDocument();
});

test("opens detail panel when metric card is clicked", async () => {
  setupMocks(mockMetrics);
  const { user } = setup();

  await user.click(screen.getByText("New Users"));

  // Panel should now be visible
  const panel = screen.getByRole("complementary");
  expect(within(panel).getByText("New Users")).toBeInTheDocument();
  expect(within(panel).getByText("Shows acquisition health")).toBeInTheDocument();
});

test("closes detail panel when close button is clicked", async () => {
  setupMocks(mockMetrics);
  const { user } = setup();

  // Open panel
  await user.click(screen.getByText("New Users"));
  expect(screen.getByRole("complementary")).toBeInTheDocument();

  // Close panel
  await user.click(screen.getByRole("button", { name: /close/i }));
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});

test("switches selected metric when different card is clicked", async () => {
  setupMocks(mockMetrics);
  const { user } = setup();

  // Open first metric
  await user.click(screen.getByText("New Users"));
  expect(within(screen.getByRole("complementary")).getByText("New Users")).toBeInTheDocument();

  // Click second metric
  await user.click(screen.getByText("DAU"));
  expect(within(screen.getByRole("complementary")).getByText("DAU")).toBeInTheDocument();
});
