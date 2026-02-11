import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

test("stages render sorted by level as horizontal progression cards", () => {
  render(<ActivationMapSection activationMap={makeMap()} />);

  const cards = screen.getAllByTestId("stage-card");
  expect(cards).toHaveLength(3);
  expect(cards[0]).toHaveTextContent("Signed Up");
  expect(cards[1]).toHaveTextContent("Engaged");
  expect(cards[2]).toHaveTextContent("Activated");
});

test("each stage shows level + name and signal strength badge with correct color", () => {
  render(<ActivationMapSection activationMap={makeMap()} />);

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

test("trigger events and value moments render on each stage", () => {
  render(<ActivationMapSection activationMap={makeMap()} />);

  const cards = screen.getAllByTestId("stage-card");

  expect(within(cards[0]).getByText("Account created")).toBeInTheDocument();
  expect(within(cards[0]).getByText("Access granted")).toBeInTheDocument();

  expect(within(cards[1]).getByText("Completed onboarding")).toBeInTheDocument();
  expect(within(cards[1]).getByText("First dashboard")).toBeInTheDocument();
});

test("drop-off risk badge renders green/amber/red", () => {
  render(<ActivationMapSection activationMap={makeMap()} />);

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

test("transition connectors show trigger events and timeframe", () => {
  render(<ActivationMapSection activationMap={makeMap()} />);

  const connectors = screen.getAllByTestId("transition-connector");
  expect(connectors).toHaveLength(2);

  expect(within(connectors[0]).getByText("Completed onboarding")).toBeInTheDocument();
  expect(within(connectors[0]).getByText("1-3 days")).toBeInTheDocument();

  expect(within(connectors[1]).getByText("Created first report")).toBeInTheDocument();
  expect(within(connectors[1]).getByText("3-7 days")).toBeInTheDocument();
});

test("primary activation level highlighted with distinct border/background", () => {
  render(<ActivationMapSection activationMap={makeMap()} />);

  const cards = screen.getAllByTestId("stage-card");

  // Level 3 is primary
  expect(cards[2].className).toMatch(/ring-indigo-500/);
  expect(cards[2].className).toMatch(/bg-indigo-50/);

  // Others should NOT have ring-indigo-500
  expect(cards[0].className).not.toMatch(/ring-indigo-500/);
  expect(cards[1].className).not.toMatch(/ring-indigo-500/);
});

test("handles drop_off_risk as { level, reason } object defensively", () => {
  const map = makeMap();
  // Force an object-shaped drop_off_risk (defensive handling)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (map.stages[0] as any).drop_off_risk = { level: "high", reason: "Poor onboarding" };

  render(<ActivationMapSection activationMap={map} />);

  const cards = screen.getAllByTestId("stage-card");
  const riskBadge = within(cards[0]).getByText("high");
  expect(riskBadge.className).toMatch(/red/);
});

test("empty state renders when activationMap is null", () => {
  render(<ActivationMapSection activationMap={null} />);

  expect(screen.getByText(/no activation map/i)).toBeInTheDocument();
  expect(screen.queryAllByTestId("stage-card")).toHaveLength(0);
});
