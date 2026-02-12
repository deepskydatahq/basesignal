import { describe, it, expect } from "vitest";
import { aggregateICPInputsCore } from "./aggregateICPInputs";
import type { ValueMoment, LensType, ValueMomentTier } from "../convergence/types";

function makeValueMoment(
  overrides: Partial<ValueMoment> & { id: string; name: string }
): ValueMoment {
  return {
    description: `Description for ${overrides.name}`,
    tier: 2 as ValueMomentTier,
    lenses: ["jtbd"] as LensType[],
    lens_count: 1,
    roles: [],
    product_surfaces: [],
    contributing_candidates: [],
    ...overrides,
  };
}

describe("aggregateICPInputsCore", () => {
  it("fan-out groups: same moment appears under multiple roles", () => {
    const vm = makeValueMoment({
      id: "vm-1",
      name: "Track progress",
      roles: ["PM", "Engineer"],
    });

    const result = aggregateICPInputsCore([vm], "");

    expect(result.roles).toHaveLength(2);

    const pmRole = result.roles.find((r) => r.name === "PM");
    const engRole = result.roles.find((r) => r.name === "Engineer");
    expect(pmRole).toBeDefined();
    expect(engRole).toBeDefined();
    expect(pmRole!.value_moments).toContain(vm);
    expect(engRole!.value_moments).toContain(vm);
  });

  it("collects unique roles with .trim() normalization", () => {
    const vm1 = makeValueMoment({
      id: "vm-1",
      name: "Track progress",
      roles: [" PM "],
    });
    const vm2 = makeValueMoment({
      id: "vm-2",
      name: "Monitor velocity",
      roles: ["PM"],
    });

    const result = aggregateICPInputsCore([vm1, vm2], "");

    expect(result.roles).toHaveLength(1);
    expect(result.roles[0].name).toBe("PM");
    expect(result.roles[0].occurrence_count).toBe(2);
    expect(result.roles[0].value_moments).toHaveLength(2);
  });

  it("skips empty role strings", () => {
    const vm = makeValueMoment({
      id: "vm-1",
      name: "Track progress",
      roles: ["PM", "", "  "],
    });

    const result = aggregateICPInputsCore([vm], "");

    expect(result.roles).toHaveLength(1);
    expect(result.roles[0].name).toBe("PM");
  });

  it("does NOT add phantom role when targetCustomer is empty", () => {
    const vm = makeValueMoment({
      id: "vm-1",
      name: "Track progress",
      roles: ["PM"],
    });

    const result = aggregateICPInputsCore([vm], "");

    expect(result.roles).toHaveLength(1);
    expect(result.target_customer).toBe("");
  });

  it("adds targetCustomer as phantom role when not already present", () => {
    const vm = makeValueMoment({
      id: "vm-1",
      name: "Track progress",
      roles: ["PM"],
    });

    const result = aggregateICPInputsCore([vm], "B2B SaaS teams");

    expect(result.roles).toHaveLength(2);

    const phantom = result.roles.find((r) => r.name === "B2B SaaS teams");
    expect(phantom).toBeDefined();
    expect(phantom!.occurrence_count).toBe(0);
    expect(phantom!.value_moments).toHaveLength(0);
    expect(phantom!.tier_1_moments).toBe(0);
    expect(phantom!.tier_2_moments).toBe(0);
    expect(phantom!.tier_3_plus_moments).toBe(0);
  });

  it("does NOT duplicate targetCustomer when already a role", () => {
    const vm = makeValueMoment({
      id: "vm-1",
      name: "Track progress",
      roles: ["PM"],
    });

    const result = aggregateICPInputsCore([vm], "PM");

    expect(result.roles).toHaveLength(1);
    expect(result.roles[0].name).toBe("PM");
    expect(result.roles[0].occurrence_count).toBe(1);
  });

  it("sorts by weighted score: tier_1*5 + tier_2*2 + occurrence_count", () => {
    const vm1 = makeValueMoment({
      id: "vm-1",
      name: "Moment A",
      tier: 1,
      roles: ["Designer"],
    });
    const vm2 = makeValueMoment({
      id: "vm-2",
      name: "Moment B",
      tier: 1,
      roles: ["PM"],
    });
    const vm3 = makeValueMoment({
      id: "vm-3",
      name: "Moment C",
      tier: 1,
      roles: ["PM"],
    });
    const vm4 = makeValueMoment({
      id: "vm-4",
      name: "Moment D",
      tier: 2,
      roles: ["Engineer"],
    });
    const vm5 = makeValueMoment({
      id: "vm-5",
      name: "Moment E",
      tier: 2,
      roles: ["Engineer"],
    });
    const vm6 = makeValueMoment({
      id: "vm-6",
      name: "Moment F",
      tier: 2,
      roles: ["Engineer"],
    });

    const result = aggregateICPInputsCore(
      [vm1, vm2, vm3, vm4, vm5, vm6],
      ""
    );

    // PM: 2 T1, 0 T2, 2 total → score = 2*5 + 0*2 + 2 = 12
    // Engineer: 0 T1, 3 T2, 3 total → score = 0*5 + 3*2 + 3 = 9
    // Designer: 1 T1, 0 T2, 1 total → score = 1*5 + 0*2 + 1 = 6
    expect(result.roles[0].name).toBe("PM");
    expect(result.roles[0].tier_1_moments).toBe(2);
    expect(result.roles[1].name).toBe("Engineer");
    expect(result.roles[1].tier_2_moments).toBe(3);
    expect(result.roles[2].name).toBe("Designer");
    expect(result.roles[2].tier_1_moments).toBe(1);
  });

  it("2 T1 moments outranks 10 T3 moments", () => {
    // Role with 2 T1: score = 2*5 + 0*2 + 2 = 12
    // Role with 10 T3: score = 0*5 + 0*2 + 10 = 10
    const t1Moments = Array.from({ length: 2 }, (_, i) =>
      makeValueMoment({ id: `t1-${i}`, name: `T1 ${i}`, tier: 1, roles: ["Strategic PM"] })
    );
    const t3Moments = Array.from({ length: 10 }, (_, i) =>
      makeValueMoment({ id: `t3-${i}`, name: `T3 ${i}`, tier: 3, roles: ["Analyst"] })
    );

    const result = aggregateICPInputsCore([...t1Moments, ...t3Moments], "");

    expect(result.roles[0].name).toBe("Strategic PM");
    expect(result.roles[0].tier_1_moments).toBe(2);
    expect(result.roles[1].name).toBe("Analyst");
    expect(result.roles[1].tier_3_plus_moments).toBe(10);
  });

  it("roles with only T3+ moments sort to the bottom", () => {
    const vm1 = makeValueMoment({ id: "vm-1", name: "A", tier: 1, roles: ["Lead"] });
    const vm2 = makeValueMoment({ id: "vm-2", name: "B", tier: 2, roles: ["Mid"] });
    const vm3 = makeValueMoment({ id: "vm-3", name: "C", tier: 3, roles: ["Junior"] });
    const vm4 = makeValueMoment({ id: "vm-4", name: "D", tier: 3, roles: ["Junior"] });

    const result = aggregateICPInputsCore([vm1, vm2, vm3, vm4], "");

    // Lead: 1 T1 → score = 5 + 0 + 1 = 6
    // Mid: 1 T2 → score = 0 + 2 + 1 = 3
    // Junior: 2 T3 → score = 0 + 0 + 2 = 2
    expect(result.roles[0].name).toBe("Lead");
    expect(result.roles[1].name).toBe("Mid");
    expect(result.roles[2].name).toBe("Junior");
    expect(result.roles[2].tier_3_plus_moments).toBe(2);
  });

  it("returns empty roles for empty value moments array", () => {
    const result = aggregateICPInputsCore([], "Some Target");

    expect(result.roles).toHaveLength(1); // phantom role
    expect(result.roles[0].name).toBe("Some Target");
    expect(result.roles[0].occurrence_count).toBe(0);
    expect(result.total_value_moments).toBe(0);
  });

  it("returns fully empty result for no moments and no target", () => {
    const result = aggregateICPInputsCore([], "");

    expect(result.roles).toHaveLength(0);
    expect(result.target_customer).toBe("");
    expect(result.total_value_moments).toBe(0);
  });

  it("counts value moments with empty roles in total but creates no role entries", () => {
    const vm = makeValueMoment({
      id: "vm-1",
      name: "No roles moment",
      roles: [],
    });

    const result = aggregateICPInputsCore([vm], "");

    expect(result.total_value_moments).toBe(1);
    expect(result.roles).toHaveLength(0);
  });
});

