import { expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntityCard } from "./EntityCard";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";

const mockUpdateEntity = vi.fn();
const mockDeleteEntity = vi.fn();

let mutationCallCount = 0;

vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useMutation: () => {
      mutationCallCount++;
      // First call is updateEntity, second is deleteEntity
      if (mutationCallCount % 2 === 1) {
        return mockUpdateEntity;
      }
      return mockDeleteEntity;
    },
  };
});

function setup(props: Partial<Parameters<typeof EntityCard>[0]> = {}) {
  const user = userEvent.setup();
  const defaultProps = {
    id: "entity123" as Id<"measurementEntities">,
    name: "Account",
    description: "Represents a customer account",
    activityCount: 3,
    propertyCount: 2,
    ...props,
  };

  const client = new ConvexReactClient("https://test.convex.cloud");

  render(
    <ConvexProvider client={client}>
      <EntityCard {...defaultProps} />
    </ConvexProvider>
  );

  return {
    user,
    props: defaultProps,
  };
}

beforeEach(() => {
  mockUpdateEntity.mockReset();
  mockDeleteEntity.mockReset();
  mutationCallCount = 0;
  vi.spyOn(window, "confirm").mockImplementation(() => true);
});

test("renders entity card with name and counts", () => {
  setup();

  expect(screen.getByText("Account")).toBeInTheDocument();
  expect(screen.getByText("3 activities")).toBeInTheDocument();
  expect(screen.getByText("2 properties")).toBeInTheDocument();
});

test("renders singular form for single activity", () => {
  setup({ activityCount: 1 });

  expect(screen.getByText("1 activity")).toBeInTheDocument();
});

test("renders singular form for single property", () => {
  setup({ propertyCount: 1 });

  expect(screen.getByText("1 property")).toBeInTheDocument();
});

test("expands and collapses on header click", async () => {
  const { user } = setup({
    children: <div data-testid="child-content">Child content</div>,
  });

  // Initially collapsed
  expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();

  // Click to expand
  const headerButton = screen.getByRole("button", { name: /account/i });
  await user.click(headerButton);

  // Should show children
  expect(screen.getByTestId("child-content")).toBeInTheDocument();

  // Click to collapse
  await user.click(headerButton);

  // Children should be hidden
  expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
});

test("starts expanded when defaultExpanded is true", () => {
  setup({
    defaultExpanded: true,
    children: <div data-testid="child-content">Child content</div>,
  });

  expect(screen.getByTestId("child-content")).toBeInTheDocument();
});

test("enters edit mode when edit button clicked", async () => {
  const { user } = setup();

  // Find and click edit button
  const editButton = screen.getByRole("button", { name: /edit entity/i });
  await user.click(editButton);

  // Should show edit form
  expect(screen.getByPlaceholderText("Entity name")).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText("Description (optional)")
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
});

test("updates entity on save", async () => {
  mockUpdateEntity.mockResolvedValue(undefined);
  const { user } = setup();

  // Enter edit mode
  const editButton = screen.getByRole("button", { name: /edit entity/i });
  await user.click(editButton);

  // Modify name
  const nameInput = screen.getByPlaceholderText("Entity name");
  await user.clear(nameInput);
  await user.type(nameInput, "Updated Account");

  // Save
  const saveButton = screen.getByRole("button", { name: /save/i });
  await user.click(saveButton);

  await waitFor(() => {
    expect(mockUpdateEntity).toHaveBeenCalledWith({
      id: "entity123",
      name: "Updated Account",
      description: "Represents a customer account",
    });
  });
});

test("exits edit mode on cancel", async () => {
  const { user } = setup();

  // Enter edit mode
  const editButton = screen.getByRole("button", { name: /edit entity/i });
  await user.click(editButton);

  // Modify name
  const nameInput = screen.getByPlaceholderText("Entity name");
  await user.clear(nameInput);
  await user.type(nameInput, "Modified Name");

  // Cancel
  const cancelButton = screen.getByRole("button", { name: /cancel/i });
  await user.click(cancelButton);

  // Should exit edit mode and show original name
  expect(screen.getByText("Account")).toBeInTheDocument();
  expect(
    screen.queryByPlaceholderText("Entity name")
  ).not.toBeInTheDocument();
});

test("shows validation error for empty name", async () => {
  const { user } = setup();

  // Enter edit mode
  const editButton = screen.getByRole("button", { name: /edit entity/i });
  await user.click(editButton);

  // Clear name
  const nameInput = screen.getByPlaceholderText("Entity name");
  await user.clear(nameInput);

  // Try to save
  const saveButton = screen.getByRole("button", { name: /save/i });
  await user.click(saveButton);

  // Should show validation error
  expect(screen.getByText("Name is required")).toBeInTheDocument();

  // Should not have called mutation
  expect(mockUpdateEntity).not.toHaveBeenCalled();
});

