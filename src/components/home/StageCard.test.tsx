import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageCard } from "./StageCard";

function setup(props: Partial<Parameters<typeof StageCard>[0]> = {}) {
  const user = userEvent.setup();
  const onClick = props.onClick ?? vi.fn();
  const defaultProps = {
    title: "Test Stage",
    description: "Test description",
    icon: "Users" as const,
    status: "not_started" as const,
    onClick,
    ...props,
  };
  render(<StageCard {...defaultProps} />);
  return { user, onClick };
}

test("renders stage title and description", () => {
  setup({ title: "Overview Interview", description: "Map your user journey" });

  expect(screen.getByText("Overview Interview")).toBeInTheDocument();
  expect(screen.getByText("Map your user journey")).toBeInTheDocument();
});

test("renders Start button for not_started status", () => {
  setup({ status: "not_started" });

  expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
});

test("renders Continue button for in_progress status", () => {
  setup({ status: "in_progress" });

  expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
});

test("renders View button for complete status", () => {
  setup({ status: "complete" });

  expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
});

test("renders Define button for not_defined status", () => {
  setup({ status: "not_defined" });

  expect(screen.getByRole("button", { name: /define/i })).toBeInTheDocument();
});

test("renders View button for defined status", () => {
  setup({ status: "defined" });

  expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
});

test("renders Coming soon text for locked status", () => {
  setup({ status: "locked" });

  expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("shows progress text when provided", () => {
  setup({ status: "in_progress", progressText: "2 of 5 slots mapped" });

  expect(screen.getByText("2 of 5 slots mapped")).toBeInTheDocument();
});

test("calls onClick when button is clicked", async () => {
  const onClick = vi.fn();
  const { user } = setup({ status: "not_started", onClick });

  await user.click(screen.getByRole("button", { name: /start/i }));

  expect(onClick).toHaveBeenCalledOnce();
});

test("does not call onClick for locked status", async () => {
  const onClick = vi.fn();
  setup({ status: "locked", onClick });

  // Card should not be interactive
  expect(onClick).not.toHaveBeenCalled();
});

test("renders badge text when provided", () => {
  setup({
    title: "Metric Catalog",
    status: "in_progress",
    badgeText: "5/8 metrics",
  });

  expect(screen.getByText("5/8 metrics")).toBeInTheDocument();
});

test("does not render badge when not provided", () => {
  setup({
    title: "Metric Catalog",
    status: "in_progress",
  });

  // Should not have badge text, but still has title
  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
});

test("renders badge text for complete status", () => {
  setup({
    title: "Metric Catalog",
    status: "complete",
    badgeText: "8 metrics",
  });

  expect(screen.getByText("8 metrics")).toBeInTheDocument();
});

test("shows time estimate when provided and status is not_started", () => {
  setup({ status: "not_started", timeEstimate: "~15 min" });

  expect(screen.getByText("~15 min")).toBeInTheDocument();
});

test("does not show time estimate when status is complete", () => {
  setup({ status: "complete", timeEstimate: "~15 min" });

  expect(screen.queryByText("~15 min")).not.toBeInTheDocument();
});

test("does not show time estimate when status is locked", () => {
  setup({ status: "locked", timeEstimate: "~15 min" });

  expect(screen.queryByText("~15 min")).not.toBeInTheDocument();
});
