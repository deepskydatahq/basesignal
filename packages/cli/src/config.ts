import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { parse as parseToml } from "smol-toml";
import { ScanError } from "./errors.js";

export interface BasesignalConfig {
  provider: "anthropic" | "openai" | "ollama";
  model?: string;
  apiKey?: string;
  storagePath: string;
  storageAdapter: "file" | "sqlite";
  crawl: {
    maxPages: number;
    timeout: number;
  };
  output: {
    format: "json";
  };
  verbose: boolean;
}

/** Shape of the TOML config file. */
export interface TomlConfig {
  provider?: {
    name?: string;
    model?: string;
    api_key?: string;
  };
  storage?: {
    path?: string;
    adapter?: string;
  };
  crawl?: {
    max_pages?: number;
    timeout?: number;
  };
  output?: {
    format?: string;
  };
}

/**
 * Find a config file by searching:
 * 1. ./basesignal.toml (project-local)
 * 2. ~/.basesignal/config.toml (global)
 *
 * Returns the path to the first file found, or null.
 */
export function findConfigFile(): string | null {
  const local = path.resolve("basesignal.toml");
  if (fs.existsSync(local)) return local;

  const global = path.join(os.homedir(), ".basesignal", "config.toml");
  if (fs.existsSync(global)) return global;

  return null;
}

/**
 * Load and parse a TOML config file. Returns null if the file doesn't exist.
 * Throws ScanError for malformed TOML.
 */
export function loadTomlConfig(filePath: string): TomlConfig | null {
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    return parseToml(raw) as unknown as TomlConfig;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new ScanError(
      "storage-error",
      `Invalid TOML in ${filePath}: ${message}`,
      "Check your basesignal.toml syntax",
    );
  }
}

function resolveApiKey(provider: string): string | undefined {
  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "ollama":
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Load config with precedence: overrides > env vars > TOML config > defaults.
 *
 * TOML files are searched in order: ./basesignal.toml, ~/.basesignal/config.toml.
 */
export function loadConfig(
  overrides?: Partial<BasesignalConfig>,
): BasesignalConfig {
  // Load TOML config (if any)
  const configFile = findConfigFile();
  const toml = configFile ? loadTomlConfig(configFile) : null;

  // Provider: overrides > env > toml > default
  const provider = (overrides?.provider ??
    process.env.BASESIGNAL_PROVIDER ??
    toml?.provider?.name ??
    "anthropic") as BasesignalConfig["provider"];

  // Model: overrides > env > toml > default
  const model =
    overrides?.model ??
    process.env.BASESIGNAL_MODEL ??
    toml?.provider?.model ??
    undefined;

  // API key: env > toml > (resolved from provider-specific env var)
  const apiKey = resolveApiKey(provider) ?? toml?.provider?.api_key;

  // Storage path: env > toml > default
  const storagePath =
    process.env.BASESIGNAL_STORAGE ??
    expandTilde(toml?.storage?.path) ??
    path.join(os.homedir(), ".basesignal");

  // Storage adapter: toml > default
  const storageAdapter = (toml?.storage?.adapter ?? "file") as BasesignalConfig["storageAdapter"];

  // Crawl settings: toml > defaults
  const crawl = {
    maxPages: toml?.crawl?.max_pages ?? 50,
    timeout: toml?.crawl?.timeout ?? 30000,
  };

  // Output settings: toml > defaults
  const output = {
    format: (toml?.output?.format ?? "json") as "json",
  };

  const verbose = overrides?.verbose ?? false;

  return { provider, model, apiKey, storagePath, storageAdapter, crawl, output, verbose };
}

export function requireApiKey(config: BasesignalConfig): string {
  if (config.provider === "ollama") {
    return "";
  }

  if (config.apiKey) {
    return config.apiKey;
  }

  const envVarName =
    config.provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";

  throw new ScanError(
    "missing-api-key",
    `No API key found for ${config.provider}`,
    `Set ${envVarName}: export ${envVarName}=your-key-here`,
  );
}

/** Expand ~ to homedir in a path string. Returns undefined if input is undefined. */
function expandTilde(p: string | undefined): string | undefined {
  if (!p) return undefined;
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  if (p === "~") return os.homedir();
  return p;
}
