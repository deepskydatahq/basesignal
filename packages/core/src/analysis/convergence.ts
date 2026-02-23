/**
 * Convergence and tiering logic — extracted from convex/analysis/convergence/convergeAndTier.ts.
 *
 * Pure functions for merging candidate clusters into tiered value moments,
 * with optional LLM-powered semantic merge descriptions.
 */

import type {
  CandidateCluster,
  ValueMoment,
  ValueMomentTier,
  ConvergenceResult,
  QualityStatus,
  QualityCheck,
  QualityReport,
} from "./convergence-types";

import { momentIdFromName } from "../slugify";

// --- LlmProvider type ---

/**
 * A function that sends a prompt to an LLM and returns the text response.
 * Consumers wrap their preferred SDK into this shape.
 */
export type LlmProvider = (prompt: string, system: string) => Promise<string>;

export interface ConvergeOptions {
  /** Optional LLM provider for semantic merge descriptions. Without it, uses directMerge(). */
  llmProvider?: LlmProvider;
}

// --- Pure functions ---

/**
 * Assign a tier based on lens count.
 * 4+ lenses = Tier 1, 2-3 = Tier 2, 1 = Tier 3.
 */
export function assignTier(lensCount: number): ValueMomentTier {
  if (lensCount >= 4) return 1; // 4+ lenses = T1
  if (lensCount >= 2) return 2; // 2-3 lenses = T2
  return 3; // 1 lens = T3
}

/**
 * Parse the LLM merge response to extract structured fields.
 * Handles JSON wrapped in code fences or raw JSON.
 */
export function parseMergeResponse(text: string): {
  name: string;
  description: string;
  roles: string[];
  product_surfaces: string[];
  is_coherent: boolean;
} {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();

  const parsed = JSON.parse(jsonStr);

  const required = ["name", "description", "roles", "product_surfaces", "is_coherent"];
  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate name starts with a verb (first word should be capitalized action word)
  const firstWord = String(parsed.name).split(/\s+/)[0];
  if (!firstWord || firstWord[0] !== firstWord[0].toUpperCase()) {
    throw new Error(`Name must start with a verb: "${parsed.name}"`);
  }

  return {
    name: String(parsed.name),
    description: String(parsed.description),
    roles: Array.isArray(parsed.roles) ? parsed.roles.map(String) : [],
    product_surfaces: Array.isArray(parsed.product_surfaces)
      ? parsed.product_surfaces.map(String)
      : [],
    is_coherent: Boolean(parsed.is_coherent),
  };
}

/**
 * Fallback merge that constructs a ValueMoment without LLM.
 * Used when LLM call fails or no LLM provider is given.
 */
export function directMerge(cluster: CandidateCluster, existingIds?: Set<string>): ValueMoment {
  const name = "Achieve " + cluster.candidates.map((c) => c.name).join(" / ");
  const description = cluster.candidates.map((c) => c.description).join(" ");
  const roles = [...new Set(cluster.candidates.flatMap(() => [] as string[]))];
  const productSurfaces = [...new Set(cluster.candidates.flatMap(() => [] as string[]))];

  return {
    id: momentIdFromName(name, existingIds),
    name,
    description,
    tier: assignTier(cluster.lens_count),
    lenses: cluster.lenses,
    lens_count: cluster.lens_count,
    roles,
    product_surfaces: productSurfaces,
    contributing_candidates: cluster.candidates.map((c) => c.id),
  };
}

/**
 * Cap tier distribution to produce a useful tiered set.
 * - Max 3 T1 moments: demote excess to T2 (lowest contributing_candidates count first)
 * - Max 20 T3 moments: drop excess (lowest contributing_candidates count first)
 * Ranking: more contributing_candidates = higher priority to keep.
 */
export function capTierDistribution(moments: ValueMoment[]): ValueMoment[] {
  const maxT1 = 3;
  const maxT3 = 20;

  let result = [...moments];

  // Cap T1: demote excess to T2
  const t1 = result.filter((m) => m.tier === 1);
  if (t1.length > maxT1) {
    // Sort ascending by contributing_candidates count — demote from the front (fewest candidates)
    const sorted = [...t1].sort(
      (a, b) => a.contributing_candidates.length - b.contributing_candidates.length
    );
    const toDemote = new Set(sorted.slice(0, t1.length - maxT1).map((m) => m.id));
    result = result.map((m) =>
      toDemote.has(m.id) ? { ...m, tier: 2 as ValueMomentTier } : m
    );
  }

  // Cap T3: drop excess
  const t3 = result.filter((m) => m.tier === 3);
  if (t3.length > maxT3) {
    const sorted = [...t3].sort(
      (a, b) => a.contributing_candidates.length - b.contributing_candidates.length
    );
    const toDrop = new Set(sorted.slice(0, t3.length - maxT3).map((m) => m.id));
    result = result.filter((m) => !toDrop.has(m.id));
  }

  return result;
}

/**
 * Business-oriented verbs that indicate non-experiential naming.
 * Names starting with these verbs describe business outcomes, not user actions.
 */
