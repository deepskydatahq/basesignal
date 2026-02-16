// packages/core/src/llm/parse.ts

/**
 * Extract JSON from text that may contain markdown code fences or raw JSON.
 * Used by all LLM response parsers.
 */
export function extractJson(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}
