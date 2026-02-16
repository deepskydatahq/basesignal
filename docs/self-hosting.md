# Self-Hosting

## Quick Start with Docker

Four commands to get Basesignal running:

```bash
git clone https://github.com/deepskydatahq/basesignal.git
cd basesignal
cp .env.example .env   # Add your API key
docker-compose up
```

This starts the Basesignal MCP server on port 3000, accessible from Claude Desktop or any MCP client.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | -- | Anthropic API key for Claude models |
| `OPENAI_API_KEY` | Yes* | -- | OpenAI API key for GPT models |
| `BASESIGNAL_PROVIDER` | No | `anthropic` | LLM provider: `"anthropic"`, `"openai"`, or `"ollama"` |
| `BASESIGNAL_MODEL` | No | Provider default | Model override (e.g., `"claude-sonnet-4-20250514"`, `"gpt-4o"`) |
| `BASESIGNAL_STORAGE` | No | `/data` | Directory for storing profiles and scan data |
| `BASESIGNAL_PORT` | No | `3000` | Server port for SSE transport |

\*One of `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is required unless using Ollama.

### Example `.env` File

```bash
# LLM Provider (choose one)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional overrides
# BASESIGNAL_PROVIDER=anthropic
# BASESIGNAL_MODEL=claude-sonnet-4-20250514
# BASESIGNAL_STORAGE=/data
# BASESIGNAL_PORT=3000
```

## Docker Configuration

### Dockerfile

The Docker image is based on `node:22-alpine` for a minimal footprint:

- Copies all packages and installs production dependencies only
- Runs the MCP server in SSE mode on the configured port
- Profile data is persisted via a Docker volume at `BASESIGNAL_STORAGE`

### docker-compose.yml

```yaml
services:
  basesignal:
    build: .
    ports:
      - "${BASESIGNAL_PORT:-3000}:${BASESIGNAL_PORT:-3000}"
    volumes:
      - basesignal-data:/data
    env_file:
      - .env
    restart: unless-stopped

volumes:
  basesignal-data:
```

The volume mount ensures profiles and scan data persist across container restarts.

## Storage

Basesignal stores all data locally in the `BASESIGNAL_STORAGE` directory:

- Product profiles (JSON files)
- Scan results and crawled page content
- No external database required

Default location is `/data` inside the container, mapped to a Docker volume. For non-Docker deployments, profiles are stored in `~/.basesignal/` by default.

## LLM Provider Configuration

Basesignal supports three LLM providers. Set `BASESIGNAL_PROVIDER` to choose which one to use.

### Anthropic (default)

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
# BASESIGNAL_PROVIDER defaults to "anthropic"
```

Uses Claude models for analysis. This is the default and recommended provider.

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
export BASESIGNAL_PROVIDER=openai
```

Uses GPT models. Set `BASESIGNAL_MODEL` to override the default model (e.g., `gpt-4o`).

### Ollama (fully local, air-gapped)

Ollama runs LLMs locally on your machine. No API key needed -- everything stays on your hardware.

1. Install Ollama on the host machine: https://ollama.ai

2. Pull a model:

```bash
ollama pull llama3.1
```

3. Configure Basesignal:

```bash
export BASESIGNAL_PROVIDER=ollama
# Ollama runs on localhost:11434 by default
```

For Docker deployments, the container needs to reach the host's Ollama server. Use `host.docker.internal` or `network_mode: host`:

```yaml
services:
  basesignal:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - basesignal-data:/data
    environment:
      - BASESIGNAL_PROVIDER=ollama
      - OLLAMA_HOST=http://host.docker.internal:11434
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped

volumes:
  basesignal-data:
```

On Linux, you may need `network_mode: host` instead:

```yaml
services:
  basesignal:
    build: .
    network_mode: host
    volumes:
      - basesignal-data:/data
    environment:
      - BASESIGNAL_PROVIDER=ollama
    restart: unless-stopped

volumes:
  basesignal-data:
```

## Connecting from Claude Desktop

### SSE Transport (Docker deployment)

When running Basesignal as a Docker container, Claude Desktop connects over HTTP. Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "basesignal": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

### stdio Transport (local installation)

For local installations without Docker, use stdio transport. This is the simplest option:

```json
{
  "mcpServers": {
    "basesignal": {
      "command": "basesignal",
      "args": ["serve", "--transport", "stdio"]
    }
  }
}
```

See [Getting Started](./getting-started.md) for the full setup walkthrough.

## Updating

### Docker

```bash
docker-compose pull
docker-compose up -d
```

Or pin a specific version in your Dockerfile:

```dockerfile
FROM ghcr.io/deepskydatahq/basesignal:1.0.0
```

### npm

```bash
npm install -g @basesignal/cli@latest
```

## Running Without Docker

If you prefer not to use Docker, install the CLI globally and run the server directly:

```bash
npm install -g @basesignal/cli
basesignal serve --transport stdio
```

This is the simplest option for local development. Profiles are stored in `~/.basesignal/` by default.

For SSE mode (e.g., to connect from a remote Claude Desktop):

```bash
basesignal serve --transport sse --port 3000
```
