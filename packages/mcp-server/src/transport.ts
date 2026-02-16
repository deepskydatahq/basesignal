import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ServerConfig } from "./types.js";

/**
 * Create a transport based on config.
 * Currently only stdio is supported (for Claude Desktop local use).
 */
export function createTransport(_config: ServerConfig) {
  // Only stdio for v1. SSE/HTTP can be added behind a config flag later.
  return new StdioServerTransport();
}
