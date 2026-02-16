import { computeTfIdfVectors, cosineSimilarity } from "./similarity";
import type { ValidatedCandidate } from "../types/convergence";

// --- Types ---

/** Input shape for the validation pipeline. */
export interface ValidationLensResult {
  lens: string;
  candidates: Array<{
    id: string;
    name: string;
    description: string;
    source_urls?: string[];
  }>;
}

// --- Constants ---

/** Regex patterns that indicate a feature disguised as a value proposition */
export const FEATURE_AS_VALUE_PATTERNS: RegExp[] = [
  /^use the\b/i,
  /^click the\b/i,
  /^open the\b/i,
  /^navigate to\b/i,
  /^select the\b/i,
  /^enable\b/i,
  /^toggle\b/i,
  /^turn on\b/i,
  /^activate the\b/i,
  /^go to\b/i,
];

/** Regex patterns that indicate marketing/business-speak rather than user experience */
export const MARKETING_LANGUAGE_PATTERNS: RegExp[] = [
  /\bautomate\b/i,
  /\bstreamline\b/i,
  /\boptimize\b/i,
  /\bleverage\b/i,
  /\benhance\b/i,
  /\bempower\b/i,
  /\baccelerate\b/i,
  /\brevolutionize\b/i,
  /\btransform\b/i,
];

/** Abstract outcome phrases that indicate business jargon without specificity */
export const ABSTRACT_OUTCOME_PATTERNS: string[] = [
  "at scale",
  "cross-functional",
  "end-to-end",
  "enterprise-grade",
  "best-in-class",
  "next-generation",
];

/** Vague phrases that indicate a candidate lacks specificity */
export const VAGUE_PHRASES: string[] = [
  "better visibility",
  "improved efficiency",
  "enhanced experience",
  "streamlined workflow",
  "greater insights",
  "increased productivity",
  "better outcomes",
  "improved performance",
  "enhanced capabilities",
  "seamless integration",
  "intuitive interface",
  "powerful features",
  "actionable insights",
  "data-driven decisions",
];

// --- Deterministic Check Functions ---

/**
 * Check if a candidate is a feature disguised as a value proposition.
 * Tests both name and description against known patterns.
 * Returns explanation string if matched, null otherwise.
 */
export function isFeatureAsValue(
  name: string,
  description: string
): string | null {
  for (const pattern of FEATURE_AS_VALUE_PATTERNS) {
    if (pattern.test(name)) {
      return `Name starts with feature-action pattern: "${name.split(" ").slice(0, 3).join(" ")}..."`;
    }
    if (pattern.test(description)) {
      return `Description starts with feature-action pattern: "${description.split(" ").slice(0, 3).join(" ")}..."`;
    }
  }
  return null;
}

/**
 * Check if a candidate description is too vague to measure.
 * Matches against known vague phrase patterns (case-insensitive substring).
 * Returns explanation string if matched, null otherwise.
 */
export function isVagueCandidate(description: string): string | null {
  const lower = description.toLowerCase();
  for (const phrase of VAGUE_PHRASES) {
    if (lower.includes(phrase)) {
      return `Contains vague phrase: "${phrase}"`;
    }
  }
  return null;
}

/**
 * Check if a candidate uses marketing/business language without referencing specific product surfaces.
 * Matches against marketing verb patterns and abstract outcome phrases.
 * Does NOT flag if the candidate also references a known product feature (escape hatch).
 * Returns explanation string if matched, null otherwise.
 */
export function isMarketingLanguage(
  name: string,
  description: string,
  knownFeatures: Set<string>
): string | null {
  const combined = `${name} ${description}`;
  const lower = combined.toLowerCase();

  // Check if candidate references a known product surface — if so, don't flag
  for (const feature of knownFeatures) {
    if (lower.includes(feature)) {
      return null;
    }
  }

  // Check marketing verb patterns
  for (const pattern of MARKETING_LANGUAGE_PATTERNS) {
    if (pattern.test(combined)) {
      const match = combined.match(pattern);
      return `Contains marketing language: "${match?.[0]}"`;
    }
  }

  // Check abstract outcome phrases
  for (const phrase of ABSTRACT_OUTCOME_PATTERNS) {
    if (lower.includes(phrase)) {
      return `Contains abstract outcome phrase: "${phrase}"`;
    }
  }

  return null;
}

/**
 * Find duplicate candidates within a group (same lens) using TF-IDF cosine similarity.
 * Returns pairs of { keep, remove, similarity } for candidates above threshold.
 */
