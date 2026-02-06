# MCP User Authentication Design

## Overview

Implement OAuth 2.1 authentication for the Basesignal MCP server using Clerk as the Authorization Server and `@clerk/mcp-tools` for the integration layer.

## Problem Statement

Users connecting to the Basesignal MCP server from AI assistants (Claude Desktop, Cursor, etc.) need to authenticate so their product data is private, persistent, and tied to their account. The MCP spec defines an OAuth 2.1 flow for this, and Clerk provides first-class support.

## Proposed Solution

### Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   MCP Client        │     │   Basesignal MCP     │     │   Clerk         │
│   (Claude Desktop)  │     │   Server             │     │   (Auth Server) │
│                     │     │   (Resource Server)  │     │                 │
│                     │     │                      │     │                 │
│  1. Request ────────┼────>│  2. 401 + metadata ──┼────>│                 │
│                     │     │                      │     │                 │
│  3. Discover AS ────┼─────┼──────────────────────┼────>│  4. AS metadata │
│                     │     │                      │     │                 │
│  5. Browser opens ──┼─────┼──────────────────────┼────>│  6. Login/consent│
│                     │     │                      │     │                 │
│  7. Token received  │<────┼──────────────────────┼─────│  8. Issue token │
│                     │     │                      │     │                 │
│  9. Request + token─┼────>│ 10. Validate JWT ────┼────>│ 11. Verify     │
│                     │     │ 12. Identify user    │     │                 │
│                     │     │ 13. Load products    │     │                 │
│ 14. Response  <─────┼─────│                      │     │                 │
└─────────────────────┘     └──────────────────────┘     └─────────────────┘
```

### Components

**1. MCP Server (Standalone, TypeScript)**
- Framework: Express.js or Hono
- MCP SDK: `@modelcontextprotocol/sdk`
- Auth: `@clerk/mcp-tools/server` + `@clerk/backend`
- Hosting: Railway, Fly.io, or similar (needs SSE support)

**2. Clerk Configuration**
- Enable "Dynamic client registration" in Clerk Dashboard
- Configure OAuth scopes (e.g., `openid profile email`)
- Existing Clerk app from web frontend is reused — same user pool

**3. Required Endpoints on MCP Server**

| Endpoint | Purpose | Implementation |
|----------|---------|----------------|
| `/.well-known/oauth-protected-resource` | Protected Resource Metadata (RFC 9728) | `generateClerkProtectedResourceMetadata()` from `@clerk/mcp-tools` |
| `/mcp` | MCP tool endpoint (SSE) | MCP SDK server handler |

The authorization server metadata and login UI are handled entirely by Clerk — the MCP server doesn't need to implement them.

**4. Token Validation Flow**

On every MCP request:
1. Extract `Bearer` token from `Authorization` header
2. Verify JWT using Clerk's JWKS endpoint (via `@clerk/backend`)
3. Extract `sub` claim → Clerk user ID
4. Look up user in database by `clerkId`
5. If no user found → create user record (first MCP login)
6. Attach user context to the MCP request
7. All tool handlers receive authenticated user

### User Experience

**First connection (new user):**
1. Add Basesignal MCP server URL to Claude Desktop config
2. First tool call → 401 → Claude Desktop opens browser
3. Clerk signup page → create account
4. Consent screen → "Allow Basesignal to access your profile"
5. Redirect back → Claude Desktop has token
6. All subsequent tool calls are authenticated

**First connection (existing web app user):**
- Same flow, but step 3 is login instead of signup
- Same account, same data, seamless

**Returning sessions:**
- Token is cached by the MCP client
- No re-auth until token expires
- Clerk refresh tokens extend sessions

### Database Implications

The MCP server needs to identify users. Two options:

**Option A: Shared Convex backend (if carrying forward)**
- MCP server calls Convex API to look up/create users
- Same user table, same `clerkId` index
- Products, profiles, etc. live in Convex

**Option B: Separate database (if clean start)**
- MCP server has its own PostgreSQL database
- Users table with `clerk_id`, `email`, `name`
- Products and profiles stored here
- Web app (if built later) connects to same DB or syncs

This decision is still open (see ROADMAP.md open questions). The auth design works with either approach — it only needs a user lookup by Clerk ID.

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `@clerk/mcp-tools` | Protected resource metadata, auth helpers |
| `@clerk/backend` | JWT verification, user lookup |

### Security Considerations

- **Token validation on every request**: MCP spec requires `Authorization` header on every HTTP request, even within a session
- **PKCE required**: Handled by MCP clients (Claude Desktop, Cursor) automatically
- **Resource indicators (RFC 8707)**: MCP server validates tokens were issued for its audience
- **Short-lived tokens**: Clerk issues short-lived access tokens; refresh handled by MCP client
- **No token storage on server**: Server validates, doesn't store tokens
- **HTTPS required**: All endpoints must be HTTPS in production

### Scopes

Start minimal:
- `openid` — required for OIDC
- `profile` — user name/email for display
- `email` — email for notifications (future)

Custom scopes (future): `basesignal:read`, `basesignal:write`, `basesignal:admin` for team/permission features.

## Alternatives Considered

### API Key Auth
- Simpler to implement (generate key on web, paste into config)
- But: requires a web dashboard for key management before the MCP server even works
- Doesn't follow MCP spec's recommended OAuth flow
- Less secure (static secrets vs. short-lived tokens)

### Self-hosted OAuth (Cloudflare Workers)
- `workers-oauth-provider` library handles the full OAuth flow
- More control over the auth server
- But: more to build and maintain, and we already have Clerk

### Magic Link
- User provides email → gets link → clicks → session authenticated
- Creative UX but non-standard
- Doesn't leverage Clerk's existing infrastructure

## Open Questions

1. **Consent screen customization**: Can we customize the Clerk consent screen to show Basesignal branding and explain what access is being granted?
2. **Token lifetime**: What's the right balance between security (short tokens) and UX (not re-authing constantly)?
3. **Offline/local mode**: Should there be a way to use Basesignal without auth for local-only profiles? (Probably not for MVP)

## Success Criteria

- User can connect Claude Desktop to Basesignal MCP server
- OAuth flow completes without manual token handling
- User identity is available in all MCP tool handlers
- Returning users don't need to re-authenticate (token refresh works)
- Same Clerk account works for both web app and MCP access
