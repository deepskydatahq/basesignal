import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewCard from "./InterviewCard";

function setup(
  props: Partial<{
    type: "first_value" | "retention" | "value_outcomes" | "value_capture" | "churn";
    status: "locked" | "available" | "in_progress" | "complete";
    missingDeps: string[];
    isSelected: boolean;
  }> = {}
) {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const defaultProps = {
    type: "first_value" as const,
    status: "available" as const,
    missingDeps: [],
    onSelect,
    isSelected: false,
    ...props,
  };
  render(<InterviewCard {...defaultProps} />);
  return { user, onSelect };
}

test("shows time estimate for available status", () => {
  setup({ type: "first_value", status: "available" });

  expect(screen.getByText("~7 min")).toBeInTheDocument();
});

test("does not show time estimate for locked status", () => {
  setup({ type: "first_value", status: "locked", missingDeps: ["overview"] });

  expect(screen.queryByText("~7 min")).not.toBeInTheDocument();
});

test("does not show time estimate for complete status", () => {
  setup({ type: "first_value", status: "complete" });

  expect(screen.queryByText("~7 min")).not.toBeInTheDocument();
});

test("renders interview name and description", () => {
  setup({ type: "first_value", status: "available" });

  expect(screen.getByText("Find First Value")).toBeInTheDocument();
  expect(screen.getByText(/activation moment/i)).toBeInTheDocument();
});

test("calls onSelect when clicked for available status", async () => {
  const { user, onSelect } = setup({ type: "first_value", status: "available" });

  await user.click(screen.getByText("Find First Value"));

  expect(onSelect).toHaveBeenCalledOnce();
});

test("does not call onSelect when clicked for locked status", async () => {
  const { user, onSelect } = setup({
    type: "first_value",
    status: "locked",
    missingDeps: ["overview"],
  });

  await user.click(screen.getByText("Find First Value"));

  expect(onSelect).not.toHaveBeenCalled();
});