export function findWithinLensDuplicates(
  candidates: Array<{ id: string; name: string; description: string }>,
  threshold = 0.85
): Array<{ keep: string; remove: string; similarity: number }> {
  if (candidates.length < 2) return [];

  const texts = candidates.map((c) => `${c.name} ${c.description}`);
  const vectors = computeTfIdfVectors(texts);

  const removed = new Set<number>();
  const pairs: Array<{ keep: string; remove: string; similarity: number }> = [];

  for (let i = 0; i < candidates.length; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      if (removed.has(j)) continue;
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      if (sim >= threshold) {
        pairs.push({
          keep: candidates[i].id,
          remove: candidates[j].id,
          similarity: sim,
        });
        removed.add(j);
      }
    }
  }

  return pairs;
}

/**
 * Check if a description references features not in the known features set.
 * Extracts capitalized multi-word noun phrases and checks against known features.
 * Returns explanation for first unmatched phrase, null if all match or none found.
 */
export function hasUnverifiedFeatureRef(
  description: string,
  knownFeatures: Set<string>
): string | null {
  // Extract capitalized multi-word noun phrases (2+ words starting with uppercase)
  const matches = description.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g);
  if (!matches || matches.length === 0) return null;

  for (const phrase of matches) {
    if (!knownFeatures.has(phrase.toLowerCase())) {
      return `References unknown feature: "${phrase}"`;
    }
  }
  return null;
}

/**
 * Build a set of known feature names from a product profile.
 * Extracts from entities.items[].name and outcomes.items[].linkedFeatures.
 * All entries are lowercased for case-insensitive comparison.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildKnownFeaturesSet(profile: any): Set<string> {
  const features = new Set<string>();

  // Extract entity names
  if (profile?.entities?.items) {
    for (const entity of profile.entities.items) {
      if (entity.name) {
        features.add(entity.name.toLowerCase());
      }
    }
  }

  // Extract linked features from outcomes
  if (profile?.outcomes?.items) {
    for (const outcome of profile.outcomes.items) {
      if (Array.isArray(outcome.linkedFeatures)) {
        for (const feature of outcome.linkedFeatures) {
          features.add(feature.toLowerCase());
        }
      }
    }
  }

  return features;
}

// --- Orchestrator ---

/**
 * Pure validation pipeline (testable without Convex runtime).
 * Runs deterministic checks, dedup, and returns candidates with flags.
 * LLM rewriting is handled separately by the orchestrator.
 */
export function runValidationPipeline(
  lensResults: ValidationLensResult[],
  knownFeatures: Set<string>
): ValidatedCandidate[] {
  const results: ValidatedCandidate[] = [];

  // Group by lens for within-lens duplicate detection
  for (const lensResult of lensResults) {
    const { lens, candidates } = lensResult;

    // Find duplicates within this lens
    const dupes = findWithinLensDuplicates(candidates);
    const removedIds = new Set(dupes.map((d) => d.remove));

    for (const candidate of candidates) {
      // If marked as duplicate, remove it
      if (removedIds.has(candidate.id)) {
        const dupeInfo = dupes.find((d) => d.remove === candidate.id);
        results.push({
          id: candidate.id,
          name: candidate.name,
          description: candidate.description,
          lens: lens as ValidatedCandidate["lens"],
          confidence: 0,
          validation_status: "removed",
          validation_issue: `Duplicate of ${dupeInfo?.keep} (similarity: ${dupeInfo?.similarity.toFixed(2)})`,
        });
        continue;
      }

      // Run deterministic checks
      const flags: string[] = [];

      const featureFlag = isFeatureAsValue(
        candidate.name,
        candidate.description
      );
      if (featureFlag) flags.push(featureFlag);

      const vagueFlag = isVagueCandidate(candidate.description);
      if (vagueFlag) flags.push(vagueFlag);

      const marketingFlag = isMarketingLanguage(
        candidate.name,
        candidate.description,
        knownFeatures
      );
      if (marketingFlag) flags.push(marketingFlag);

      const featureRefFlag = hasUnverifiedFeatureRef(
        candidate.description,
        knownFeatures
      );
      if (featureRefFlag) flags.push(featureRefFlag);

      if (flags.length > 0) {
        // Flagged - add to LLM review queue
        // Placeholder entry - will be updated after LLM review
        results.push({
          id: candidate.id,
          name: candidate.name,
          description: candidate.description,
          lens: lens as ValidatedCandidate["lens"],
          confidence: 0,
          validation_status: "rewritten",
          validation_issue: flags.join("; "),
        });
      } else {
        results.push({
          id: candidate.id,
          name: candidate.name,
          description: candidate.description,
          lens: lens as ValidatedCandidate["lens"],
          confidence: 0,
          validation_status: "valid",
        });
      }
    }
  }

  return results;
}
