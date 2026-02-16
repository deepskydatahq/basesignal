import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import type { ToolDeps, ToolResult } from "./types.js";
import { text, error } from "./types.js";
import { resolveProduct } from "./resolveProduct.js";
import { formatSection } from "./formatters.js";

const DEFINITION_TYPES = new Set([
  "activation",
  "firstValue",
  "active",
  "atRisk",
  "churn",
]);

const SECTION_TYPES = [
  "activation",
  "firstValue",
  "active",
  "atRisk",
  "churn",
  "identity",
  "revenue",
  "entities",
  "journey",
  "outcomes",
  "metrics",
] as const;

export const getDefinitionMeta = {
  title: "Get Definition",
  description:
    "Retrieve a single section or lifecycle definition from a product profile in detail.",
};

export const getDefinitionSchema = {
  productId: z
    .string()
    .describe(
      "Product ID (from list_products). If omitted, auto-resolves when only one product exists."
    )
    .optional(),
  type: z
    .enum(SECTION_TYPES)
    .describe(
      "Section type: activation, firstValue, active, atRisk, churn, identity, revenue, entities, journey, outcomes, or metrics."
    ),
} as const;

export function handleGetDefinition(
  deps: ToolDeps
): (args: { productId?: string; type: string }) => Promise<ToolResult> {
  return async (args) => {
    const result = await resolveProduct(deps.storage, args.productId);
    if (!result.success) {
      return error(result.error);
    }

    const { profile } = result;
    let sectionData: unknown;

    if (DEFINITION_TYPES.has(args.type)) {
      const defs = profile.definitions as
        | Record<string, unknown>
        | undefined;
      sectionData = defs?.[args.type] ?? null;
    } else {
      sectionData =
        (profile as Record<string, unknown>)[args.type] ?? null;
    }

    if (sectionData === null || sectionData === undefined) {
      return text(
        `The ${args.type} definition has not been analyzed yet. Run scan_product first, or provide details and I'll help you define it.`
      );
    }

    return text(formatSection(args.type, sectionData));
  };
}

export function registerGetDefinitionTool(
  server: McpServer,
  deps: ToolDeps
) {
  server.registerTool(
    "get_definition",
    getDefinitionMeta,
    getDefinitionSchema,
    handleGetDefinition(deps)
  );
}
