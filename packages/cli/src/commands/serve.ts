import type { Command } from "commander";
import type { StorageAdapter, LlmProvider } from "@basesignal/mcp-server";

export function registerServeCommand(
  program: Command,
  getStorage: () => StorageAdapter | Promise<StorageAdapter>,
  getProvider: () => LlmProvider | Promise<LlmProvider>,
): void {
  program
    .command("serve")
    .description("Start the Basesignal MCP server (stdio transport)")
    .action(async () => {
      // Dynamic import to avoid loading MCP server deps for other commands
      const { createServer } = await import("@basesignal/mcp-server");

      // All output goes to stderr so stdout stays clean for MCP JSON-RPC protocol
      console.error("Starting Basesignal MCP server (stdio)...");

      await createServer({
        storage: await getStorage(),
        llmProvider: await getProvider(),
      });

      console.error(
        "Basesignal MCP server running. Connect from Claude Desktop.",
      );
    });
}
