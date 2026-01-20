import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileSection, ProfileSectionStatus } from "./ProfileSection";

function setup(props: Partial<{
  title: string;
  status: ProfileSectionStatus;
  statusLabel: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  prerequisiteText?: string;
}> = {}) {
  const user = userEvent.setup();
  const onAction = props.onAction ?? vi.fn();
  const defaultProps = {
    title: "Test Section",
    status: "not_started" as ProfileSectionStatus,
    statusLabel: "Not Started",
    children: <p>Test content</p>,
    onAction,
    ...props,
  };
  render(<ProfileSection {...defaultProps} />);
  return { user, onAction };
}

test("renders complete state with status label", () => {
  setup({
    title: "Core Identity",
    status: "complete",
    statusLabel: "Complete",
  });

  expect(screen.getByText("Core Identity")).toBeInTheDocument();
  expect(screen.getByText("Complete")).toBeInTheDocument();
});

test("renders in_progress state with status label", () => {
  setup({
    title: "User Journey",
    status: "in_progress",
    statusLabel: "In Progress",
  });

  expect(screen.getByText("User Journey")).toBeInTheDocument();
  expect(screen.getByText("In Progress")).toBeInTheDocument();
});
