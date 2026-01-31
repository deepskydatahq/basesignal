import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  streamableHttpHandler,
  mcpAuthClerk,
  protectedResourceHandlerClerk,
  authServerMetadataHandlerClerk,
} from "@clerk/mcp-tools/express";
import { registerTools } from "./tools/index.js";

// MCP Server
const server = new McpServer({
  name: "basesignal",
  version: "0.1.0",
});

registerTools(server);

// Express app
const app = express();

app.use(
  cors({
    exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id", "Last-Event-Id"],
    origin: "*",
  })
);

// OAuth Protected Resource Metadata (RFC 9728)
app.get(
  "/.well-known/oauth-protected-resource",
  protectedResourceHandlerClerk()
);

// Authorization Server Metadata (RFC 8414)
app.get(
  "/.well-known/oauth-authorization-server",
  authServerMetadataHandlerClerk
);

// MCP endpoint with Clerk authentication
const mcpHandler = streamableHttpHandler(server);
app.post("/mcp", mcpAuthClerk, mcpHandler);
app.get("/mcp", mcpAuthClerk, mcpHandler);
app.delete("/mcp", mcpAuthClerk, mcpHandler);

// Health check (no auth required)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "basesignal", version: "0.1.0" });
});

// Start
const PORT = parseInt(process.env.PORT || "3001", 10);
app.listen(PORT, () => {
  console.log(`Basesignal MCP server running on http://localhost:${PORT}`);
  console.log(`  MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`  Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  process.exit(0);
});
