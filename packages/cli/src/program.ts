import { Command } from "commander";
import { registerScanCommand } from "./commands/scan.js";
import { registerExportCommand } from "./commands/export.js";
import { registerServeCommand } from "./commands/serve.js";
import { loadConfig } from "./config.js";
import type { StorageAdapter, LlmProvider } from "@basesignal/mcp-server";

export function createProgram(): Command {
  const program = new Command()
    .name("basesignal")
    .description("Product profile analysis from the command line")
    .version("0.0.1")
    .option("--verbose", "Enable verbose output", false);

  // Lazy factories -- only created when a command that needs them runs.
  // This means `basesignal --help` and `basesignal --version` work without
  // any storage or LLM dependencies being resolved.
  const getStorage = async (): Promise<StorageAdapter> => {
    const config = loadConfig({ verbose: program.opts().verbose });
    const { FileStorage } = await import("@basesignal/storage");
    return new FileStorage({ dir: config.storagePath });
  };

  const getProvider = (): LlmProvider => {
    // LlmProvider is currently an empty interface (skeleton).
    // When analysis tools are integrated, this will create an actual provider.
    return {};
  };

  registerScanCommand(program);
  registerExportCommand(program, getStorage);
  registerServeCommand(program, getStorage, getProvider);

  return program;
}
