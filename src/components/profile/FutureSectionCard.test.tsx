import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { FutureSectionCard } from "./FutureSectionCard";

function setup(
  props: Partial<{
    title: string;
    description: string;
    prerequisite: string;
    isReady: boolean;
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
