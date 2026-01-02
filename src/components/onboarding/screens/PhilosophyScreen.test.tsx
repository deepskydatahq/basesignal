import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhilosophyScreen } from "./PhilosophyScreen";

describe("PhilosophyScreen", () => {
  it("renders the problem statement", () => {
    render(<PhilosophyScreen onNext={vi.fn()} />);
    expect(
      screen.getByText(/tracking plans focus on interactions/i)
    ).toBeInTheDocument();
  });

  it("renders the shift statement", () => {
    render(<PhilosophyScreen onNext={vi.fn()} />);
    expect(
      screen.getByText(/basesignal measures performance/i)
    ).toBeInTheDocument();
  });

  it("renders the journey visualization stages", () => {
    render(<PhilosophyScreen onNext={vi.fn()} />);
    expect(screen.getByText("Signup")).toBeInTheDocument();
    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByText("Activated")).toBeInTheDocument();
  });

  it("calls onNext when Continue button is clicked", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<PhilosophyScreen onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