test("confirms before deleting", async () => {
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  const { user } = setup();

  // Click delete button
  const deleteButton = screen.getByRole("button", { name: /delete/i });
  await user.click(deleteButton);

  // Should show confirmation dialog
  expect(confirmSpy).toHaveBeenCalled();

  // Should NOT have called delete mutation since we returned false
  expect(mockDeleteEntity).not.toHaveBeenCalled();
});

test("deletes entity on confirm", async () => {
  mockDeleteEntity.mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const { user } = setup();

  // Click delete button
  const deleteButton = screen.getByRole("button", { name: /delete/i });
  await user.click(deleteButton);

  await waitFor(() => {
    expect(mockDeleteEntity).toHaveBeenCalledWith({
      id: "entity123",
    });
  });
});

test("shows delete confirmation with children warning", async () => {
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  const { user } = setup({ activityCount: 2, propertyCount: 1 });

  const deleteButton = screen.getByRole("button", { name: /delete/i });
  await user.click(deleteButton);

  // Confirmation message should include warning about children
  expect(confirmSpy).toHaveBeenCalledWith(
    expect.stringContaining("2 activities")
  );
  expect(confirmSpy).toHaveBeenCalledWith(
    expect.stringContaining("1 property")
  );
});

test("shows delete error on failure", async () => {
  const errorMessage = "Cannot delete entity with references";
  mockDeleteEntity.mockRejectedValue(new Error(errorMessage));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const { user } = setup();

  const deleteButton = screen.getByRole("button", { name: /delete/i });
  await user.click(deleteButton);

  await waitFor(() => {
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});

test("disables delete button while deleting", async () => {
  // Make deletion hang
  mockDeleteEntity.mockImplementation(
    () => new Promise((resolve) => setTimeout(resolve, 1000))
  );
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const { user } = setup();

  const deleteButton = screen.getByRole("button", { name: /delete/i });
  await user.click(deleteButton);

  // Button should be disabled during deletion
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: /deleting/i })
    ).toBeDisabled();
  });
});

test("renders children when expanded", async () => {
  const { user } = setup({
    children: (
      <div>
        <span data-testid="activity-1">Activity 1</span>
        <span data-testid="activity-2">Activity 2</span>
      </div>
    ),
  });

  // Expand
  const headerButton = screen.getByRole("button", { name: /account/i });
  await user.click(headerButton);

  expect(screen.getByTestId("activity-1")).toBeInTheDocument();
  expect(screen.getByTestId("activity-2")).toBeInTheDocument();
});

test("shows suggestedFrom badge when provided", () => {
  setup({ suggestedFrom: "overview_interview" });

  expect(screen.getByText(/from overview interview/i)).toBeInTheDocument();
});

test("shows update error on save failure", async () => {
  const errorMessage = "Entity name already exists";
  mockUpdateEntity.mockRejectedValue(new Error(errorMessage));
  const { user } = setup();

  // Enter edit mode
  const editButton = screen.getByRole("button", { name: /edit entity/i });
  await user.click(editButton);

  // Modify and save
  const nameInput = screen.getByPlaceholderText("Entity name");
  await user.clear(nameInput);
  await user.type(nameInput, "Duplicate Name");

  const saveButton = screen.getByRole("button", { name: /save/i });
  await user.click(saveButton);

  await waitFor(() => {
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});

test("pre-fills edit form with current values", async () => {
  const { user } = setup({
    name: "Project",
    description: "A project entity",
  });

  // Enter edit mode
  const editButton = screen.getByRole("button", { name: /edit entity/i });
  await user.click(editButton);

  expect(screen.getByPlaceholderText("Entity name")).toHaveValue("Project");
  expect(screen.getByPlaceholderText("Description (optional)")).toHaveValue(
    "A project entity"
  );
});

test("resets edit form values on cancel", async () => {
  const { user } = setup({
    name: "Project",
    description: "A project entity",
  });

  // Enter edit mode
  const editButton = screen.getByRole("button", { name: /edit entity/i });
  await user.click(editButton);

  // Modify values
  const nameInput = screen.getByPlaceholderText("Entity name");
  await user.clear(nameInput);
  await user.type(nameInput, "Modified");

  // Cancel
  const cancelButton = screen.getByRole("button", { name: /cancel/i });
  await user.click(cancelButton);

  // Re-enter edit mode - need to get the button again after cancel re-renders
  const editButtonAgain = screen.getByRole("button", { name: /edit entity/i });
  await user.click(editButtonAgain);

  expect(screen.getByPlaceholderText("Entity name")).toHaveValue("Project");
});
