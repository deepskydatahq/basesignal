import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverviewJourneyMap from "./OverviewJourneyMap";
import type { Id } from "../../../convex/_generated/dataModel";

// Track mock call arguments
const mockConfirm = vi.fn();
const mockDismiss = vi.fn();
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

beforeEach(() => {
  mockConfirm.mockClear();
  mockDismiss.mockClear();
  mockUseQuery.mockReset();
  mockUseMutation.mockReset();

  // Setup default returns
  mockUseQuery.mockImplementation((query, args) => {
    // Skip queries return null
    if (args === "skip") return null;

    // First call is getActivitiesBySlot
    // Second call is checkCompletionStatus
    // Third call is getSession
    const callCount = mockUseQuery.mock.calls.length;

    if (callCount === 1) {
      return {
        account_creation: [{ _id: "a1", entity: "Account", action: "Created" }],
        activation: [{ _id: "a2", entity: "Project", action: "Published" }],
        core_usage: [],
        revenue: [],
        churn: [],
      };
    }
    if (callCount === 2) {
      return { canComplete: false, filledSlots: ["account_creation", "activation"], missingRequired: ["core_usage"] };
    }
    // getSession
    return {
      _id: "session-1",
      status: "active",
      pendingCandidate: {
        activityName: "Project Published",
        reasoning: "Users see their work live",
      },
    };
  });

  mockUseMutation.mockImplementation(() => {
    const callCount = mockUseMutation.mock.calls.length;
    return callCount === 1 ? mockConfirm : mockDismiss;
  });
});

test("renders FirstValueCandidateCard when pendingCandidate exists", () => {
  render(<OverviewJourneyMap journeyId={"j-1" as Id<"journeys">} sessionId={"session-1" as Id<"interviewSessions">} />);

  // The candidate card has the reasoning text (unique to the card)
  expect(screen.getByText("Users see their work live")).toBeInTheDocument();
  expect(screen.getByTestId("star-icon")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /confirm first value/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /keep exploring/i })).toBeInTheDocument();
});

test("calls confirmFirstValueCandidate when Confirm is clicked", async () => {
  const user = userEvent.setup();
  render(<OverviewJourneyMap journeyId={"j-1" as Id<"journeys">} sessionId={"session-1" as Id<"interviewSessions">} />);

  await user.click(screen.getByRole("button", { name: /confirm first value/i }));

  expect(mockConfirm).toHaveBeenCalledWith({ sessionId: "session-1" });
});

test("calls dismissFirstValueCandidate when Keep Exploring is clicked", async () => {
  const user = userEvent.setup();
  render(<OverviewJourneyMap journeyId={"j-1" as Id<"journeys">} sessionId={"session-1" as Id<"interviewSessions">} />);

  await user.click(screen.getByRole("button", { name: /keep exploring/i }));

  expect(mockDismiss).toHaveBeenCalledWith({ sessionId: "session-1" });
});