describe("aggregateICPInputsCore - Linear-like integration", () => {
  it("produces 4 distinct roles from realistic value moments", () => {
    const moments: ValueMoment[] = [
      makeValueMoment({
        id: "vm-1",
        name: "Prioritize feature requests by customer impact",
        tier: 1,
        lenses: ["jtbd", "outcomes", "pains", "gains", "workflows"],
        lens_count: 5,
        roles: ["Product Manager", "Engineering Lead"],
      }),
      makeValueMoment({
        id: "vm-2",
        name: "Track sprint velocity across teams",
        tier: 1,
        lenses: ["jtbd", "outcomes", "workflows"],
        lens_count: 3,
        roles: ["Engineering Lead", "Team Lead"],
      }),
      makeValueMoment({
        id: "vm-3",
        name: "Design system consistency enforcement",
        tier: 2,
        lenses: ["pains", "workflows"],
        lens_count: 2,
        roles: ["Designer", "Product Manager"],
      }),
      makeValueMoment({
        id: "vm-4",
        name: "Reduce context-switching between tools",
        tier: 1,
        lenses: ["pains", "gains", "alternatives", "jtbd"],
        lens_count: 4,
        roles: ["Engineering Lead", "Designer"],
      }),
      makeValueMoment({
        id: "vm-5",
        name: "Align roadmap to business outcomes",
        tier: 2,
        lenses: ["outcomes", "gains"],
        lens_count: 2,
        roles: ["Product Manager", "Team Lead"],
      }),
      makeValueMoment({
        id: "vm-6",
        name: "Automate status reporting",
        tier: 1,
        lenses: ["jtbd", "pains", "workflows", "gains", "alternatives"],
        lens_count: 5,
        roles: ["Team Lead"],
      }),
    ];

    const result = aggregateICPInputsCore(moments, "B2B SaaS product teams");

    // Should have 4 real roles + 1 phantom = 5 total
    expect(result.roles.length).toBeGreaterThanOrEqual(4);
    const roleNames = result.roles.map((r) => r.name);
    expect(roleNames).toContain("Product Manager");
    expect(roleNames).toContain("Engineering Lead");
    expect(roleNames).toContain("Designer");
    expect(roleNames).toContain("Team Lead");
    expect(roleNames).toContain("B2B SaaS product teams");

    // Verify fan-out: Engineering Lead appears in vm-1, vm-2, vm-4
    const engLead = result.roles.find((r) => r.name === "Engineering Lead")!;
    expect(engLead.occurrence_count).toBe(3);
    expect(engLead.tier_1_moments).toBe(3); // vm-1 (T1), vm-2 (T1), vm-4 (T1)
    expect(engLead.tier_2_moments).toBe(0);
    expect(engLead.tier_3_plus_moments).toBe(0);

    // Product Manager appears in vm-1, vm-3, vm-5
    const pm = result.roles.find((r) => r.name === "Product Manager")!;
    expect(pm.occurrence_count).toBe(3);
    expect(pm.tier_1_moments).toBe(1); // only vm-1 is tier 1
    expect(pm.tier_2_moments).toBe(2); // vm-3 (T2), vm-5 (T2)
    expect(pm.tier_3_plus_moments).toBe(0);

    // Team Lead: vm-2, vm-5, vm-6
    const teamLead = result.roles.find((r) => r.name === "Team Lead")!;
    expect(teamLead.occurrence_count).toBe(3);
    expect(teamLead.tier_1_moments).toBe(2); // vm-2 (T1), vm-6 (T1)
    expect(teamLead.tier_2_moments).toBe(1); // vm-5 (T2)
    expect(teamLead.tier_3_plus_moments).toBe(0);

    // Designer: vm-3, vm-4
    const designer = result.roles.find((r) => r.name === "Designer")!;
    expect(designer.occurrence_count).toBe(2);
    expect(designer.tier_1_moments).toBe(1); // vm-4 (T1)
    expect(designer.tier_2_moments).toBe(1); // vm-3 (T2)
    expect(designer.tier_3_plus_moments).toBe(0);

    // Verify sort order by weighted score: tier_1*5 + tier_2*2 + occurrence_count
    // Engineering Lead: 3*5 + 0*2 + 3 = 18
    // Team Lead: 2*5 + 1*2 + 3 = 15
    // Product Manager: 1*5 + 2*2 + 3 = 12
    // Designer: 1*5 + 1*2 + 2 = 9
    expect(result.roles[0].name).toBe("Engineering Lead");
    expect(result.roles[1].name).toBe("Team Lead");
    expect(result.roles[2].name).toBe("Product Manager");
    expect(result.roles[3].name).toBe("Designer");

    // Phantom role should be last (0 tier-1, 0 occurrences)
    expect(result.roles[4].name).toBe("B2B SaaS product teams");

    expect(result.total_value_moments).toBe(6);
    expect(result.target_customer).toBe("B2B SaaS product teams");
  });
});
