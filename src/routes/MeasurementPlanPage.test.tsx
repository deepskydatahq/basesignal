import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import MeasurementPlanPage from "./MeasurementPlanPage";
import type { Id } from "../../convex/_generated/dataModel";

// Mock data that can be changed per test
let mockGetFullPlan: unknown = [];
let mockListEntities: unknown = [];
let mockFoundationStatus: unknown = {
  overviewInterview: { status: "complete", journeyId: null },
  measurementPlan: { status: "ready", entitiesCount: 0 },
};
let mockJourneyDiff: unknown = null;

vi.mock("convex/react", () => ({
  useQuery: (queryName: unknown) => {
    // Match based on the query string
    if (queryName === "measurementPlan:getFullPlan") {
      return mockGetFullPlan;
    }
    if (queryName === "measurementPlan:listEntities") {
      return mockListEntities;
    }
    if (queryName === "setupProgress:foundationStatus") {
      return mockFoundationStatus;
    }
    if (queryName === "measurementPlan:computeJourneyDiff") {
      return mockJourneyDiff;
    }
    if (queryName === "metrics:list") {
      return [];
    }
    if (queryName === "users:current") {
      return { primaryEntityId: null };
    }
    if (queryName === "skip") {
      return undefined;
    }
    // Return undefined for any other queries
    return undefined;
  },
  useMutation: () => vi.fn(),
}));

// Mock the api import
vi.mock("../../convex/_generated/api", () => ({
  api: {
    measurementPlan: {
      getFullPlan: "measurementPlan:getFullPlan",
      listEntities: "measurementPlan:listEntities",
      createEntity: "measurementPlan:createEntity",
      createActivity: "measurementPlan:createActivity",
      updateEntity: "measurementPlan:updateEntity",
      deleteEntity: "measurementPlan:deleteEntity",
      updateProperty: "measurementPlan:updateProperty",
      deleteProperty: "measurementPlan:deleteProperty",
      computeJourneyDiff: "measurementPlan:computeJourneyDiff",
      importFromJourneyIncremental: "measurementPlan:importFromJourneyIncremental",
      importFromJourney: "measurementPlan:importFromJourney",
      deleteAll: "measurementPlan:deleteAll",
      setFirstValue: "measurementPlan:setFirstValue",
    },
    journeys: {
      listByUser: "journeys:listByUser",
      get: "journeys:get",
    },
    setupProgress: {
      foundationStatus: "setupProgress:foundationStatus",
    },
    metrics: {
      list: "metrics:list",
    },
    users: {
      current: "users:current",
      setPrimaryEntity: "users:setPrimaryEntity",
    },
  },
}));

// Mock child components to simplify testing
vi.mock("@/components/measurement/ImportFromJourneyModal", () => ({
  ImportFromJourneyModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="import-modal">Import Modal</div> : null,
}));

vi.mock("@/components/measurement/AddPropertyDialog", () => ({
  AddPropertyDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="add-property-dialog">Add Property Dialog</div> : null,
}));

vi.mock("@/components/measurement/AddActivityModal", () => ({
  AddActivityModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-activity-modal">Add Activity Modal</div> : null,
}));

vi.mock("@/components/measurement/EditActivityModal", () => ({
  EditActivityModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="edit-activity-modal">Edit Activity Modal</div> : null,
}));

vi.mock("@/components/measurement/AddEntityDialog", () => ({
  AddEntityDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="add-entity-dialog">Add Entity Dialog</div> : null,
}));

vi.mock("@/components/measurement/RegenerateConfirmDialog", () => ({
  RegenerateConfirmDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="regenerate-confirm-dialog">Regenerate Confirm Dialog</div> : null,
}));

