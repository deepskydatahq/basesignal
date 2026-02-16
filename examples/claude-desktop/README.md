# Claude Desktop Setup

Connect Basesignal to Claude Desktop so you can scan and analyze products through conversation.

## Prerequisites

- [Claude Desktop](https://claude.ai/download) installed
- Node.js 18+
- An Anthropic API key

## Steps

### 1. Install the MCP server

```bash
npm install -g @basesignal/cli
```

### 2. Configure Claude Desktop

Open your Claude Desktop configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Copy the contents of [`claude_desktop_config.json`](./claude_desktop_config.json) in this directory into your configuration file. If you already have other MCP servers configured, merge the `basesignal` entry into your existing `mcpServers` object.

Replace `sk-ant-your-key-here` with your actual Anthropic API key.

### 3. Restart Claude Desktop

Quit and reopen Claude Desktop. You should see "basesignal" in the MCP servers list (click the hammer icon).

### 4. Test the connection

In Claude Desktop, type:

> Can you scan linear.app and tell me about their product?

Claude will call the `scan_product` tool and return a product profile summary.

## Available Tools

| Tool | Description |
|------|-------------|
| `scan_product` | Scan a URL and generate a product profile |
| `get_profile` | Retrieve a stored product profile |
| `list_products` | List all scanned products |
| `get_definition` | Get a specific definition (activation, first value, etc.) |
| `update_definition` | Refine a definition through conversation |
| `export_profile` | Export a profile as markdown or JSON |

## Troubleshooting

- **"Server not found"**: Make sure `@basesignal/cli` is installed globally (`npm install -g @basesignal/cli`)
- **"API key error"**: Verify `ANTHROPIC_API_KEY` is set correctly in the config file
- **"Connection refused"**: Restart Claude Desktop after any configuration changes

## Configuration Options

Environment variables in the config:

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | (required) | Your Anthropic API key |
| `BASESIGNAL_PROVIDER` | `anthropic` | LLM provider (`anthropic`, `openai`, `ollama`) |
| `BASESIGNAL_MODEL` | (provider default) | Model override |
| `BASESIGNAL_STORAGE` | `~/.basesignal` | Storage directory path |
