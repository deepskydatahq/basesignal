import Anthropic from "@anthropic-ai/sdk";

/**
 * Call Claude with the given system and user prompts.
 * Defaults to Claude Sonnet with low temperature for precision.
 */
export async function callClaude(options: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.15,
    system: options.system,
    messages: [{ role: "user", content: options.user }],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Extract JSON from text that may contain markdown code fences or raw JSON.
 * Handles ```json ... ```, ``` ... ```, and bare JSON.
 */
export function extractJson(text: string): unknown {
  if (!text || !text.trim()) {
    throw new Error("Empty response text");
  }

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();

  return JSON.parse(jsonStr);
}
