# Story 1.2: User Authentication for MCP

## Overview
Enable MCP (Model Context Protocol) clients to authenticate with Basesignal to securely access product data through the MCP interface.

## Acceptance Criteria
1. ✓ First connection prompts for authentication
2. ✓ User can create account or log in
3. ✓ Auth token is stored and reused for subsequent connections
4. ✓ Invalid/expired tokens prompt re-authentication
5. ✓ User identity is available to all tool calls

## Architecture

### Token-Based Authentication Flow
- MCP clients provide credentials (email + password or magic link)
- Convex mutation validates credentials against user database
- Returns a JWT token valid for 30 days
- Token stored in MCP client config (`~/.mcp.json` or similar)
- Token sent in headers for all subsequent MCP calls

### Components

**Backend (Convex)**
- `createUserWithPassword` mutation - Create new user with hashed password
- `loginUser` mutation - Validate credentials and return JWT token
- `validateToken` query - Verify JWT token is valid
- Schema additions: users table with email, hashedPassword, tokens

**Frontend/CLI (if needed)**
- Initial auth prompt when token is missing
- Credential input UI
- Token persistence and refresh logic

## Implementation Tasks

1. **Add User Schema to Convex**
   - Create `users` table with email, hashedPassword
   - Create `authTokens` table with token, userId, expiresAt
   - Add indexes on email

2. **Implement Password Hashing**
   - Use bcryptjs for password hashing in Convex
   - Hash passwords on user creation

3. **Create Authentication Mutations**
   - `createUserWithPassword(email, password)` - Creates user if not exists
   - `loginUser(email, password)` - Validates and returns JWT token
   - `logoutUser(token)` - Invalidates token

4. **Create Authentication Queries**
   - `validateToken(token)` - Checks token validity, returns userId
   - `getCurrentUser()` - Returns authenticated user info (requires valid token)

5. **Add JWT Support**
   - Create JWT signing/validation utilities
   - Token should include userId and expiration

6. **Test Coverage**
   - Unit tests for password hashing
   - Tests for user creation flow
   - Tests for login/token validation
   - Tests for token expiration

7. **Documentation**
   - MCP client setup guide
   - How to store and manage tokens

## Technical Notes
- Use Node.js built-in crypto or bcryptjs for hashing
- JWT tokens with 30-day expiration
- Simple email/password auth (can add OAuth later)
- Token stored client-side in MCP config file
