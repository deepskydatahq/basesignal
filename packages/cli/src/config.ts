import * as os from "node:os";
import * as path from "node:path";
import { CLIError, ScanError } from "./errors.js";

export interface BasesignalConfig {
  provider: "anthropic" | "openai" | "ollama";
  model?: string;
  apiKey?: string;
  storagePath: string;
  verbose: boolean;
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

export function loadConfig(
  overrides?: Partial<BasesignalConfig>,
): BasesignalConfig {
  const provider = (overrides?.provider ??
    process.env.BASESIGNAL_PROVIDER ??
    "anthropic") as BasesignalConfig["provider"];

  const model = overrides?.model ?? process.env.BASESIGNAL_MODEL ?? undefined;

  const apiKey = resolveApiKey(provider);

  const storagePath =
    process.env.BASESIGNAL_STORAGE ?? path.join(os.homedir(), ".basesignal");

  const verbose = overrides?.verbose ?? false;

  return { provider, model, apiKey, storagePath, verbose };
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
