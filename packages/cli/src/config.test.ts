import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, requireApiKey } from "./config.js";
import { CLIError, ScanError } from "./errors.js";

describe("loadConfig", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envVars = [
    "BASESIGNAL_PROVIDER",
    "BASESIGNAL_MODEL",
    "BASESIGNAL_STORAGE",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
  ];

  beforeEach(() => {
    for (const key of envVars) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envVars) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it("returns default config when no overrides or env vars", () => {
    const config = loadConfig();
    expect(config.provider).toBe("anthropic");
    expect(config.model).toBeUndefined();
    expect(config.storagePath).toMatch(/\.basesignal$/);
    expect(config.verbose).toBe(false);
  });

  it("overrides take precedence", () => {
    const config = loadConfig({ provider: "openai", verbose: true });
    expect(config.provider).toBe("openai");
    expect(config.verbose).toBe(true);
  });

  it("reads BASESIGNAL_PROVIDER from env", () => {
    process.env.BASESIGNAL_PROVIDER = "openai";
    const config = loadConfig();
    expect(config.provider).toBe("openai");
  });

  it("reads BASESIGNAL_MODEL from env", () => {
    process.env.BASESIGNAL_MODEL = "gpt-4";
    const config = loadConfig();
    expect(config.model).toBe("gpt-4");
  });

  it("reads BASESIGNAL_STORAGE from env", () => {
    process.env.BASESIGNAL_STORAGE = "/tmp/test";
    const config = loadConfig();
    expect(config.storagePath).toBe("/tmp/test");
  });

  it("resolves ANTHROPIC_API_KEY for anthropic provider", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-123";
    const config = loadConfig();
    expect(config.apiKey).toBe("sk-ant-test-123");
  });

  it("resolves OPENAI_API_KEY for openai provider", () => {
    process.env.OPENAI_API_KEY = "sk-openai-test-456";
    const config = loadConfig({ provider: "openai" });
    expect(config.apiKey).toBe("sk-openai-test-456");
  });

  it("ollama has no API key", () => {
    const config = loadConfig({ provider: "ollama" });
    expect(config.apiKey).toBeUndefined();
  });

  it("overrides beat env vars", () => {
    process.env.BASESIGNAL_PROVIDER = "anthropic";
    const config = loadConfig({ provider: "openai" });
    expect(config.provider).toBe("openai");
  });
});

describe("requireApiKey", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envVars = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"];

  beforeEach(() => {
    for (const key of envVars) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envVars) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it("throws ScanError with code missing-api-key for anthropic without key", () => {
    const config = loadConfig({ provider: "anthropic" });
    expect(() => requireApiKey(config)).toThrow(ScanError);
    try {
      requireApiKey(config);
    } catch (e) {
      expect(e).toBeInstanceOf(ScanError);
      expect((e as ScanError).code).toBe("missing-api-key");
      expect((e as ScanError).suggestion).toContain("ANTHROPIC_API_KEY");
    }
  });

  it("throws ScanError with code missing-api-key for openai without key", () => {
    const config = loadConfig({ provider: "openai" });
    expect(() => requireApiKey(config)).toThrow(ScanError);
    try {
      requireApiKey(config);
    } catch (e) {
      expect(e).toBeInstanceOf(ScanError);
      expect((e as ScanError).code).toBe("missing-api-key");
      expect((e as ScanError).suggestion).toContain("OPENAI_API_KEY");
    }
  });

  it("returns empty string for ollama", () => {
    const config = loadConfig({ provider: "ollama" });
    const key = requireApiKey(config);
    expect(key).toBe("");
  });

  it("returns key when present", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-real-key";
    const config = loadConfig({ provider: "anthropic" });
    const key = requireApiKey(config);
    expect(key).toBe("sk-ant-real-key");
  });
});
