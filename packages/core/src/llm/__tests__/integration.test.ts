import { describe, it, expect } from "vitest";
import { createProvider } from "../factory";

describe.skip("OpenAI integration (requires OPENAI_API_KEY)", () => {
  it("completes a simple prompt", async () => {
    const provider = createProvider({
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
    });
    const result = await provider.complete([
      { role: "user", content: "Reply with exactly: hello" },
    ]);
    expect(result.toLowerCase()).toContain("hello");
  });
});

describe.skip("Ollama integration (requires running Ollama)", () => {
  it("completes a simple prompt", async () => {
    const provider = createProvider({ provider: "ollama" });
    const result = await provider.complete([
      { role: "user", content: "Reply with exactly: hello" },
    ]);
    expect(result.toLowerCase()).toContain("hello");
  });
});
