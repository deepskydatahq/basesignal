import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstValueCandidateCard } from "./FirstValueCandidateCard";

function setup(props: Partial<Parameters<typeof FirstValueCandidateCard>[0]> = {}) {
  const user = userEvent.setup();
  const onConfirm = props.onConfirm ?? vi.fn();
  const onKeepExploring = props.onKeepExploring ?? vi.fn();
  const defaultProps = {
    activityName: "Project Published",
    reasoning: "Users see their work live for the first time",
    onConfirm,
    onKeepExploring,
    ...props,
  };
  render(<FirstValueCandidateCard {...defaultProps} />);
  return { user, onConfirm, onKeepExploring };
}

test("renders activity name and reasoning", () => {
  setup();

  expect(screen.getByText("Project Published")).toBeInTheDocument();
  expect(screen.getByText("Users see their work live for the first time")).toBeInTheDocument();
});

test("renders Confirm and Keep Exploring buttons", () => {
  setup();

  expect(screen.getByRole("button", { name: /confirm first value/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /keep exploring/i })).toBeInTheDocument();
});

test("calls onConfirm when Confirm is clicked", async () => {
  const { user, onConfirm } = setup();

  await user.click(screen.getByRole("button", { name: /confirm first value/i }));

  expect(onConfirm).toHaveBeenCalled();
});

test("calls onKeepExploring when Keep Exploring is clicked", async () => {
  const { user, onKeepExploring } = setup();

  await user.click(screen.getByRole("button", { name: /keep exploring/i }));

  expect(onKeepExploring).toHaveBeenCalled();
});

test("renders star icon", () => {
  setup();

  expect(screen.getByTestId("star-icon")).toBeInTheDocument();
});
