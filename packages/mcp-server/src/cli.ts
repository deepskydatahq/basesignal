#!/usr/bin/env node
import { createServer } from "./server.js";

createServer().catch((err) => {
  console.error("Failed to start Basesignal MCP server:", err);
  process.exit(1);
});
