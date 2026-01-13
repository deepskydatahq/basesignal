import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewHistoryDrawer from "./InterviewHistoryDrawer";

// Mock Convex query
const mockHistory = [
  {
    _id: "session1",
    interviewType: "overview",
    status: "completed",
    startedAt: new Date("2026-01-08").getTime(),
    completedAt: new Date("2026-01-08").getTime(),
    messageCount: 10,
    activitiesAdded: 3,
  },
];

vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn(() => mockHistory),
  };
});

describe("InterviewHistoryDrawer", () => {
  function setup(isOpen = true) {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <InterviewHistoryDrawer
        journeyId={"journey1" as any}
        isOpen={isOpen}
        onClose={onClose}
      />
    );
    return { user, onClose };
  }

  it("renders nothing when closed", () => {
    setup(false);
    expect(screen.queryByText("Interview History")).not.toBeInTheDocument();
  });

  it("displays header with title", () => {
    setup();
    expect(screen.getByText("Interview History")).toBeInTheDocument();
  });

  it("displays close button", () => {
    setup();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("displays session cards", () => {
    setup();
    expect(screen.getByText("Overview Journey")).toBeInTheDocument();
    expect(screen.getByText(/10 messages/)).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
