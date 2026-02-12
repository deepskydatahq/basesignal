import { expect, test, describe } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ICPProfilesSection } from "./ICPProfilesSection";
import type { ICPProfile } from "../../../convex/analysis/outputs/types";

function makeProfile(overrides?: Partial<ICPProfile>): ICPProfile {
  return {
    id: "icp-1",
    name: "Power User",
    description: "Highly engaged technical user",
    value_moment_priorities: [
      {
        moment_id: "vm-1",
        priority: 1,
        relevance_reason: "Core workflow enabler",
      },
    ],
    activation_triggers: ["Completes onboarding", "Creates first project"],
    pain_points: ["Slow data imports", "Limited API access"],
    success_metrics: ["Daily active usage", "API calls per week"],
    confidence: 0.85,
    sources: ["interview-1"],
    ...overrides,
  };
}

function setup(profiles: ICPProfile[] = []) {
  const user = userEvent.setup();
  render(<ICPProfilesSection profiles={profiles} />);
  return { user };
}

describe("ICPProfilesSection", () => {
  test("renders empty state when no profiles", () => {
    setup([]);

    expect(
      screen.getByText("No ICP profiles generated yet.")
    ).toBeInTheDocument();
  });

  test("renders persona name and description", () => {
    setup([makeProfile()]);

    expect(screen.getByText("Power User")).toBeInTheDocument();
    expect(
      screen.getByText("Highly engaged technical user")
    ).toBeInTheDocument();
  });

  test("renders high confidence badge for confidence > 0.8", () => {
    setup([makeProfile({ confidence: 0.85 })]);

    expect(screen.getByText("High 85%")).toBeInTheDocument();
  });

  test("renders medium confidence badge for confidence > 0.6", () => {
    setup([makeProfile({ confidence: 0.7 })]);

    expect(screen.getByText("Medium 70%")).toBeInTheDocument();
  });

  test("renders low confidence badge for confidence <= 0.6", () => {
    setup([makeProfile({ confidence: 0.5 })]);

    expect(screen.getByText("Low 50%")).toBeInTheDocument();
  });

  test("renders value moment priorities with priority level and reason", () => {
    setup([
      makeProfile({
        value_moment_priorities: [
          {
            moment_id: "vm-1",
            priority: 1,
            relevance_reason: "Core workflow enabler",
          },
          {
            moment_id: "vm-2",
            priority: 2,
            relevance_reason: "Drives retention",
          },
        ],
      }),
    ]);

    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("Core workflow enabler")).toBeInTheDocument();
    expect(screen.getByText("P2")).toBeInTheDocument();
    expect(screen.getByText("Drives retention")).toBeInTheDocument();
  });

  test("collapsible sections toggle to show content", async () => {
    const { user } = setup([makeProfile()]);

    // Content hidden by default
    expect(
      screen.queryByText("Completes onboarding")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Slow data imports")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Daily active usage")
    ).not.toBeInTheDocument();

    // Expand Activation Triggers
    await user.click(
      screen.getByRole("button", { name: /activation triggers/i })
    );
    expect(screen.getByText("Completes onboarding")).toBeInTheDocument();
    expect(screen.getByText("Creates first project")).toBeInTheDocument();

    // Expand Pain Points
    await user.click(
      screen.getByRole("button", { name: /pain points/i })
    );
    expect(screen.getByText("Slow data imports")).toBeInTheDocument();
    expect(screen.getByText("Limited API access")).toBeInTheDocument();

    // Expand Success Metrics
    await user.click(
      screen.getByRole("button", { name: /success metrics/i })
    );
    expect(screen.getByText("Daily active usage")).toBeInTheDocument();
    expect(screen.getByText("API calls per week")).toBeInTheDocument();
  });

  test("renders multiple profiles", () => {
    setup([
      makeProfile({ id: "icp-1", name: "Power User" }),
      makeProfile({ id: "icp-2", name: "Casual Browser" }),
    ]);

    expect(screen.getByText("Power User")).toBeInTheDocument();
    expect(screen.getByText("Casual Browser")).toBeInTheDocument();
  });
});
