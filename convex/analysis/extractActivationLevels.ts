export type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

export interface ActivationCriterion {
  action: string;
  count: number;
  timeWindow?: string;
}

export interface ActivationLevel {
  level: number;
  name: string;
  signalStrength: SignalStrength;
  criteria: ActivationCriterion[];
  reasoning: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

export interface ActivationLevelsResult {
  levels: ActivationLevel[];
  primaryActivation: number;
  overallConfidence: number;
}

const VALID_SIGNAL_STRENGTHS: SignalStrength[] = [
  "weak",
  "medium",
  "strong",
  "very_strong",
];

/**
 * Parse Claude's response text to extract the JSON activation levels object.
 * Handles responses with markdown code fences or raw JSON.
 */
export function parseActivationLevelsResponse(
  responseText: string
): ActivationLevelsResult {
  // Extract JSON from code fences first
  const fenceMatch = responseText.match(
    /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/
  );
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();

  const parsed = JSON.parse(jsonStr);

  // Validate top-level required fields
  if (!Array.isArray(parsed.levels)) {
    throw new Error("Missing required field: levels (must be array)");
  }
  if (typeof parsed.primaryActivation !== "number") {
    throw new Error(
      "Missing required field: primaryActivation (must be number)"
    );
  }
  if (typeof parsed.overallConfidence !== "number") {
    throw new Error(
      "Missing required field: overallConfidence (must be number)"
    );
  }

  // Validate each level
  for (const level of parsed.levels) {
    if (typeof level.level !== "number") {
      throw new Error("Level missing: level number");
    }
    if (typeof level.name !== "string") {
      throw new Error("Level missing: name");
    }
    if (!VALID_SIGNAL_STRENGTHS.includes(level.signalStrength)) {
      throw new Error(`Invalid signalStrength: ${level.signalStrength}`);
    }
    if (!Array.isArray(level.criteria)) {
      throw new Error("Level missing: criteria (must be array)");
    }
    if (typeof level.confidence !== "number") {
      throw new Error("Level missing: confidence");
    }

    // Validate each criterion
    for (const criterion of level.criteria) {
      if (typeof criterion.action !== "string") {
        throw new Error("Criterion missing: action");
      }
      if (typeof criterion.count !== "number") {
        throw new Error("Criterion missing: count");
      }
    }
  }

  // Sort levels by level number ascending
  parsed.levels.sort(
    (a: { level: number }, b: { level: number }) => a.level - b.level
  );

  // Clamp confidences
  parsed.overallConfidence = Math.max(0, Math.min(1, parsed.overallConfidence));
  for (const level of parsed.levels) {
    level.confidence = Math.max(0, Math.min(1, level.confidence));
  }

  // Validate primaryActivation references an existing level
  if (
    !parsed.levels.some(
      (l: { level: number }) => l.level === parsed.primaryActivation
    )
  ) {
    throw new Error(
      `primaryActivation ${parsed.primaryActivation} does not match any level`
    );
  }

  return parsed as ActivationLevelsResult;
}
