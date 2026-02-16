[![CI](https://github.com/deepskydatahq/basesignal/actions/workflows/ci.yml/badge.svg)](https://github.com/deepskydatahq/basesignal/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@basesignal/cli.svg)](https://www.npmjs.com/package/@basesignal/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

# Basesignal

**The open standard for product growth models.**

Basesignal scans your product's website and generates a structured growth model — activation definitions, user journey, metric catalog, measurement plan — in 60 seconds. Use it from the CLI, connect it to Claude Desktop via MCP, or self-host with Docker.

## What it does

- **Scan any B2B SaaS product** — point it at a URL and get a structured product profile with activation definitions, journey stages, entity model, revenue architecture, and metric catalog
- **MCP server for AI assistants** — connect to Claude Desktop, ChatGPT, or Cursor and make every product conversation smarter with structured context
- **Structured data model** — not just text extraction. The profile schema encodes relationships, inference rules, and validation logic
- **Extensible by design** — add crawlers for new data sources, storage adapters for different databases, or LLM providers. No core changes required

## Quick start

### CLI

```bash
npm install -g @basesignal/cli

export ANTHROPIC_API_KEY=sk-ant-...   # or OPENAI_API_KEY

basesignal scan https://linear.app
```

This crawls the website, analyzes it with your LLM, and outputs a product profile as JSON.

### Claude Desktop

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "basesignal": {
      "command": "npx",
      "args": ["@basesignal/mcp-server"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Then ask Claude: *"Scan my product at acme.io"*

### Docker

```bash
cp .env.example .env          # add your API key
docker compose up
```

The MCP server starts on stdio, ready for Claude Desktop or any MCP client.

## How it works

Basesignal is a pipeline: **crawl** public sources, **analyze** with LLMs using specialized lenses, **converge** into a structured profile.

```
URL → Crawlers → Analysis Lenses → Convergence → Product Profile
         │              │                │              │
    website          7 lenses        merge &        structured
    pricing       (identity,       deduplicate      schema with
    docs          journey,         + validate       confidence
                  revenue, ...)                      scores
```

The product profile is a structured document with typed sections: core identity, user journey, activation definitions, entity model, revenue architecture, metric catalog, and measurement plan. Each element has a confidence score and links to the evidence that informed it.

## Packages

| Package | Description |
|---------|-------------|
| [`@basesignal/core`](./packages/core) | Product profile schema, validation, and inference rules |
| [`@basesignal/crawlers`](./packages/crawlers) | Pluggable crawler interface and built-in website/pricing crawlers |
| [`@basesignal/storage`](./packages/storage) | Storage adapter interface with SQLite default |
| [`@basesignal/mcp-server`](./packages/mcp-server) | Self-hostable MCP server for AI assistants |
| [`@basesignal/cli`](./packages/cli) | Command-line tool for scanning and exporting profiles |

## Documentation

- [Getting Started](./docs/getting-started.md) — installation, configuration, first scan
- [Data Model](./docs/data-model.md) — the product profile schema explained
- [MCP Tools Reference](./docs/mcp-tools.md) — available tools and their parameters
- [Writing Crawlers](./docs/writing-crawlers.md) — how to add a new data source
- [Self-Hosting Guide](./docs/self-hosting.md) — Docker, environment variables, storage options
- [Schema Specification](./docs/specification/v1.0/) — formal schema for tool interoperability

## Contributing

Basesignal is open source and contributions are welcome. The easiest way to contribute is to add a new crawler — see the [Crawler Contribution Guide](./CONTRIBUTING.md#adding-a-crawler) for a step-by-step walkthrough.

For bugs, features, and other contributions, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) — DeepSky Data ApS
