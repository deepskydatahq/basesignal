import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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
app.set("trust proxy", 1);

app.use(
  cors({
    exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id", "Last-Event-Id"],
    origin: "*",
  })
);

// OAuth Protected Resource Metadata (RFC 9728)
// Serve at both the base path and path-specific URLs (e.g. /mcp)
const prmHandler = protectedResourceHandlerClerk();
app.get("/.well-known/oauth-protected-resource", prmHandler);
app.get("/.well-known/oauth-protected-resource/:path+", prmHandler);

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

// Dev MCP endpoint (no OAuth, injects dev user) — local testing only
if (process.env.NODE_ENV !== "production") {
  const DEV_CLERK_ID = process.env.DEV_CLERK_ID || "user_dev_local";
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const devHandler: express.RequestHandler = async (req, res) => {
    // Inject dev auth so withUser() can extract the clerk ID
    (req as any).auth = { extra: { userId: DEV_CLERK_ID } };

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (req.method === "GET") {
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) {
        res.status(400).json({ error: "No session" });
        return;
      }
      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === "DELETE") {
      if (sessionId && transports.has(sessionId)) {
        transports.delete(sessionId);
      }
      res.status(200).end();
      return;
    }

    // POST — create or reuse transport
    let transport: StreamableHTTPServerTransport;
    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
    } else {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });
      await server.connect(transport);
      transports.set(transport.sessionId!, transport);
    }

    await transport.handleRequest(req, res, req.body);
  };

  app.use("/mcp-dev", express.json(), devHandler);
  console.log("  Dev MCP endpoint (no auth): /mcp-dev");
}

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
