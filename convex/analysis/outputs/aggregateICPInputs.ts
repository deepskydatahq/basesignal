import { internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import type { ValueMoment, ConvergenceResult } from "../convergence/types";

// --- Type Definitions ---

export interface RoleAggregation {
  name: string;
  occurrence_count: number;
  value_moments: ValueMoment[];
  tier_1_moments: number;
  tier_2_moments: number;
  tier_3_plus_moments: number;
}

export interface ICPInputData {
  roles: RoleAggregation[];
  target_customer: string;
  total_value_moments: number;
}

// --- Pure Core Function ---

/**
 * Aggregate value moments into role-grouped input for ICP generation.
 *
 * Fan-out: each value moment appears under ALL its roles, preserving
 * multi-role signals for buying committee dynamics.
 *
 * Sorted by weighted score: tier_1 * 5 + tier_2 * 2 + occurrence_count.
 */
export function aggregateICPInputsCore(
  valueMoments: ValueMoment[],
  targetCustomer: string
): ICPInputData {
  const roleMap = new Map<string, ValueMoment[]>();

  for (const vm of valueMoments) {
    for (const role of vm.roles) {
      const normalized = role.trim();
      if (normalized === "") continue;

      const existing = roleMap.get(normalized);
      if (existing) {
        existing.push(vm);
      } else {
        roleMap.set(normalized, [vm]);
      }
    }
  }

  // Add targetCustomer as phantom role if non-empty and not already present
  const trimmedTarget = targetCustomer.trim();
  if (trimmedTarget !== "" && !roleMap.has(trimmedTarget)) {
    roleMap.set(trimmedTarget, []);
  }

  // Convert to RoleAggregation array
  const roles: RoleAggregation[] = [];
  for (const [name, moments] of roleMap) {
    roles.push({
      name,
      occurrence_count: moments.length,
      value_moments: moments,
      tier_1_moments: moments.filter((vm) => vm.tier === 1).length,
      tier_2_moments: moments.filter((vm) => vm.tier === 2).length,
      tier_3_plus_moments: moments.filter((vm) => vm.tier >= 3).length,
    });
  }

  // Sort by weighted score: tier_1 * 5 + tier_2 * 2 + occurrence_count
  const weightedScore = (r: RoleAggregation) =>
    r.tier_1_moments * 5 + r.tier_2_moments * 2 + r.occurrence_count;
  roles.sort((a, b) => weightedScore(b) - weightedScore(a));

  return {
    roles,
    target_customer: targetCustomer,
    total_value_moments: valueMoments.length,
  };
}

// --- Convex internalQuery Wrapper ---

export const aggregateICPInputs = internalQuery({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();

    if (!profile) {
      return { roles: [], target_customer: "", total_value_moments: 0 };
    }

    const convergence = profile.convergence as ConvergenceResult | undefined;
    const valueMoments = convergence?.value_moments ?? [];

    const identity = profile.identity as
      | { targetCustomer?: string }
      | undefined;
    const targetCustomer = identity?.targetCustomer ?? "";

    return aggregateICPInputsCore(valueMoments, targetCustomer);
  },
});
