// packages/core/src/llm/parse.ts

/**
 * Extract JSON from text that may contain markdown code fences or raw JSON.
 * Handles: closed fences, truncated fences (no closing ```), and raw JSON.
 * Used by all LLM response parsers.
 */
export function extractJson(text: string): unknown {
  // 1. Try closed markdown fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // 2. Try unclosed fence (truncated response)
  const openFence = text.match(/```(?:json)?\s*\n?([\s\S]+)/);
  if (openFence) {
    const inner = openFence[1].trim();
    try {
      return JSON.parse(inner);
    } catch {
      // Fall through to bracket matching
    }
  }

  // 3. Try raw JSON (find first { or [ and parse from there)
  const trimmed = text.trim();
  const jsonStart = trimmed.search(/[{[]/);
  if (jsonStart >= 0) {
    try {
      return JSON.parse(trimmed.slice(jsonStart));
    } catch {
      // Fall through to final attempt
    }
  }

  // 4. Last resort: parse the whole thing
  return JSON.parse(trimmed);
}
