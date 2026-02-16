import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { createTransport } from "./transport.js";
import type { ServerConfig, ToolContext } from "./types.js";

const DEFAULT_NAME = "basesignal";
const DEFAULT_VERSION = "0.1.0";

/**
 * Create and start a Basesignal MCP server.
 *
 * This is the entire public API. Pass config to customize the server name,
 * version, storage adapter, or LLM provider. By default, connects over
 * stdio (for Claude Desktop).
 *
 * @example
 * ```typescript
 * import { createServer } from "@basesignal/mcp-server";
 * await createServer();
 * ```
 */
export async function createServer(config: ServerConfig = {}) {
  const name = config.name ?? DEFAULT_NAME;
  const version = config.version ?? DEFAULT_VERSION;

  const server = new McpServer({ name, version });

  const context: ToolContext = {
    storage: config.storage,
    llmProvider: config.llmProvider,
    scan: config.scan,
  };

  registerTools(server, context, version);

  const transport = createTransport(config);
  await server.connect(transport);

  return server;
}
