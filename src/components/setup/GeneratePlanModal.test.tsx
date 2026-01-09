import { expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneratePlanModal } from "./GeneratePlanModal";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";

// Mock Convex hooks
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: () => mockUseQuery(),
    useMutation: () => mockUseMutation(),
  };
});

function setup(props: Partial<Parameters<typeof GeneratePlanModal>[0]> = {}) {
  const user = userEvent.setup();
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    journeyId: "journey123" as Id<"journeys">,
    onComplete: vi.fn(),
    ...props,
  };

  const client = new ConvexReactClient(
    "https://test.convex.cloud"
  );

  render(
    <ConvexProvider client={client}>
      <GeneratePlanModal {...defaultProps} />
    </ConvexProvider>
  );

  return { user, onClose: defaultProps.onClose, onComplete: defaultProps.onComplete };
}

beforeEach(() => {
  mockUseQuery.mockReset();
  mockUseMutation.mockReset();
});

test("shows loading state while extracting data", () => {
  mockUseQuery.mockReturnValue(undefined);
  setup();

  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

test("displays extracted entities and activities", () => {
  mockUseQuery.mockReturnValue({
    entities: [
      {
        name: "Account",
        activities: [
          { name: "Account Created", action: "Created", lifecycleSlot: "account_creation" },
          { name: "Account Verified", action: "Verified", lifecycleSlot: "activation" },
        ],
      },
      {
        name: "Project",
        activities: [
          { name: "Project Created", action: "Created", lifecycleSlot: "core_usage" },
        ],
      },
    ],
  });
  mockUseMutation.mockReturnValue(vi.fn());

  setup();

  expect(screen.getByText("Account")).toBeInTheDocument();
  expect(screen.getByText("Project")).toBeInTheDocument();
  expect(screen.getByText("Account Created")).toBeInTheDocument();
  expect(screen.getByText("Account Verified")).toBeInTheDocument();
  expect(screen.getByText("Project Created")).toBeInTheDocument();
});

test("shows empty state when no entities found", () => {
  mockUseQuery.mockReturnValue({ entities: [] });
  mockUseMutation.mockReturnValue(vi.fn());

  setup();

  expect(screen.getByText(/no activities found/i)).toBeInTheDocument();
});

test("entities and activities are checked by default", () => {
  mockUseQuery.mockReturnValue({
    entities: [
      {
        name: "Account",
        activities: [
          { name: "Account Created", action: "Created", lifecycleSlot: "account_creation" },
        ],
      },
    ],
  });
  mockUseMutation.mockReturnValue(vi.fn());

  setup();

  // Both checkboxes should be checked by default
  const checkboxes = screen.getAllByRole("checkbox");
  checkboxes.forEach((checkbox) => {
    expect(checkbox).toBeChecked();
  });
});

test("can toggle entity selection", async () => {
  mockUseQuery.mockReturnValue({
    entities: [
      {
        name: "Account",
        activities: [
          { name: "Account Created", action: "Created", lifecycleSlot: "account_creation" },
        ],
      },
    ],
  });
  mockUseMutation.mockReturnValue(vi.fn());

  const { user } = setup();

  const checkboxes = screen.getAllByRole("checkbox");
  // First checkbox is the entity
  await user.click(checkboxes[0]);

  // Entity should now be unchecked
  expect(checkboxes[0]).not.toBeChecked();
});

test("calls mutation with selected entities and activities", async () => {
  mockUseQuery.mockReturnValue({
    entities: [
      {
        name: "Account",
        activities: [
          { name: "Account Created", action: "Created", lifecycleSlot: "account_creation" },
        ],
      },
    ],
  });

  const importMutation = vi.fn().mockResolvedValue({ entitiesCreated: 1, activitiesCreated: 1 });
  mockUseMutation.mockReturnValue(importMutation);

  const { user, onComplete } = setup();

  const createButton = screen.getByRole("button", { name: /create plan/i });
  await user.click(createButton);

  await waitFor(() => {
    expect(importMutation).toHaveBeenCalledWith({
      journeyId: "journey123",
      selectedEntities: ["Account"],
      selectedActivities: ["Account Created"],
    });
  });

  await waitFor(() => {
    expect(onComplete).toHaveBeenCalled();
  });
});

test("closes modal when cancel is clicked", async () => {
  mockUseQuery.mockReturnValue({
    entities: [],
  });
  mockUseMutation.mockReturnValue(vi.fn());

  const { user, onClose } = setup();

  const cancelButton = screen.getByRole("button", { name: /cancel/i });
  await user.click(cancelButton);

  expect(onClose).toHaveBeenCalled();
});

test("disables Create Plan button when nothing is selected", async () => {
  mockUseQuery.mockReturnValue({
    entities: [
      {
        name: "Account",
        activities: [
          { name: "Account Created", action: "Created", lifecycleSlot: "account_creation" },
        ],
      },
    ],
  });
  mockUseMutation.mockReturnValue(vi.fn());

  const { user } = setup();

  // Uncheck both checkboxes
  const checkboxes = screen.getAllByRole("checkbox");
  for (const checkbox of checkboxes) {
    await user.click(checkbox);
  }

  const createButton = screen.getByRole("button", { name: /create plan/i });
  expect(createButton).toBeDisabled();
});