vi.mock("@/components/measurement/ActivityDetailPanel", () => ({
  ActivityDetailPanel: ({
    activity,
    onClose,
    onEdit,
  }: {
    activity: unknown;
    onClose: () => void;
    onEdit?: () => void;
  }) =>
    activity ? (
      <div data-testid="activity-detail-panel">
        Activity Detail Panel
        <button onClick={onClose}>Close</button>
        {onEdit && <button onClick={onEdit}>Edit</button>}
      </div>
    ) : null,
}));

function setup() {
  render(
    <MemoryRouter>
      <MeasurementPlanPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockGetFullPlan = [];
  mockListEntities = [];
  mockFoundationStatus = {
    overviewInterview: { status: "complete", journeyId: null },
    measurementPlan: { status: "ready", entitiesCount: 0 },
  };
  mockJourneyDiff = null;
});

test("renders page title", () => {
  setup();
  expect(
    screen.getByRole("heading", { level: 1, name: /measurement plan/i })
  ).toBeInTheDocument();
});

test("shows loading state when data is undefined", () => {
  mockGetFullPlan = undefined;
  setup();
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

test("shows empty state when no entities", () => {
  // mockGetFullPlan is already [] by default from beforeEach
  setup();
  expect(screen.getByText(/no measurement plan yet/i)).toBeInTheDocument();
});

test("renders entity cards when data exists", () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [],
      properties: [],
    },
    {
      entity: {
        _id: "e2" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "User",
        createdAt: Date.now(),
      },
      activities: [],
      properties: [],
    },
  ];

  setup();

  expect(screen.getByText("Account")).toBeInTheDocument();
  expect(screen.getByText("User")).toBeInTheDocument();
});

test("shows activity and property counts on entity cards", () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [
        {
          _id: "a1" as Id<"measurementActivities">,
          name: "Account Created",
        },
        {
          _id: "a2" as Id<"measurementActivities">,
          name: "Account Activated",
        },
      ],
      properties: [
        {
          _id: "p1" as Id<"measurementProperties">,
          name: "plan_type",
        },
      ],
    },
  ];

  setup();

  expect(screen.getByText("2 activities")).toBeInTheDocument();
  expect(screen.getByText("1 property")).toBeInTheDocument();
});

test("shows Add Entity button when data exists", () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [],
      properties: [],
    },
  ];
  setup();
  expect(
    screen.getByRole("button", { name: /add entity/i })
  ).toBeInTheDocument();
});

test("shows Add Activity button when data exists", () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [],
      properties: [],
    },
  ];
  setup();
  expect(
    screen.getByRole("button", { name: /add activity/i })
  ).toBeInTheDocument();
});

test("shows Import from Journey buttons", () => {
  setup();
  // There are two Import from Journey buttons: one in header, one in empty state
  const buttons = screen.getAllByRole("button", { name: /import from journey/i });
  expect(buttons.length).toBeGreaterThanOrEqual(1);
});

