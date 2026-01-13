import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TranscriptView from "./TranscriptView";

// Mock the Convex query
vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn(() => [
      { role: "assistant", content: "Hello!", timestamp: 1000, toolCalls: undefined },
      { role: "user", content: "Hi there!", timestamp: 2000, toolCalls: undefined },
    ]),
  };
});

describe("TranscriptView", () => {
  function setup() {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(
      <TranscriptView
        sessionId={"session1" as any}
        interviewType="overview"
        date={new Date("2026-01-08").getTime()}
        onBack={onBack}
      />
    );
    return { user, onBack };
  }

  it("displays header with interview type and date", () => {
    setup();
    expect(screen.getByText("Overview Journey")).toBeInTheDocument();
    expect(screen.getByText(/Jan 8, 2026/)).toBeInTheDocument();
  });

  it("displays back button", () => {
    setup();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("displays messages with role labels", () => {
    setup();
    expect(screen.getByText("ASSISTANT")).toBeInTheDocument();
    expect(screen.getByText("YOU")).toBeInTheDocument();
    expect(screen.getByText("Hello!")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("calls onBack when back button clicked", async () => {
    const { user, onBack } = setup();
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
