import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InterviewHistoryButton, InterviewHistoryDrawer } from "../components/interview";
import type { Id } from "../../convex/_generated/dataModel";

// Mock Convex hooks
vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn(() => [
      { _id: "session1", interviewType: "overview", status: "completed", startedAt: Date.now(), messageCount: 5, activitiesAdded: 2 }
    ]),
  };
});

describe("JourneyEditorPage History Integration", () => {
  it("InterviewHistoryButton displays History label and count badge", () => {
    render(
      <InterviewHistoryButton
        journeyId={"journey1" as unknown as Id<"journeys">}
        onClick={() => {}}
      />
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // count badge
  });

  it("InterviewHistoryDrawer opens with header", () => {
    render(
      <InterviewHistoryDrawer
        journeyId={"journey1" as unknown as Id<"journeys">}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("Interview History")).toBeInTheDocument();
    expect(screen.getByText("Overview Journey")).toBeInTheDocument();
  });

  it("InterviewHistoryDrawer is hidden when closed", () => {
    render(
      <InterviewHistoryDrawer
        journeyId={"journey1" as unknown as Id<"journeys">}
        isOpen={false}
        onClose={() => {}}
      />
    );
    expect(screen.queryByText("Interview History")).not.toBeInTheDocument();
  });

  it("InterviewHistoryButton onClick is called when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <InterviewHistoryButton
        journeyId={"journey1" as unknown as Id<"journeys">}
        onClick={onClick}
      />
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
