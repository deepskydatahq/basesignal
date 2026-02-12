import { expect, test, describe } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivationMapSection } from "./ActivationMapSection";
import type { ActivationMap } from "./types";

function makeMap(overrides: Partial<ActivationMap> = {}): ActivationMap {
  return {
    stages: [
      {
        level: 2,
        name: "Engaged",
        signal_strength: "strong",
        trigger_events: ["Completed onboarding"],
        value_moments_unlocked: ["First dashboard"],
        drop_off_risk: "medium",
      },
      {
        level: 1,
        name: "Signed Up",
        signal_strength: "weak",
        trigger_events: ["Account created"],
        value_moments_unlocked: ["Access granted"],
        drop_off_risk: "high",
      },
      {
        level: 3,
        name: "Activated",
        signal_strength: "very_strong",
        trigger_events: ["Created first report"],
        value_moments_unlocked: ["Value realized"],
        drop_off_risk: "low",
      },
    ],
    transitions: [
      {
        from_level: 1,
        to_level: 2,
        trigger_events: ["Completed onboarding"],
        typical_timeframe: "1-3 days",
      },
      {
        from_level: 2,
        to_level: 3,
        trigger_events: ["Created first report"],
        typical_timeframe: "3-7 days",
      },
    ],
    primary_activation_level: 3,
    confidence: 0.85,
    sources: ["crawl"],
    ...overrides,
  };
}

function setup(activationMap: ActivationMap | null = makeMap()) {
  const user = userEvent.setup();
  render(<ActivationMapSection activationMap={activationMap} />);
  return { user };
}

describe("ActivationMapSection", () => {
  test("renders stages sorted by level in a responsive grid", () => {
    setup();

    const cards = screen.getAllByTestId("stage-card");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Signed Up");
    expect(cards[1]).toHaveTextContent("Engaged");
    expect(cards[2]).toHaveTextContent("Activated");
  });

  test("each stage card shows level badge, name, and signal strength badge", () => {
    setup();

    const cards = screen.getAllByTestId("stage-card");

    // Level 1 - weak signal → gray
    expect(within(cards[0]).getByText("L1")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Signed Up")).toBeInTheDocument();
    const weakBadge = within(cards[0]).getByText("weak");
    expect(weakBadge.className).toMatch(/gray/);

    // Level 3 - very_strong signal → indigo
    const strongBadge = within(cards[2]).getByText("very_strong");
    expect(strongBadge.className).toMatch(/indigo/);
  });

  test("drop-off risk badge renders with correct colors", () => {
    setup();

    const cards = screen.getAllByTestId("stage-card");

    // Level 1 = high risk → red
    const highRisk = within(cards[0]).getByText("high");
    expect(highRisk.className).toMatch(/red/);

    // Level 2 = medium risk → amber
    const mediumRisk = within(cards[1]).getByText("medium");
    expect(mediumRisk.className).toMatch(/amber/);

    // Level 3 = low risk → green
    const lowRisk = within(cards[2]).getByText("low");
    expect(lowRisk.className).toMatch(/green/);
  });

  test("collapsible trigger events section toggles to show items with count", async () => {
    const { user } = setup();

    const cards = screen.getAllByTestId("stage-card");

    // Trigger events hidden by default
    expect(
      within(cards[0]).queryByText("Account created")
    ).not.toBeInTheDocument();

    // Click to expand Trigger Events on first card
    await user.click(
      within(cards[0]).getByRole("button", { name: /trigger events/i })
    );
    expect(within(cards[0]).getByText("Account created")).toBeInTheDocument();

    // Count is shown in the button label
    expect(
      within(cards[0]).getByRole("button", { name: /trigger events \(1\)/i })
    ).toBeInTheDocument();
  });

  test("collapsible value moments section toggles to show items with count", async () => {
    const { user } = setup();

    const cards = screen.getAllByTestId("stage-card");

    // Value moments hidden by default
    expect(
      within(cards[1]).queryByText("First dashboard")
    ).not.toBeInTheDocument();

    // Click to expand Value Moments on second card
    await user.click(
      within(cards[1]).getByRole("button", { name: /value moments/i })
    );
    expect(within(cards[1]).getByText("First dashboard")).toBeInTheDocument();

    // Count is shown in the button label
    expect(
      within(cards[1]).getByRole("button", { name: /value moments \(1\)/i })
    ).toBeInTheDocument();
  });

  test("primary activation level highlighted with indigo ring/border", () => {
    setup();

    const cards = screen.getAllByTestId("stage-card");

    // Level 3 is primary
    expect(cards[2].className).toMatch(/ring-indigo-500/);

    // Others should NOT have ring-indigo-500
    expect(cards[0].className).not.toMatch(/ring-indigo-500/);
    expect(cards[1].className).not.toMatch(/ring-indigo-500/);
  });

  test("empty state renders when activationMap is null", () => {
    setup(null);

    expect(screen.getByText(/no activation map/i)).toBeInTheDocument();
    expect(screen.queryAllByTestId("stage-card")).toHaveLength(0);
  });
});
