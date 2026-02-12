import { expect, test, describe } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValueMomentsSection } from "./ValueMomentsSection";
import type { ValueMoment } from "./types";

function makeMoment(overrides: Partial<ValueMoment> = {}): ValueMoment {
  return {
    id: "vm-1",
    name: "Test Moment",
    description: "A test value moment",
    tier: 1,
    lenses: ["jtbd", "outcomes"],
    lens_count: 2,
    roles: ["Product Manager"],
    product_surfaces: ["Dashboard"],
    contributing_candidates: ["c-1", "c-2"],
    ...overrides,
  };
}

function setup(moments: ValueMoment[] = []) {
  render(<ValueMomentsSection moments={moments} />);
}

// AC1: Stats bar shows total moments and tier 1/2/3 counts
describe("stats bar", () => {
  test("shows total moments and tier counts", () => {
    const moments = [
      makeMoment({ id: "vm-1", tier: 1 }),
      makeMoment({ id: "vm-2", tier: 1 }),
      makeMoment({ id: "vm-3", tier: 2 }),
      makeMoment({ id: "vm-4", tier: 3 }),
      makeMoment({ id: "vm-5", tier: 3 }),
      makeMoment({ id: "vm-6", tier: 3 }),
    ];
    setup(moments);

    expect(screen.getByText("6")).toBeInTheDocument(); // total
    expect(screen.getByText("2")).toBeInTheDocument(); // tier 1
    expect(screen.getByText("1")).toBeInTheDocument(); // tier 2
    expect(screen.getByText("3")).toBeInTheDocument(); // tier 3
  });

  test("shows label text for stats", () => {
    setup([makeMoment({ tier: 1 })]);

    expect(screen.getByText(/total/i)).toBeInTheDocument();
    // Use getAllByText since tier labels also appear as section headings
    expect(screen.getAllByText(/core/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/important/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/supporting/i).length).toBeGreaterThanOrEqual(1);
  });
});

// AC2: Moments grouped into Tier 1 (Core), Tier 2 (Important), Tier 3 (Supporting) sections
describe("tier grouping", () => {
  test("groups moments into Core, Important, and Supporting sections", () => {
    const moments = [
      makeMoment({ id: "vm-1", name: "Core Moment", tier: 1 }),
      makeMoment({ id: "vm-2", name: "Important Moment", tier: 2 }),
      makeMoment({ id: "vm-3", name: "Supporting Moment", tier: 3 }),
    ];
    setup(moments);

    const coreHeading = screen.getByRole("heading", { name: /core/i });
    const importantHeading = screen.getByRole("heading", { name: /important/i });
    const supportingHeading = screen.getByRole("heading", { name: /supporting/i });

    expect(coreHeading).toBeInTheDocument();
    expect(importantHeading).toBeInTheDocument();
    expect(supportingHeading).toBeInTheDocument();
  });

  test("does not render tier section when no moments exist for that tier", () => {
    const moments = [
      makeMoment({ id: "vm-1", name: "Core Only", tier: 1 }),
    ];
    setup(moments);

    expect(screen.getByRole("heading", { name: /core/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /important/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /supporting/i })).not.toBeInTheDocument();
  });
});

// AC3: Each moment card shows name, description, lens badges, roles, and product surfaces
describe("moment card content", () => {
  test("shows name and description", () => {
    setup([
      makeMoment({
        name: "Onboarding Success",
        description: "User completes onboarding and sees first value",
      }),
    ]);

    expect(screen.getByText("Onboarding Success")).toBeInTheDocument();
    expect(
      screen.getByText("User completes onboarding and sees first value")
    ).toBeInTheDocument();
  });

  test("shows lens badges", () => {
    setup([
      makeMoment({
        lenses: ["jtbd", "outcomes", "pains"],
      }),
    ]);

    expect(screen.getByText("jtbd")).toBeInTheDocument();
    expect(screen.getByText("outcomes")).toBeInTheDocument();
    expect(screen.getByText("pains")).toBeInTheDocument();
  });

  test("shows roles", () => {
    setup([
      makeMoment({
        roles: ["Product Manager", "Developer"],
      }),
    ]);

    expect(screen.getByText("Product Manager")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
  });

  test("shows product surfaces", () => {
    setup([
      makeMoment({
        product_surfaces: ["Dashboard", "Settings Page"],
      }),
    ]);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Settings Page")).toBeInTheDocument();
  });
});

// AC4: Tier color coding: Tier 1 = indigo, Tier 2 = amber, Tier 3 = gray
describe("tier color coding", () => {
  test("tier 1 section is rendered with data-tier attribute", () => {
    setup([makeMoment({ id: "vm-1", name: "Core Moment", tier: 1 })]);

    const section = screen.getByTestId("tier-1");
    expect(section).toBeInTheDocument();
  });

  test("tier 1 heading has indigo styling", () => {
    setup([makeMoment({ id: "vm-1", name: "Core Moment", tier: 1 })]);

    const heading = screen.getByRole("heading", { name: /core/i });
    expect(heading).toHaveClass("text-indigo-900");
  });

  test("tier 2 heading has amber styling", () => {
    setup([makeMoment({ id: "vm-1", name: "Important Moment", tier: 2 })]);

    const heading = screen.getByRole("heading", { name: /important/i });
    expect(heading).toHaveClass("text-amber-900");
  });

  test("tier 3 heading has gray styling", () => {
    setup([makeMoment({ id: "vm-1", name: "Supporting Moment", tier: 3 })]);

    const heading = screen.getByRole("heading", { name: /supporting/i });
    expect(heading).toHaveClass("text-gray-700");
  });
});

// AC5: Empty state renders when no value moments exist
describe("empty state", () => {
  test("renders empty state when no moments provided", () => {
    setup([]);

    expect(screen.getByText(/no value moments/i)).toBeInTheDocument();
  });

  test("does not render stats bar when empty", () => {
    setup([]);

    expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
  });
});
