# === Build stage ===
FROM node:22-alpine AS build

WORKDIR /app

# Copy workspace root files first (layer caching)
COPY package.json package-lock.json ./

# Copy all package.json files for dependency resolution
COPY packages/core/package.json packages/core/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/crawlers/package.json packages/crawlers/
COPY packages/storage/package.json packages/storage/
COPY packages/cli/package.json packages/cli/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY packages/ packages/

# Build all packages
RUN npm run build --workspaces

# === Run stage ===
FROM node:22-alpine

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./

# Copy package.json files for workspace resolution
COPY packages/core/package.json packages/core/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/crawlers/package.json packages/crawlers/
COPY packages/storage/package.json packages/storage/
COPY packages/cli/package.json packages/cli/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built output from build stage
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/mcp-server/dist packages/mcp-server/dist
COPY --from=build /app/packages/crawlers/dist packages/crawlers/dist
COPY --from=build /app/packages/storage/dist packages/storage/dist
COPY --from=build /app/packages/cli/dist packages/cli/dist

# Create data directory
RUN mkdir -p /data

# Non-root user for security
RUN addgroup -g 1001 basesignal && \
    adduser -u 1001 -G basesignal -D basesignal && \
    chown -R basesignal:basesignal /app /data

USER basesignal

# Default environment
ENV BASESIGNAL_STORAGE=/data
ENV NODE_ENV=production

EXPOSE 3000

# Start the MCP server via CLI
CMD ["node", "packages/cli/dist/index.js", "serve", "--transport", "sse", "--port", "3000"]
