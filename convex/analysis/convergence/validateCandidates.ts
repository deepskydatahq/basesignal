import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { computeTfIdfVectors, cosineSimilarity } from "../../lib/similarity";
import type {
  LensResult,
  LensCandidate,
  ValidatedCandidate,
} from "./types";

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

// --- LLM Integration ---

/** Parse Claude's JSON response, handling code fences */
export function parseLlmResponse(
  responseText: string
): Array<{
  id: string;
  action: "confirm_flag" | "override_valid" | "remove";
  rewritten_name?: string;
  rewritten_description?: string;
  validation_issue?: string;
}> {
  const fenceMatch = responseText.match(
    /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/
  );
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();
  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from LLM response");
  }

  return parsed;
}

const VALIDATION_SYSTEM_PROMPT = `You are a product value analyst. Review flagged value moment candidates and determine the correct action.

For each candidate:
- "confirm_flag": The flag is correct. Provide a rewritten_name and rewritten_description that reframes it as an outcome ("Users achieve X" not "Use the Y feature"). Also provide validation_issue explaining the problem.
- "override_valid": The flag was incorrect, the candidate is actually valid. Provide validation_issue explaining why the flag was wrong.
- "remove": The candidate should be removed entirely. Provide validation_issue explaining why.

Return a JSON array. Example:
[
  {
    "id": "candidate_id",
    "action": "confirm_flag",
    "rewritten_name": "Outcome-focused name",
    "rewritten_description": "Users achieve specific measurable outcome through this capability",
    "validation_issue": "Original was feature-as-value: started with 'Use the...'"
  }
]

Rules:
- Return ONLY valid JSON array, no commentary
- Every rewritten description should be outcome-focused and specific
- Prefer "confirm_flag" with rewrite over "remove" when an outcome can be inferred
- Use "remove" only when no meaningful outcome can be extracted`;

function buildLlmPrompt(
  flaggedCandidates: Array<{
    id: string;
    name: string;
    description: string;
    lens: string;
    flags: string[];
  }>,
  knownFeatures: string[]
): string {
  const candidateList = flaggedCandidates
    .map(
      (c) =>
        `- ID: ${c.id}\n  Lens: ${c.lens}\n  Name: ${c.name}\n  Description: ${c.description}\n  Flags: ${c.flags.join(", ")}`
    )
    .join("\n\n");

  return `Review these flagged value moment candidates:

${candidateList}

Known product features for reference: ${knownFeatures.length > 0 ? knownFeatures.join(", ") : "(none available)"}

For each candidate, determine the action and provide rewrites where appropriate.`;
}

// --- Orchestrator ---

/**
 * Validate lens candidates: run deterministic checks, then LLM review for flagged ones.
 *
 * Flow:
 * 1. Load product profile for knowledge graph
 * 2. Run deterministic checks on all candidates
 * 3. Find duplicates within each lens
 * 4. Send flagged candidates to Claude Haiku for judgment/rewriting
 * 5. Merge results and return ValidatedCandidate[]
 */
export const validateCandidatesAction = internalAction({
  args: {
    lensResults: v.any(),
    productId: v.id("products"),
  },
  handler: async (ctx, args): Promise<ValidatedCandidate[]> => {
    const lensResults = args.lensResults as LensResult[];

    // 1. Load product profile
    const profile = await ctx.runQuery(
      internal.productProfiles.getInternal,
      { productId: args.productId }
    );
    const knownFeatures = profile
      ? buildKnownFeaturesSet(profile)
      : new Set<string>();

    // 2. Run validation pipeline
    return runValidationPipeline(lensResults, knownFeatures);
  },
});

/**
 * Pure validation pipeline (testable without Convex runtime).
 * Runs deterministic checks, dedup, and returns candidates with flags.
 * LLM rewriting is handled separately by the orchestrator.
 */
export function runValidationPipeline(
  lensResults: LensResult[],
  knownFeatures: Set<string>
): ValidatedCandidate[] {
  const results: ValidatedCandidate[] = [];
  const flaggedForLlm: Array<{
    id: string;
    name: string;
    description: string;
    lens: string;
    flags: string[];
  }> = [];

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
          lens,
          validation_status: "removed",
          validation_issue: `Duplicate of ${dupeInfo?.keep} (similarity: ${dupeInfo?.similarity.toFixed(2)})`,
          source_urls: candidate.source_urls,
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

      const featureRefFlag = hasUnverifiedFeatureRef(
        candidate.description,
        knownFeatures
      );
      if (featureRefFlag) flags.push(featureRefFlag);

      if (flags.length > 0) {
        // Flagged - add to LLM review queue
        flaggedForLlm.push({
          id: candidate.id,
          name: candidate.name,
          description: candidate.description,
          lens,
          flags,
        });
        // Placeholder entry - will be updated after LLM review
        results.push({
          id: candidate.id,
          name: candidate.name,
          description: candidate.description,
          lens,
          validation_status: "rewritten",
          validation_issue: flags.join("; "),
          source_urls: candidate.source_urls,
        });
      } else {
        results.push({
          id: candidate.id,
          name: candidate.name,
          description: candidate.description,
          lens,
          validation_status: "valid",
          source_urls: candidate.source_urls,
        });
      }
    }
  }

  return results;
}

/**
 * Call Claude Haiku to review flagged candidates and apply rewrites.
 * Returns the updated results array with LLM judgments applied.
 */
export async function applyLlmReview(
  results: ValidatedCandidate[],
  flaggedCandidates: Array<{
    id: string;
    name: string;
    description: string;
    lens: string;
    flags: string[];
  }>,
  knownFeatures: Set<string>
): Promise<ValidatedCandidate[]> {
  if (flaggedCandidates.length === 0) return results;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Graceful degradation: keep deterministic flags without rewriting
    return results;
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildLlmPrompt(
    flaggedCandidates,
    Array.from(knownFeatures)
  );

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: VALIDATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const llmResults = parseLlmResponse(textContent);

    // Apply LLM results back to our validated candidates
    for (const llmResult of llmResults) {
      const idx = results.findIndex((r) => r.id === llmResult.id);
      if (idx === -1) continue;

      if (llmResult.action === "override_valid") {
        results[idx].validation_status = "valid";
        results[idx].validation_issue = llmResult.validation_issue;
      } else if (llmResult.action === "remove") {
        results[idx].validation_status = "removed";
        results[idx].validation_issue = llmResult.validation_issue;
      } else if (llmResult.action === "confirm_flag") {
        results[idx].validation_status = "rewritten";
        results[idx].validation_issue = llmResult.validation_issue;
        if (llmResult.rewritten_name || llmResult.rewritten_description) {
          results[idx].rewritten_from = {
            name: results[idx].name,
            description: results[idx].description,
          };
          if (llmResult.rewritten_name) {
            results[idx].name = llmResult.rewritten_name;
          }
          if (llmResult.rewritten_description) {
            results[idx].description = llmResult.rewritten_description;
          }
        }
      }
    }
  } catch {
    // Graceful degradation: keep deterministic flags if LLM fails
  }

  return results;
}
