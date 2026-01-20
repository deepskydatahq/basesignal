import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InterviewCompletionCard } from "./InterviewCompletionCard";

function setup(props: Partial<Parameters<typeof InterviewCompletionCard>[0]> = {}) {
  const user = userEvent.setup();
  const onComplete = props.onComplete ?? vi.fn();
  const defaultProps = {
    activityName: "Project Published",
    reasoning: "Users see their work live",
    expectedTimeframe: "Within first session",
    successCriteria: "User shares the link",
    onComplete,
    isLoading: false,
    ...props,
  };
  render(<InterviewCompletionCard {...defaultProps} />);
  return { user, onComplete };
}

test("renders summary of First Value definition", () => {
  setup();

  expect(screen.getByText("Project Published")).toBeInTheDocument();
  expect(screen.getByText("Users see their work live")).toBeInTheDocument();
  expect(screen.getByText(/first session/i)).toBeInTheDocument();
  expect(screen.getByText(/user shares the link/i)).toBeInTheDocument();
});

test("renders Complete Interview button", () => {
  setup();

  expect(screen.getByRole("button", { name: /complete interview/i })).toBeInTheDocument();
});

test("calls onComplete when button is clicked", async () => {
  const { user, onComplete } = setup();

  await user.click(screen.getByRole("button", { name: /complete interview/i }));

  expect(onComplete).toHaveBeenCalled();
});

test("disables button when loading", () => {
  setup({ isLoading: true });

  expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
});

test("shows success criteria only if provided", () => {
  setup({ successCriteria: undefined });

  expect(screen.queryByText(/success/i)).not.toBeInTheDocument();
});
