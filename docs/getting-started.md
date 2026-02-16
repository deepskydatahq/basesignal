# Getting Started

Basesignal scans a product's public-facing website and generates a structured Product Profile -- a machine-readable model of how the product acquires, activates, retains, and monetizes users. This guide walks you through installation, running your first scan, and connecting Basesignal to Claude Desktop.

## Prerequisites

- Node.js 18+
- An LLM API key (one of: Anthropic, OpenAI, or Ollama for fully local)

## Install

```bash
npm install -g @basesignal/cli
```

## Configure Your LLM Provider

Basesignal uses an LLM to analyze crawled pages and extract product insights. Set one of the following environment variables:

```bash
# Anthropic (default)
export ANTHROPIC_API_KEY=sk-ant-...

# OR OpenAI
export OPENAI_API_KEY=sk-...

# OR for local/air-gapped: install Ollama, no API key needed
# See the Self-Hosting guide for Ollama setup
```

## Your First Scan

Point Basesignal at a product's website:

```bash
basesignal scan https://linear.app
```

Basesignal crawls the site, extracts product data, and generates a Product Profile. You will see a summary as pages are processed:

```
Scanning https://linear.app...
  Crawled 12 pages (homepage, features, pricing, docs, ...)
  Extracting identity... done (confidence: 0.92)
  Extracting revenue model... done (confidence: 0.91)
  Mapping entities... done (confidence: 0.88)
  Building user journey... done (confidence: 0.85)
  Defining lifecycle states... done (confidence: 0.85)
  Generating outputs... done

Profile complete:
  Product:      Linear
  Model:        Per-seat SaaS subscription
  Tiers:        Free, Standard ($8/user/mo), Plus ($14/user/mo)
  Journey:      6 stages (Discovery -> Expansion)
  Activation:   3 levels (Setup Complete -> First Workflow -> Team Adoption)
  Completeness: 100%
  Confidence:   0.83
```

## View the Full Profile

Export the profile as markdown for human reading:

```bash
basesignal export linear-app --format markdown
```

Example output (abbreviated):

```markdown
# Linear - Product Profile

## Identity
- **Product:** Linear
- **Description:** Modern project management tool built for software teams
- **Target Customer:** Software development teams at startups and mid-market companies
- **Business Model:** Per-seat SaaS subscription
- **Industry:** Developer Tools

## Revenue
- **Model:** Per-seat SaaS subscription
- **Free Tier:** Yes
- **Tiers:** Free ($0), Standard ($8/user/mo), Plus ($14/user/mo)
...
```

Export as JSON for programmatic use:

```bash
basesignal export linear-app --format json > linear-profile.json
```

The JSON output follows the [Product Profile data model](./data-model.md). See the [complete Linear profile fixture](./fixtures/linear-profile.json) for an example of the full JSON structure.

## Connect to Claude Desktop

Basesignal includes an MCP server that lets Claude Desktop scan products, query profiles, and update definitions through natural conversation.

Add the following to your Claude Desktop configuration file (`claude_desktop_config.json`):

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

Once connected, you can ask Claude things like:

- "Scan the product at linear.app and tell me about their business model"
- "What's the activation definition for Linear?"
- "Export the Linear profile as markdown"

See the [MCP Tools Reference](./mcp-tools.md) for the full list of available tools.

## What You Can Do Next

- **Understand the data model:** [The Product Profile Data Model](./data-model.md) -- learn what each section of a profile contains and what the fields mean.
- **Explore MCP tools:** [MCP Tools Reference](./mcp-tools.md) -- all six tools available through Claude Desktop, with parameters and example conversations.
- **Build a custom crawler:** [Crawlers](./crawlers.md) -- extend Basesignal to crawl new source types like GitHub READMEs or G2 reviews.
- **Self-host with Docker:** [Self-Hosting](./self-hosting.md) -- run Basesignal locally with Docker, configure LLM providers including fully local Ollama.
