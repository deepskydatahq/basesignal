import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SessionCard from "./SessionCard";

describe("SessionCard", () => {
  const mockSession = {
    _id: "session1" as any,
    interviewType: "overview",
    status: "completed",
    startedAt: new Date("2026-01-08T14:00:00").getTime(),
    completedAt: new Date("2026-01-08T15:00:00").getTime(),
    messageCount: 12,
    activitiesAdded: 5,
  };

  function setup(props = {}) {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const result = render(
      <SessionCard session={mockSession} onClick={onClick} {...props} />
    );
    return { user, onClick, ...result };
  }

  it("displays interview type label", () => {
    setup();
    expect(screen.getByText("Overview Journey")).toBeInTheDocument();
  });

  it("displays completed status", () => {
    setup();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("displays message count", () => {
    setup();
    expect(screen.getByText(/12 messages/)).toBeInTheDocument();
  });

  it("displays activities added", () => {
    setup();
    expect(screen.getByText(/5 activities/)).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const { user, onClick } = setup();
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("displays in-progress status for active sessions", () => {
    const activeSession = { ...mockSession, status: "active", completedAt: undefined };
    render(<SessionCard session={activeSession} onClick={vi.fn()} />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });
});
