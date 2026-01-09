import { expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddActivityModal } from "./AddActivityModal";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { Id, Doc } from "../../../convex/_generated/dataModel";

// Mock mutations
const mockCreateActivity = vi.fn();
const mockCreateEntity = vi.fn();

// Track mutation call count to return correct mock
let mutationCallCount = 0;

vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useMutation: () => {
      // First useMutation call is createActivity, second is createEntity
      mutationCallCount++;
      if (mutationCallCount % 2 === 1) {
        return mockCreateActivity;
      }
      return mockCreateEntity;
    },
  };
});

function createMockEntity(
  id: string,
  name: string
): Doc<"measurementEntities"> {
  return {
    _id: id as Id<"measurementEntities">,
    _creationTime: Date.now(),
    userId: "user123" as Id<"users">,
    name,
    createdAt: Date.now(),
  };
}

function setup(
  props: Partial<Parameters<typeof AddActivityModal>[0]> = {}
) {
  const user = userEvent.setup();
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    entities: [
      createMockEntity("entity1", "Account"),
      createMockEntity("entity2", "Project"),
      createMockEntity("entity3", "User"),
    ],
    ...props,
  };

  const client = new ConvexReactClient("https://test.convex.cloud");

  render(
    <ConvexProvider client={client}>
      <AddActivityModal {...defaultProps} />
    </ConvexProvider>
  );

  return {
    user,
    onClose: defaultProps.onClose,
    entities: defaultProps.entities,
  };
}

beforeEach(() => {
  mockCreateActivity.mockReset();
  mockCreateEntity.mockReset();
  mutationCallCount = 0;
});

test("renders modal with activity name input", () => {
  setup();

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  // Title is in a heading
  expect(screen.getByRole("heading", { name: "Add Activity" })).toBeInTheDocument();
  expect(screen.getByLabelText("Activity Name")).toBeInTheDocument();
});

test("suggests entity when user types activity name", async () => {
  const { user } = setup();

  const activityInput = screen.getByLabelText("Activity Name");
  await user.type(activityInput, "Account Created");

  // Should show suggestion text
  await waitFor(() => {
    expect(screen.getByText(/Suggested: Account/)).toBeInTheDocument();
  });
});

test("shows entity select dropdown", () => {
  setup();

  // Find the entity select trigger - it should exist
  const entitySelect = screen.getByRole("combobox", { name: /entity/i });
  expect(entitySelect).toBeInTheDocument();
  // The select should show placeholder text initially
  expect(entitySelect).toHaveTextContent(/select an entity/i);
});

test("shows lifecycle slot select", () => {
  setup();

  const lifecycleSelect = screen.getByRole("combobox", { name: /lifecycle/i });
  expect(lifecycleSelect).toBeInTheDocument();
});

test("shows first value checkbox", () => {
  setup();

  const checkbox = screen.getByRole("checkbox", { name: /first value/i });
  expect(checkbox).toBeInTheDocument();
});

test("calls createActivity on submit with valid data", async () => {
  mockCreateActivity.mockResolvedValue("activity123");
  const { user, onClose } = setup();

  // Fill in activity name - entity "Account" matches an existing entity
  // so it will be auto-selected
  const activityInput = screen.getByLabelText("Activity Name");
  await user.type(activityInput, "Account Created");

  // Wait for auto-selection to happen
  await waitFor(() => {
    expect(screen.getByText(/Suggested: Account/)).toBeInTheDocument();
  });

  // The entity should be auto-selected, so submit button should be enabled
  const submitButton = screen.getByRole("button", { name: /add activity/i });

  // Wait for submit button to be enabled (after entity is auto-selected)
  await waitFor(() => {
    expect(submitButton).not.toBeDisabled();
  });

  await user.click(submitButton);

  await waitFor(() => {
    expect(mockCreateActivity).toHaveBeenCalledWith({
      entityId: "entity1",
      name: "Account Created",
      action: "Created",
      description: undefined,
      lifecycleSlot: undefined,
      isFirstValue: false,
      suggestedFrom: "manual",
    });
  });

  await waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });
});

test("shows validation error for invalid format", async () => {
  const { user } = setup();

  // Type an activity without past tense action - "Account" will be auto-selected
  const activityInput = screen.getByLabelText("Activity Name");
  await user.type(activityInput, "Account Create");

  // Wait for entity to be auto-selected
  await waitFor(() => {
    expect(screen.getByText(/Suggested: Account/)).toBeInTheDocument();
  });

  // Wait for submit button to be enabled
  const submitButton = screen.getByRole("button", { name: /add activity/i });
  await waitFor(() => {
    expect(submitButton).not.toBeDisabled();
  });

  // Try to submit
  await user.click(submitButton);

  // Should show validation error
  await waitFor(() => {
    expect(screen.getByText(/past tense/i)).toBeInTheDocument();
  });

  // Should NOT have called mutation
  expect(mockCreateActivity).not.toHaveBeenCalled();
});

test("offers to create new entity when not found", async () => {
  const { user } = setup();

  // Type an activity with an entity that doesn't exist
  const activityInput = screen.getByLabelText("Activity Name");
  await user.type(activityInput, "Widget Created");

  // Should show a "Create Widget entity" button
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: /create widget entity/i })
    ).toBeInTheDocument();
  });
});

test("disables submit when entity not selected", () => {
  setup();

  const submitButton = screen.getByRole("button", { name: /add activity/i });
  expect(submitButton).toBeDisabled();
});

test("preselects entity when preselectedEntityId provided", () => {
  setup({
    preselectedEntityId: "entity2" as Id<"measurementEntities">,
  });

  // The entity select should show "Project" as selected
  const entitySelect = screen.getByRole("combobox", { name: /entity/i });
  expect(entitySelect).toHaveTextContent("Project");
});
