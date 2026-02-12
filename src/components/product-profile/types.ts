// Frontend types for product profile components
// Mirrors convex/analysis/convergence/types.ts for use in React components

export type LensType =
  | "jtbd"
  | "outcomes"
  | "pains"
  | "gains"
  | "alternatives"
  | "workflows"
  | "emotions";

export type ValueMomentTier = 1 | 2 | 3;

export interface ValueMoment {
  id: string;
  name: string;
  description: string;
  tier: ValueMomentTier;
  lenses: LensType[];
  lens_count: number;
  roles: string[];
  product_surfaces: string[];
  contributing_candidates: string[];
}
