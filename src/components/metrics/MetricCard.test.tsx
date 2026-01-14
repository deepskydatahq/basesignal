import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetricCard } from "./MetricCard";

function setup(props: Partial<Parameters<typeof MetricCard>[0]> = {}) {
  const user = userEvent.setup();
  const onClick = props.onClick ?? vi.fn();
  const defaultProps = {
    name: "Activation Rate",
    definition: "Percentage of users who complete their first value action",
    category: "value_delivery" as const,
    selected: false,
    onClick,
    ...props,
  };
  render(<MetricCard {...defaultProps} />);
  return { user, onClick };
}

test("renders metric name and definition", () => {
  setup({
    name: "Daily Active Users",
    definition: "Users who performed any action in the last 24 hours",
  });

  expect(screen.getByText("Daily Active Users")).toBeInTheDocument();
  expect(screen.getByText("Users who performed any action in the last 24 hours")).toBeInTheDocument();
});

test("renders category badge", () => {
  setup({ category: "engagement" });

  expect(screen.getByText("Engagement")).toBeInTheDocument();
});

test("truncates long definitions", () => {
  const longDefinition = "This is a very long definition that should be truncated after two lines because we want to keep the card compact and easy to scan in the grid layout.";
  setup({ definition: longDefinition });

  const definitionElement = screen.getByText(longDefinition);
  expect(definitionElement).toHaveClass("line-clamp-2");
});

test("calls onClick when card is clicked", async () => {
  const onClick = vi.fn();
  const { user } = setup({ onClick });

  await user.click(screen.getByRole("button"));

  expect(onClick).toHaveBeenCalledOnce();
});

test("shows selected state with ring", () => {
  setup({ selected: true });

  const card = screen.getByRole("button");
  expect(card).toHaveClass("ring-2", "ring-black");
});

test("does not show ring when not selected", () => {
  setup({ selected: false });

  const card = screen.getByRole("button");
  expect(card).not.toHaveClass("ring-2");
});

test("renders source event name when provided", () => {
  setup({ sourceEventName: "Account Created" });

  expect(screen.getByText("Source: Account Created")).toBeInTheDocument();
});

test("does not render source when sourceEventName is not provided", () => {
  setup();

  expect(screen.queryByText(/Source:/)).not.toBeInTheDocument();
});
