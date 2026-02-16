import type { StorageAdapter as _StorageAdapter } from "@basesignal/storage";
import type { ScanToolDeps } from "./tools/scan.js";

/**
 * Re-export StorageAdapter from @basesignal/storage so consumers can use
 * it without adding a direct dependency on the storage package.
 */
export type StorageAdapter = _StorageAdapter;

/**
 * Adapter interface for LLM calls (analysis pipeline).
 * Implementations: AnthropicProvider, OpenAIProvider, OllamaProvider.
 * Methods are added when analysis tools are integrated (S002+).
 */
export interface LlmProvider {
  // Intentionally empty for skeleton. See design doc section "Key Decisions #3".
}

/**
 * Configuration for creating an MCP server instance.
 */
export interface ServerConfig {
  /** Server name shown in MCP handshake. Defaults to "basesignal". */
  name?: string;
  /** Server version shown in MCP handshake. Defaults to "0.1.0". */
  version?: string;
  /** Storage adapter for persistence. Optional for skeleton (ping works without it). */
  storage?: StorageAdapter;
  /** LLM provider for analysis. Optional for skeleton. */
  llmProvider?: LlmProvider;
  /** Transport type. Defaults to "stdio". */
  transport?: "stdio";
  /** Scan tool dependencies (crawler + storage + analysis pipeline). */
  scan?: ScanToolDeps;
}

/**
 * Context passed to every tool handler.
 * Hosts can extend this (e.g., adding user identity for the hosted SaaS layer).
 */
export interface ToolContext {
  storage?: StorageAdapter;
  llmProvider?: LlmProvider;
  /** Optional scan tool dependencies. When provided, the scan_product tool is registered. */
  scan?: ScanToolDeps;
}
