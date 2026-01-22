import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfilePage } from "./ProfilePage";
import { MemoryRouter } from "react-router-dom";

const mockUseQuery = vi.fn();

// Mock the generateProfilePdf function
vi.mock("../../lib/pdf/generateProfilePdf", () => ({
  generateProfilePdf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

beforeEach(() => {
  mockUseQuery.mockReset();
});

interface ProfileQueryResult {
  identity: { productName?: string; websiteUrl?: string };
  journeyMap: { stages: unknown[]; journeyId: string | null };
  firstValue: unknown;
  metricCatalog: { metrics: Record<string, unknown[]>; totalCount: number };
  measurementPlan: { entities: unknown[]; activityCount: number; propertyCount: number };
  completeness: {
    sections: Array<{ id: string; name: string; complete: boolean }>;
    completed: number;
    total: number;
    percentage: number;
  };
}

// Track which query is being called by position
let queryCallIndex = 0;

function setup(queryResult: ProfileQueryResult | undefined | null) {
  queryCallIndex = 0;

  // ProfilePage calls useQuery twice:
  // 1. api.profile.getProfileData
  // 2. api.measurementPlan.getFullPlan
  // Then child components may call more
  mockUseQuery.mockImplementation(() => {
    queryCallIndex++;

    // First call: profile.getProfileData
    if (queryCallIndex === 1) {
      return queryResult;
    }
    // Second call: measurementPlan.getFullPlan
    if (queryCallIndex === 2) {
      return [];
    }
    // Third call: stages.listByJourney (in JourneyMapSection)
    if (queryCallIndex === 3) {
      return [];
    }
    // Fourth call: firstValue.getCurrent (in FirstValueSection)
    if (queryCallIndex === 4) {
      return null;
    }
    return undefined;
  });
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

  // Product name appears in header (h1) and in CoreIdentitySection
  expect(screen.getByRole("heading", { level: 1, name: "My Awesome Product" })).toBeInTheDocument();
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

  // Use heading selector to get the main product name, not the hidden card template
  expect(screen.getByRole("heading", { level: 1, name: "Your Product" })).toBeInTheDocument();
});

test("displays stats bar with metrics, entities, and activities counts", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 5 },
    measurementPlan: { entities: [{}, {}, {}], activityCount: 12, propertyCount: 0 },
    completeness: {
      sections: [],
      completed: 4,
      total: 11,
      percentage: 36,
    },
  });

  expect(screen.getByText("5 Metrics · 3 Entities · 12 Activities")).toBeInTheDocument();
});

test("renders all profile sections", () => {
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

  // Verify all section headings are present
  expect(screen.getByRole("heading", { name: "Core Identity" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "High-level User Journey" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "First Value Moment / Activation" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Metric Catalog" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Measurement Plan" })).toBeInTheDocument();
});

test("shows journey_map suggestion when core_identity complete but journey_map incomplete", () => {
  setup({
    identity: { productName: "My Product" },
    completeness: {
      sections: [
        { id: "core_identity", name: "Core Identity", complete: true },
        { id: "journey_map", name: "Journey Map", complete: false },
        { id: "first_value", name: "First Value", complete: false },
        { id: "metric_catalog", name: "Metric Catalog", complete: false },
        { id: "measurement_plan", name: "Measurement Plan", complete: false },
      ],
      completed: 1,
      total: 5,
      percentage: 20,
    },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
  });

  expect(screen.getByText("Now let's map your user journey")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start Overview Interview" })).toBeInTheDocument();
});

test("shows metric_catalog suggestion when journey_map complete but metric_catalog incomplete", () => {
  setup({
    identity: { productName: "My Product" },
    completeness: {
      sections: [
        { id: "core_identity", name: "Core Identity", complete: true },
        { id: "journey_map", name: "Journey Map", complete: true },
        { id: "first_value", name: "First Value", complete: true },
        { id: "metric_catalog", name: "Metric Catalog", complete: false },
        { id: "measurement_plan", name: "Measurement Plan", complete: false },
      ],
      completed: 3,
      total: 5,
      percentage: 60,
    },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
  });

  expect(screen.getByText("Turn your first value moment into metrics")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate Metrics" })).toBeInTheDocument();
});

test("shows no suggestion when all navigable sections complete", () => {
  setup({
    identity: { productName: "My Product" },
    completeness: {
      sections: [
        { id: "core_identity", name: "Core Identity", complete: true },
        { id: "journey_map", name: "Journey Map", complete: true },
        { id: "first_value", name: "First Value", complete: true },
        { id: "metric_catalog", name: "Metric Catalog", complete: true },
        { id: "measurement_plan", name: "Measurement Plan", complete: true },
      ],
      completed: 5,
      total: 5,
      percentage: 100,
    },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
  });

  expect(screen.queryByText("Map your user journey")).not.toBeInTheDocument();
  expect(screen.queryByText("Generate your metric catalog")).not.toBeInTheDocument();
  expect(screen.queryByText("Connect metrics to your data")).not.toBeInTheDocument();
});

test("renders logo avatar with product initial", () => {
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

  const avatar = screen.getByLabelText("Product avatar");
  expect(avatar).toHaveTextContent("T");
});

test("renders Export PDF button when profile data is loaded", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: {
      metrics: { reach: [], engagement: [], value_delivery: [], value_capture: [] },
      totalCount: 0,
    },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [],
      completed: 0,
      total: 11,
      percentage: 0,
    },
  });

  expect(screen.getByRole("button", { name: /export pdf/i })).toBeInTheDocument();
});
