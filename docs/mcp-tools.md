# MCP Tools Reference

## Overview

Basesignal includes an MCP (Model Context Protocol) server that exposes product scanning and profile management as tools for AI assistants. When connected to Claude Desktop or any MCP-compatible client, these tools let you scan products, query profiles, update definitions, and export data through natural conversation.

The MCP server supports two transport modes:

- **stdio** -- for local use with Claude Desktop (recommended for getting started)
- **SSE** -- for remote/Docker deployments over HTTP

See [Getting Started](./getting-started.md) for setup instructions.

## Tools

### scan_product

Crawl a product's website and generate a ProductProfile.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | Yes | The product URL to scan |

**Returns:** Human-readable summary of the generated profile, including identity, revenue model, journey stages, and confidence scores.

**Example conversation:**

> **User:** "Scan the product at linear.app and tell me about their business model"
>
> **Assistant** calls `scan_product({ url: "https://linear.app" })`
>
> **Assistant:** "I scanned Linear and generated a product profile. Linear is a modern project management tool built for software teams. They use a per-seat SaaS subscription model with three tiers: Free ($0), Standard ($8/user/month), and Plus ($14/user/month). Their main expansion path is seat growth as teams scale, and the primary contraction risk is switching to competing tools like Jira."

---

### get_profile

Retrieve a stored product profile.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | No | Product ID. If omitted, lists all stored products. |

**Returns:** Full profile in human-readable markdown format, or a list of available products if no `productId` is provided.

**Example conversation:**

> **User:** "Show me the profile for Linear"
>
> **Assistant** calls `get_profile({ productId: "linear-app" })`
>
> **Assistant:** "Here's the complete product profile for Linear. It has 6 journey stages from Discovery through Expansion, a 3-level activation model, and 5 tracked entities including Issues, Projects, and Cycles. The overall confidence is 0.83 with 100% completeness."

---

### list_products

List all stored product profiles.

**Parameters:** None.

**Returns:** List of products with ID, name, source URL, completeness score, and last updated timestamp.

**Example conversation:**

> **User:** "What products have I scanned?"
>
> **Assistant** calls `list_products()`
>
> **Assistant:** "You have 3 scanned products:
> 1. **Linear** (linear-app) -- 100% complete, last updated Feb 15
> 2. **Notion** (notion-so) -- 85% complete, last updated Feb 12
> 3. **Figma** (figma-com) -- 71% complete, last updated Feb 10"

---

### get_definition

Read a specific definition section from a product profile.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | Yes | Product ID |
| `type` | `string` | Yes | Definition type: `"activation"`, `"firstValue"`, `"active"`, `"atRisk"`, or `"churn"` |

**Returns:** The definition section with criteria, reasoning, confidence, and evidence.

**Example conversation:**

> **User:** "What's the activation definition for Linear?"
>
> **Assistant** calls `get_definition({ productId: "linear-app", type: "activation" })`
>
> **Assistant:** "Linear uses a 3-level activation model:
> - **Level 1 (Setup Complete):** Create a workspace and invite 1 member -- weak signal
> - **Level 2 (First Workflow):** Create 5 issues and move 3 statuses within 7 days -- medium signal (this is the primary activation threshold)
> - **Level 3 (Team Adoption):** Create a cycle and 20 issues within 14 days -- strong signal
>
> The overall confidence is 0.85."

---

### update_definition

Update a definition section in a product profile.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | Yes | Product ID |
| `type` | `string` | Yes | Definition type: `"activation"`, `"firstValue"`, `"active"`, `"atRisk"`, or `"churn"` |
| `data` | `object` | Yes | New definition data (validated against schema) |

**Returns:** Confirmation with the updated definition.

**Example conversation:**

> **User:** "Change the activation criteria to require 10 issues instead of 5 for Level 2"
>
> **Assistant** calls `update_definition({ productId: "linear-app", type: "activation", data: { ... } })`
>
> **Assistant:** "I've updated the activation definition for Linear. Level 2 (First Workflow) now requires creating 10 issues within 7 days instead of 5. The rest of the activation levels remain unchanged."

---

### export_profile

Export a product profile in markdown or JSON format.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | Yes | Product ID |
| `format` | `string` | No | `"markdown"` (default) or `"json"` |

**Returns:** The full profile in the requested format, suitable for copying into documents or saving to a file.

**Example conversation:**

> **User:** "Export the Linear profile as JSON"
>
> **Assistant** calls `export_profile({ productId: "linear-app", format: "json" })`
>
> **Assistant:** "Here's the full Linear profile in JSON format. You can save this to a file for programmatic use. The profile includes all 7 sections with an overall confidence of 0.83."

## Error Handling

Common errors returned by the MCP tools and what they mean:

| Error | Cause | Resolution |
|-------|-------|------------|
| "Product not found" | No profile with that ID exists | Run `list_products` to see available IDs, or scan the product first |
| "Invalid URL" | The URL could not be parsed or reached | Check the URL format and ensure the site is accessible |
| "LLM provider not configured" | Missing API key environment variable | Set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or configure Ollama |
| "Validation failed" | Data provided to `update_definition` does not match the schema | Check the [data model](./data-model.md) for the expected field structure |
| "Crawl failed" | The website could not be crawled (timeout, blocked, etc.) | Try again or check if the site blocks automated access |
