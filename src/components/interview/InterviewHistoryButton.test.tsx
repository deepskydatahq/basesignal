import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewHistoryButton from "./InterviewHistoryButton";

// Mock useQuery with different return values
let mockSessionCount = 3;

vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn(() => Array(mockSessionCount).fill({
      _id: "session",
      interviewType: "overview",
      status: "completed",
      startedAt: Date.now(),
      messageCount: 5,
      activitiesAdded: 2,
    })),
  };
});

describe("InterviewHistoryButton", () => {
  beforeEach(() => {
    mockSessionCount = 3;
  });

  function setup() {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<InterviewHistoryButton journeyId={"journey1" as any} onClick={onClick} />);
    return { user, onClick };
  }

  it("displays History label", () => {
    setup();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("displays session count badge", () => {
    setup();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const { user, onClick } = setup();
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("hides badge when no sessions", () => {
    mockSessionCount = 0;
    render(<InterviewHistoryButton journeyId={"journey1" as any} onClick={vi.fn()} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
