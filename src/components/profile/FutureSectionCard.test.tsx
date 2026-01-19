import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { FutureSectionCard } from "./FutureSectionCard";

function setup(
  props: Partial<{
    title: string;
    description: string;
    prerequisite: string;
    isReady: boolean;
    timeEstimate: string;
  }> = {}
) {
  const defaultProps = {
    title: "Heartbeat Event",
    description: "The single event that indicates a user is active.",
    prerequisite: "Requires: Overview Interview",
    isReady: false,
    ...props,
  };
  render(<FutureSectionCard {...defaultProps} />);
}

test("renders locked state with 50% opacity and dashed border when isReady is false", () => {
  setup({ isReady: false });

  expect(screen.getByText("Heartbeat Event")).toBeInTheDocument();
  expect(
    screen.getByText("The single event that indicates a user is active.")
  ).toBeInTheDocument();

  // Button should be disabled
  const button = screen.getByRole("button", { name: "Start Interview" });
  expect(button).toBeDisabled();

  // Prerequisite text should be visible
  expect(screen.getByText("Requires: Overview Interview")).toBeInTheDocument();
});

test("renders ready state with enabled button when isReady is true", () => {
  setup({ isReady: true });

  expect(screen.getByText("Heartbeat Event")).toBeInTheDocument();

  // Button should be enabled
  const button = screen.getByRole("button", { name: "Start Interview" });
  expect(button).not.toBeDisabled();

  // Prerequisite text should NOT be visible
  expect(
    screen.queryByText("Requires: Overview Interview")
  ).not.toBeInTheDocument();
});

test("renders custom title, description, and prerequisite", () => {
  setup({
    title: "Activation Definition",
    description: "Define what it means for a user to be activated.",
    prerequisite: "Requires: First Value definition",
    isReady: false,
  });

  expect(screen.getByText("Activation Definition")).toBeInTheDocument();
  expect(
    screen.getByText("Define what it means for a user to be activated.")
  ).toBeInTheDocument();
  expect(
    screen.getByText("Requires: First Value definition")
  ).toBeInTheDocument();
});

test("shows time estimate in button when isReady is true", () => {
  setup({ isReady: true, timeEstimate: "~7 min" });

  // Button should show time estimate
  expect(screen.getByRole("button", { name: /Start Interview.*~7 min/ })).toBeInTheDocument();
});

test("does not show time estimate in button when isReady is false", () => {
  setup({ isReady: false, timeEstimate: "~7 min" });

  // Button should just say "Start Interview" without time estimate
  expect(screen.getByRole("button", { name: "Start Interview" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /~7 min/ })).not.toBeInTheDocument();
});
