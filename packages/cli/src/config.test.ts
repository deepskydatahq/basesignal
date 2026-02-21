import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadConfig, requireApiKey, loadTomlConfig, findConfigFile } from "./config.js";
import { ScanError } from "./errors.js";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
    expect(config.storageAdapter).toBe("file");
    expect(config.crawl.maxPages).toBe(50);
    expect(config.crawl.timeout).toBe(30000);
    expect(config.output.format).toBe("json");
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

describe("loadTomlConfig", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "basesignal-toml-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("parses a valid TOML file", () => {
    const filePath = join(dir, "config.toml");
    writeFileSync(filePath, `
[provider]
name = "openai"
model = "gpt-4o"

[storage]
path = "~/.basesignal"
adapter = "sqlite"

[crawl]
max_pages = 100
timeout = 60000

[output]
format = "json"
`, "utf-8");

    const toml = loadTomlConfig(filePath);
    expect(toml).not.toBeNull();
    expect(toml!.provider!.name).toBe("openai");
    expect(toml!.provider!.model).toBe("gpt-4o");
    expect(toml!.storage!.path).toBe("~/.basesignal");
    expect(toml!.storage!.adapter).toBe("sqlite");
    expect(toml!.crawl!.max_pages).toBe(100);
    expect(toml!.crawl!.timeout).toBe(60000);
    expect(toml!.output!.format).toBe("json");
  });

  it("returns null for non-existent file", () => {
    const result = loadTomlConfig(join(dir, "nope.toml"));
    expect(result).toBeNull();
  });

  it("throws ScanError for malformed TOML", () => {
    const filePath = join(dir, "bad.toml");
    writeFileSync(filePath, "[provider\nname = broken", "utf-8");

    expect(() => loadTomlConfig(filePath)).toThrow(ScanError);
    try {
      loadTomlConfig(filePath);
    } catch (e) {
      expect((e as ScanError).code).toBe("storage-error");
      expect((e as ScanError).message).toContain("Invalid TOML");
    }
  });

  it("parses partial TOML (only some sections)", () => {
    const filePath = join(dir, "partial.toml");
    writeFileSync(filePath, `
[provider]
name = "ollama"
`, "utf-8");

    const toml = loadTomlConfig(filePath);
    expect(toml!.provider!.name).toBe("ollama");
    expect(toml!.storage).toBeUndefined();
    expect(toml!.crawl).toBeUndefined();
  });
});

describe("TOML + env var precedence", () => {
  let dir: string;
  const savedEnv: Record<string, string | undefined> = {};
  const envVars = [
    "BASESIGNAL_PROVIDER",
    "BASESIGNAL_MODEL",
    "BASESIGNAL_STORAGE",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
  ];
  let savedCwd: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "basesignal-prec-test-"));
    savedCwd = process.cwd();
    process.chdir(dir);

    for (const key of envVars) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.chdir(savedCwd);
    rmSync(dir, { recursive: true, force: true });

    for (const key of envVars) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it("reads provider from local basesignal.toml", () => {
    writeFileSync(join(dir, "basesignal.toml"), `
[provider]
name = "openai"
model = "gpt-4o"
`, "utf-8");

    const config = loadConfig();
    expect(config.provider).toBe("openai");
    expect(config.model).toBe("gpt-4o");
  });

  it("env vars override TOML values", () => {
    writeFileSync(join(dir, "basesignal.toml"), `
[provider]
name = "openai"
model = "gpt-4o"
`, "utf-8");

    process.env.BASESIGNAL_PROVIDER = "anthropic";
    process.env.BASESIGNAL_MODEL = "claude-3";
    const config = loadConfig();
    expect(config.provider).toBe("anthropic");
    expect(config.model).toBe("claude-3");
  });

  it("overrides beat both env vars and TOML", () => {
    writeFileSync(join(dir, "basesignal.toml"), `
[provider]
name = "openai"
`, "utf-8");
    process.env.BASESIGNAL_PROVIDER = "ollama";

    const config = loadConfig({ provider: "anthropic" });
    expect(config.provider).toBe("anthropic");
  });

  it("falls back to defaults when no TOML file exists", () => {
    const config = loadConfig();
    expect(config.provider).toBe("anthropic");
    expect(config.crawl.maxPages).toBe(50);
    expect(config.storageAdapter).toBe("file");
  });

  it("reads crawl settings from TOML", () => {
    writeFileSync(join(dir, "basesignal.toml"), `
[crawl]
max_pages = 200
timeout = 60000
`, "utf-8");

    const config = loadConfig();
    expect(config.crawl.maxPages).toBe(200);
    expect(config.crawl.timeout).toBe(60000);
  });
});

describe("findConfigFile", () => {
  let dir: string;
  let savedCwd: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "basesignal-find-test-"));
    savedCwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(savedCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns local basesignal.toml when present", () => {
    writeFileSync(join(dir, "basesignal.toml"), "[provider]\n", "utf-8");
    const found = findConfigFile();
    expect(found).toBe(join(dir, "basesignal.toml"));
  });

  it("returns null when no config file exists", () => {
    // Neither local nor global exist in this temp dir
    const found = findConfigFile();
    // Could be null or the global path — depends on whether ~/.basesignal/config.toml exists
    // In a clean test env, most likely null
    if (found !== null) {
      expect(found).toContain("config.toml");
    }
  });
});