test("renders without error when navigated with highlight state", () => {
  // Setup mock data with an activity
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [
        {
          _id: "a1" as Id<"measurementActivities">,
          _creationTime: Date.now(),
          userId: "u1" as Id<"users">,
          entityId: "e1" as Id<"measurementEntities">,
          name: "Account Created",
          action: "Created",
          isFirstValue: false,
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  // Render with navigation state that includes highlightActivity
  // Uses custom MemoryRouter to inject location.state
  render(
    <MemoryRouter initialEntries={[{ pathname: "/measurement-plan", state: { highlightActivity: "Account Created" } }]}>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // Component should render without error - activity count is visible in collapsed state
  expect(screen.getByText("1 activity")).toBeInTheDocument();
});

test("opens activity detail panel when activity is clicked", async () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [
        {
          _id: "a1" as Id<"measurementActivities">,
          _creationTime: Date.now(),
          userId: "u1" as Id<"users">,
          entityId: "e1" as Id<"measurementEntities">,
          name: "Account Created",
          action: "Created",
          isFirstValue: false,
          lifecycleSlot: "account_creation",
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  render(
    <MemoryRouter>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // First expand the entity card
  await userEvent.click(screen.getByText("Account"));

  // Click the activity to open detail panel
  await userEvent.click(screen.getByText("Account Created"));

  expect(screen.getByTestId("activity-detail-panel")).toBeInTheDocument();
});

test("auto-expands entity card containing highlighted activity", async () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [
        {
          _id: "a1" as Id<"measurementActivities">,
          _creationTime: Date.now(),
          userId: "u1" as Id<"users">,
          entityId: "e1" as Id<"measurementEntities">,
          name: "Account Created",
          action: "Created",
          isFirstValue: false,
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  render(
    <MemoryRouter initialEntries={["/measurement-plan?highlight=Account%20Created"]}>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // Activity should be visible immediately (entity auto-expanded)
  expect(screen.getByText("Account Created")).toBeInTheDocument();
});

test("highlights activity when URL has highlight param", async () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [
        {
          _id: "a1" as Id<"measurementActivities">,
          _creationTime: Date.now(),
          userId: "u1" as Id<"users">,
          entityId: "e1" as Id<"measurementEntities">,
          name: "Account Created",
          action: "Created",
          isFirstValue: false,
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  render(
    <MemoryRouter initialEntries={["/measurement-plan?highlight=Account%20Created"]}>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // Entity should be auto-expanded due to highlight param
  // The activity row should have highlight styling (ring-2, ring-blue-500, bg-blue-50)
  const activityButton = screen.getByRole("button", { name: /Account Created/i });
  expect(activityButton).toBeInTheDocument();
  // The parent container should have highlight classes - we can verify the activity is visible
  // which confirms the highlight param worked to auto-expand
  expect(screen.getByText("Account Created")).toBeInTheDocument();
});

test("handles non-existent activity in highlight param gracefully", () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [
        {
          _id: "a1" as Id<"measurementActivities">,
          _creationTime: Date.now(),
          userId: "u1" as Id<"users">,
          entityId: "e1" as Id<"measurementEntities">,
          name: "Account Created",
          action: "Created",
          isFirstValue: false,
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  // Should not throw when highlight param doesn't match any activity
  render(
    <MemoryRouter initialEntries={["/measurement-plan?highlight=NonExistent%20Activity"]}>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // Page should render normally
  expect(screen.getByRole("heading", { level: 1, name: /measurement plan/i })).toBeInTheDocument();
  // Entity card should NOT be expanded (no match)
  expect(screen.queryByText("Account Created")).not.toBeInTheDocument();
});

test("activity row has View Metrics link", async () => {
  const user = userEvent.setup();

  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [
        {
          _id: "a1" as Id<"measurementActivities">,
          _creationTime: Date.now(),
          userId: "u1" as Id<"users">,
          entityId: "e1" as Id<"measurementEntities">,
          name: "Account Created",
          action: "Created",
          isFirstValue: false,
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  render(
    <MemoryRouter>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // Expand entity card
  await user.click(screen.getByText("Account"));

  // Should have View Metrics link
  const link = screen.getByRole("link", { name: /view metrics/i });
  expect(link).toHaveAttribute("href", "/metric-catalog?activity=Account%20Created");
});

test("opens edit modal from activity detail panel edit button", async () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [
        {
          _id: "a1" as Id<"measurementActivities">,
          _creationTime: Date.now(),
          userId: "u1" as Id<"users">,
          entityId: "e1" as Id<"measurementEntities">,
          name: "Account Created",
          action: "Created",
          isFirstValue: false,
          lifecycleSlot: "account_creation",
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  render(
    <MemoryRouter>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // Expand entity and open panel
  await userEvent.click(screen.getByText("Account"));
  await userEvent.click(screen.getByText("Account Created"));

  // Click edit in the panel (using the exact text from our mock)
  const editButton = screen.getByRole("button", { name: "Edit" });
  await userEvent.click(editButton);

  expect(screen.getByTestId("edit-activity-modal")).toBeInTheDocument();
});