export const BUSINESS_VERBS = [
  "Gain", "Reduce", "Accelerate", "Optimize", "Streamline",
  "Automate", "Leverage", "Enable", "Enhance", "Empower",
  "Transform", "Revolutionize",
] as const;

/**
 * User-action verbs that indicate experiential naming.
 * Names starting with these verbs describe what a user actually does.
 */
export const USER_ACTION_VERBS = [
  "Create", "Share", "Export", "Build", "Drag", "Invite",
  "Comment", "Vote", "Upload", "Filter", "Tag", "Open",
  "View", "Configure", "Set", "Move",
] as const;

/**
 * Check if a value moment name uses a business verb instead of a user-action verb.
 * Returns true if the name starts with a business verb (i.e. is non-experiential).
 */
export function isBusinessVerb(name: string): boolean {
  const firstWord = name.trim().split(/\s+/)[0];
  return BUSINESS_VERBS.some((verb) => firstWord === verb);
}

/**
 * Validate convergence output quality. Non-blocking — returns a report
 * with pass/warn/fail per check.
 *
 * Checks:
 * - tier_distribution: T1 1-5, T2 2-10, T3 <=20
 * - total_count: between 10 and 35 moments
 * - empty_fields: no moments with empty name or description
 * - experiential_names: warn if any moment names use business verbs instead of user-action verbs
 */
export function validateConvergenceQuality(result: ConvergenceResult): QualityReport {
  const checks: QualityCheck[] = [];

  // Check tier distribution: T1: 1-5, T2: 2-10, T3: <=20
  const t1 = result.stats.tier_1_count;
  const t2 = result.stats.tier_2_count;
  const t3 = result.stats.tier_3_count;

  let tierStatus: QualityStatus = "pass";
  const tierIssues: string[] = [];
  if (t1 < 1) { tierStatus = "fail"; tierIssues.push(`T1 count ${t1} below minimum 1`); }
  else if (t1 > 5) { tierStatus = "warn"; tierIssues.push(`T1 count ${t1} above recommended 5`); }
  if (t2 < 2) {
    tierStatus = tierStatus === "fail" ? "fail" : "warn";
    tierIssues.push(`T2 count ${t2} below minimum 2`);
  } else if (t2 > 10) {
    tierStatus = tierStatus === "fail" ? "fail" : "warn";
    tierIssues.push(`T2 count ${t2} above recommended 10`);
  }
  if (t3 > 20) {
    tierStatus = tierStatus === "fail" ? "fail" : "warn";
    tierIssues.push(`T3 count ${t3} above maximum 20`);
  }

  checks.push({
    name: "tier_distribution",
    status: tierStatus,
    message: tierIssues.length > 0 ? tierIssues.join("; ") : `T1: ${t1}, T2: ${t2}, T3: ${t3}`,
  });

  // Check total count: 10-35
  const total = result.stats.total_moments;
  let countStatus: QualityStatus = "pass";
  let countMessage = `${total} moments`;
  if (total < 10) { countStatus = "fail"; countMessage = `${total} moments below minimum 10`; }
  else if (total > 35) { countStatus = "warn"; countMessage = `${total} moments above recommended 35`; }

  checks.push({ name: "total_count", status: countStatus, message: countMessage });

  // Check empty fields
  const emptyNames = result.value_moments.filter((m) => !m.name.trim());
  const emptyDescs = result.value_moments.filter((m) => !m.description.trim());
  const emptyCount = emptyNames.length + emptyDescs.length;

  let emptyStatus: QualityStatus = "pass";
  let emptyMessage = "No empty fields";
  if (emptyCount > 0) {
    emptyStatus = "warn";
    const parts: string[] = [];
    if (emptyNames.length > 0) parts.push(`${emptyNames.length} empty name(s)`);
    if (emptyDescs.length > 0) parts.push(`${emptyDescs.length} empty description(s)`);
    emptyMessage = parts.join("; ");
  }

  checks.push({ name: "empty_fields", status: emptyStatus, message: emptyMessage });

  // Check experiential names: warn if any moment names use business verbs
  const businessVerbMoments = result.value_moments.filter((m) => isBusinessVerb(m.name));
  let experientialStatus: QualityStatus = "pass";
  let experientialMessage = "All names use experiential verbs";
  if (businessVerbMoments.length > 0) {
    experientialStatus = "warn";
    const examples = businessVerbMoments.slice(0, 3).map((m) => `"${m.name}"`);
    experientialMessage = `${businessVerbMoments.length} moment(s) use business verbs: ${examples.join(", ")}`;
  }

  checks.push({ name: "experiential_names", status: experientialStatus, message: experientialMessage });

  // Overall: worst status across all checks (fail > warn > pass)
  const statusPriority: Record<QualityStatus, number> = { pass: 0, warn: 1, fail: 2 };
  const overall = checks.reduce<QualityStatus>(
    (worst, check) => (statusPriority[check.status] > statusPriority[worst] ? check.status : worst),
    "pass"
  );

  return { overall, checks };
}

// --- LLM merge ---

