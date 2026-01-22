import { expect, test, vi, describe, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityTimeline } from "./ActivityTimeline";

let mockActivities: unknown[] | undefined = undefined;

vi.mock("convex/react", () => ({
  useQuery: () => mockActivities,
}));

function setup() {
  const user = userEvent.setup();
  render(<ActivityTimeline />);
  return { user };
}

beforeEach(() => {
  mockActivities = undefined;
});

describe("ActivityTimeline", () => {
  test("renders nothing when activities is undefined", () => {
    mockActivities = undefined;
    setup();

    expect(screen.queryByText("Recent Activity")).not.toBeInTheDocument();
  });

  test("renders nothing when no activities", () => {
    mockActivities = [];
    setup();

    expect(screen.queryByText("Recent Activity")).not.toBeInTheDocument();
  });

  test("renders timeline header with activities", () => {
    mockActivities = [
      { type: "profile_created", timestamp: Date.now(), description: "Created product profile" },
    ];
    setup();

    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  test("is collapsed by default, shows content when expanded", async () => {
    mockActivities = [
      { type: "profile_created", timestamp: Date.now(), description: "Created product profile" },
    ];
    const { user } = setup();

    // Title visible, content hidden
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(screen.queryByText("Created product profile")).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByRole("button", { name: /recent activity/i }));

    // Content now visible
    expect(screen.getByText("Created product profile")).toBeInTheDocument();
  });

  test("displays formatted timestamp for each activity", async () => {
    const jan15 = new Date("2026-01-15T14:30:00").getTime();
    mockActivities = [
      { type: "profile_created", timestamp: jan15, description: "Created product profile" },
    ];
    const { user } = setup();

    // Expand to see content
    await user.click(screen.getByRole("button", { name: /recent activity/i }));

    expect(screen.getByText("Jan 15, 2026")).toBeInTheDocument();
  });

  test("displays multiple activities", async () => {
    const now = Date.now();
    mockActivities = [
      { type: "stage_added", timestamp: now, description: "Added Signup stage" },
      { type: "interview_completed", timestamp: now - 1000, description: "Completed overview interview" },
      { type: "profile_created", timestamp: now - 2000, description: "Created product profile" },
    ];
    const { user } = setup();

    // Expand to see content
    await user.click(screen.getByRole("button", { name: /recent activity/i }));

    expect(screen.getByText("Added Signup stage")).toBeInTheDocument();
    expect(screen.getByText("Completed overview interview")).toBeInTheDocument();
    expect(screen.getByText("Created product profile")).toBeInTheDocument();
  });
});
