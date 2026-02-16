# Basic Scan Example

Scan a product website and generate a product profile in under a minute.

## Prerequisites

- Node.js 18+
- An Anthropic API key (or OpenAI, or Ollama for local)

## Steps

### 1. Install the CLI

```bash
npm install -g @basesignal/cli
```

### 2. Set your API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Scan a product

```bash
basesignal scan https://linear.app
```

Or use the script in this directory:

```bash
npx tsx scan.ts https://linear.app
```

### 4. Save the output

```bash
basesignal scan https://linear.app --output linear-profile.json --format json
```

## Sample Output

```
Scanning https://linear.app...

Product Profile: Linear
=======================

Identity:
  Name: Linear
  Category: Project Management / Issue Tracking
  Tagline: "Linear is a better way to build software"

Journey Stages:
  1. Awareness  - Developer discovers Linear through word-of-mouth or content
  2. Signup     - Creates workspace, invites team
  3. Activation - Creates first issue, sets up project
  4. Engagement - Daily triage, sprint planning, cycle management
  5. Retention  - Team workflows embedded, integrations connected

Crawled 4 pages in 12.3s
```

## What Just Happened?

1. Basesignal crawled linear.app (homepage, features, pricing)
2. Ran 7 experiential lenses to extract value patterns
3. Converged and tiered the findings
4. Generated a product profile with identity, journey, definitions, and metrics

## Next Steps

- Save as JSON for programmatic access: `basesignal scan https://linear.app --format json`
- Connect to Claude Desktop: see [../claude-desktop/](../claude-desktop/)
- Build a custom crawler: see [../custom-crawler/](../custom-crawler/)