export const MERGE_SYSTEM_PROMPT = `You are a product analyst merging value moment candidates into a single named value moment.

You will receive a cluster of candidates from different analytical lenses that describe similar value a product provides to users.

Your job:
1. Merge them into ONE cohesive value moment
2. The name MUST start with a user-action verb (e.g., "Create a dashboard from...", "Share report with...", "Export data to...", "Build workflow in...")
3. Describe what happens on the user's screen, not what the business achieves
4. Combine insights from ALL contributing lenses into the description
5. Identify roles (user types) who benefit
6. Identify product surfaces (features/areas) involved

Name format: "Verb + what the user does + where in the product"

Good names vs bad names:
- GOOD: "Drag tasks between columns on the board" — describes a user action with an observable result
- BAD: "Gain visibility into project status" — describes a business outcome, not a user action
- GOOD: "Invite teammates to a shared workspace" — specific screen action
- BAD: "Accelerate team onboarding" — abstract business goal
- GOOD: "View real-time deployment status in the pipeline dashboard" — observable screen state
- BAD: "Reduce deployment risk" — unmeasurable business aspiration

Return JSON in code fences:
\`\`\`json
{
  "name": "Verb + what the user does + where in the product",
  "description": "Combined description synthesizing all lens insights",
  "roles": ["role1", "role2"],
  "product_surfaces": ["feature1", "area2"],
  "is_coherent": true
}
\`\`\`

Rules:
- name MUST start with a capitalized user-action verb (Create, Share, Export, Build, Drag, Invite, Comment, View, Filter, Configure, etc.)
- description should reference the specific insights from each lens, not just generic summary
- Set is_coherent to false ONLY if the candidates seem unrelated despite clustering
- Return ONLY the JSON, no commentary`;

/**
 * Build the user prompt for a single cluster merge.
 */
export function buildMergePrompt(cluster: CandidateCluster): string {
  const candidateLines = cluster.candidates
    .map(
      (c, i) =>
        `Candidate ${i + 1} (${c.lens} lens):\n  Name: ${c.name}\n  Description: ${c.description}`
    )
    .join("\n\n");

  return `Merge these ${cluster.candidates.length} candidates from ${cluster.lens_count} different lenses into a single value moment:\n\n${candidateLines}`;
}

// --- Refactored converge() ---

/**
 * Merge clusters into named, tiered value moments.
 * With llmProvider: calls LLM per cluster for rich merge descriptions.
 * Without llmProvider: uses directMerge() for deterministic fallback.
 */
export async function converge(
  clusters: CandidateCluster[],
  options?: ConvergeOptions
): Promise<ValueMoment[]> {
  const usedIds = new Set<string>();

  if (!options?.llmProvider) {
    return clusters.map((cluster) => {
      const moment = directMerge(cluster, usedIds);
      usedIds.add(moment.id);
      return moment;
    });
  }

  const results = await Promise.allSettled(
    clusters.map(async (cluster): Promise<ValueMoment> => {
      const prompt = buildMergePrompt(cluster);
      const text = await options.llmProvider!(prompt, MERGE_SYSTEM_PROMPT);
      const parsed = parseMergeResponse(text);

      return {
        id: "", // placeholder — assigned sequentially below for dedup
        name: parsed.name,
        description: parsed.description,
        tier: assignTier(cluster.lens_count),
        lenses: cluster.lenses,
        lens_count: cluster.lens_count,
        roles: parsed.roles,
        product_surfaces: parsed.product_surfaces,
        contributing_candidates: cluster.candidates.map((c) => c.id),
      };
    })
  );

  return results.map((result, i) => {
    const moment = result.status === "fulfilled" ? result.value : directMerge(clusters[i]);
    const id = momentIdFromName(moment.name, usedIds);
    usedIds.add(id);
    return { ...moment, id };
  });
}

// --- Full pipeline ---

/**
 * Run the full convergence pipeline: merge clusters, cap tiers, compute stats, validate quality.
 */
export async function runConvergence(
  clusters: CandidateCluster[],
  totalCandidates: number,
  options?: ConvergeOptions
): Promise<ConvergenceResult> {
  const rawMoments = await converge(clusters, options);
  const valueMoments = capTierDistribution(rawMoments);

  const result: ConvergenceResult = {
    value_moments: valueMoments,
    clusters,
    stats: {
      total_candidates: totalCandidates,
      total_clusters: clusters.length,
      total_moments: valueMoments.length,
      tier_1_count: valueMoments.filter((m) => m.tier === 1).length,
      tier_2_count: valueMoments.filter((m) => m.tier === 2).length,
      tier_3_count: valueMoments.filter((m) => m.tier === 3).length,
    },
  };

  result.quality = validateConvergenceQuality(result);
  return result;
}

// --- Re-exports for convenience ---

export type {
  ValueMomentTier,
  ValueMoment,
  CandidateCluster,
  QualityStatus,
  QualityCheck,
  QualityReport,
  ConvergenceResult,
  ExperientialLensType,
  ValidatedCandidate,
} from "./convergence-types";
