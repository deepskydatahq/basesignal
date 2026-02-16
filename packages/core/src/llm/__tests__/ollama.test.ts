import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OllamaProvider } from "../ollama";

describe("OllamaProvider", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: "ollama response" } }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OLLAMA_HOST;
  });

  it("does not require an API key", () => {
    expect(() => new OllamaProvider()).not.toThrow();
  });

  it("defaults to localhost:11434", async () => {
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.anything()
    );
  });

  it("uses configurable baseUrl", async () => {
    const provider = new OllamaProvider({ baseUrl: "http://gpu-server:11434" });
    await provider.complete([{ role: "user", content: "test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://gpu-server:11434/api/chat",
      expect.anything()
    );
  });

  it("strips trailing slash from baseUrl", async () => {
    const provider = new OllamaProvider({ baseUrl: "http://gpu-server:11434/" });
    await provider.complete([{ role: "user", content: "test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://gpu-server:11434/api/chat",
      expect.anything()
    );
  });

  it("reads OLLAMA_HOST env var", async () => {
    process.env.OLLAMA_HOST = "http://remote:11434";
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://remote:11434/api/chat",
      expect.anything()
    );
  });

  it("sets stream: false in request body", async () => {
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.stream).toBe(false);
  });

  it("defaults to llama3.1 model", async () => {
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("llama3.1");
  });

  it("maps maxTokens to num_predict", async () => {
    const provider = new OllamaProvider();
    await provider.complete(
      [{ role: "user", content: "test" }],
      { maxTokens: 2048 }
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.options.num_predict).toBe(2048);
  });

  it("passes temperature in options", async () => {
    const provider = new OllamaProvider();
    await provider.complete(
      [{ role: "user", content: "test" }],
      { temperature: 0.8 }
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.options.temperature).toBe(0.8);
  });

  it("supports model selection via options", async () => {
    const provider = new OllamaProvider();
    await provider.complete(
      [{ role: "user", content: "test" }],
      { model: "mistral" }
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("mistral");
  });

  it("passes messages with role and content", async () => {
    const provider = new OllamaProvider();
    await provider.complete([
      { role: "system", content: "Be helpful" },
      { role: "user", content: "Hello" },
    ]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: "system", content: "Be helpful" },
      { role: "user", content: "Hello" },
    ]);
  });

  it("throws descriptive error on HTTP failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve('model "foo" not found'),
    });
    const provider = new OllamaProvider();
    await expect(
      provider.complete([{ role: "user", content: "test" }], { model: "foo" })
    ).rejects.toThrow('Ollama request failed (404): model "foo" not found');
  });

  it("uses statusText when response body is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve(""),
    });
    const provider = new OllamaProvider();
    await expect(
      provider.complete([{ role: "user", content: "test" }])
    ).rejects.toThrow("Ollama request failed (500): Internal Server Error");
  });

  it("handles text() rejection gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: () => Promise.reject(new Error("read error")),
    });
    const provider = new OllamaProvider();
    await expect(
      provider.complete([{ role: "user", content: "test" }])
    ).rejects.toThrow("Ollama request failed (503): Service Unavailable");
  });

  it("returns empty string when message content is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: {} }),
    });
    const provider = new OllamaProvider();
    const result = await provider.complete([{ role: "user", content: "test" }]);
    expect(result).toBe("");
  });

  it("applies constructor config defaults", async () => {
    const provider = new OllamaProvider({
      defaultModel: "mixtral",
      defaultTemperature: 0.5,
      defaultMaxTokens: 1024,
    });
    await provider.complete([{ role: "user", content: "test" }]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("mixtral");
    expect(body.options.temperature).toBe(0.5);
    expect(body.options.num_predict).toBe(1024);
  });

  it("works with common models (llama3.1, mistral, mixtral)", async () => {
    const provider = new OllamaProvider();
    for (const model of ["llama3.1", "mistral", "mixtral"]) {
      await provider.complete(
        [{ role: "user", content: "test" }],
        { model }
      );
    }
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
