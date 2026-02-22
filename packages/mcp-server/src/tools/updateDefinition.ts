import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import type { ZodType } from "zod/v4";
import {
  CoreIdentitySchema,
  RevenueArchitectureSchema,
  EntityModelSchema,
  JourneyStagesSchema,
  DefinitionSchema,
  FirstValueDefinitionSchema,
  ActivationDefinitionSchema,
  OutcomesSchema,
  MetricsSectionSchema,
} from "@basesignal/core";
import type { ToolDeps, ToolResult, ProductProfile } from "./types.js";
import { text, error } from "./types.js";
import { resolveProduct } from "./resolveProduct.js";
import { formatSection, formatCompletenessChange } from "./formatters.js";

const DEFINITION_TYPES = new Set([
  "activation",
  "firstValue",
  "active",
  "atRisk",
  "churn",
]);

const TOP_LEVEL_SECTIONS = new Set([
  "identity",
  "revenue",
  "entities",
  "journey",
  "outcomes",
  "metrics",
]);

const ALL_SECTIONS = [
  "identity",
  "revenue",
  "entities",
  "journey",
  "outcomes",
  "metrics",
] as const;

const ALL_DEFINITIONS = [
  "activation",
  "firstValue",
  "active",
  "atRisk",
  "churn",
] as const;

// Schema mapping for validation
const sectionSchemas: Record<string, ZodType> = {
  identity: CoreIdentitySchema,
  revenue: RevenueArchitectureSchema,
  entities: EntityModelSchema,
  journey: JourneyStagesSchema,
  outcomes: OutcomesSchema,
  metrics: MetricsSectionSchema,
  activation: ActivationDefinitionSchema,
  firstValue: FirstValueDefinitionSchema,
  active: DefinitionSchema,
  atRisk: DefinitionSchema,
  churn: DefinitionSchema,
};

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

export const updateDefinitionMeta = {
  title: "Update Definition",
  description:
    "Update a section or lifecycle definition on a product profile. Validates data against the section schema before saving.",
};

export const updateDefinitionSchema = {
  productId: z
    .string()
    .describe(
      "Product ID. If omitted, auto-resolves when only one product exists."
    )
    .optional(),
  type: z
    .enum(SECTION_TYPES)
    .describe("Section to update."),
  data: z
    .record(z.string(), z.unknown())
    .describe(
      "The new data for this section. Must match the section's schema."
    ),
} as const;

function formatZodErrors(error: z.core.$ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

function recalculateCompleteness(profile: ProductProfile): {
  completeness: number;
  overallConfidence: number;
} {
  let populated = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;
  const total = ALL_SECTIONS.length + ALL_DEFINITIONS.length;

  for (const section of ALL_SECTIONS) {
    const data = (profile as Record<string, unknown>)[section];
    if (data) {
      populated++;
      const conf = (data as Record<string, unknown>).confidence;
      if (typeof conf === "number") {
        totalConfidence += conf;
        confidenceCount++;
      }
    }
  }

  const defs = profile.definitions as Record<string, unknown> | undefined;
  if (defs) {
    for (const def of ALL_DEFINITIONS) {
      const data = defs[def];
      if (data) {
        populated++;
        const d = data as Record<string, unknown>;
        const conf = d.confidence ?? d.overallConfidence;
        if (typeof conf === "number") {
          totalConfidence += conf;
          confidenceCount++;
        }
      }
    }
  }

  return {
    completeness: total > 0 ? populated / total : 0,
    overallConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
  };
}

export function handleUpdateDefinition(
  deps: ToolDeps
): (args: {
  productId?: string;
  type: string;
  data: Record<string, unknown>;
}) => Promise<ToolResult> {
  return async (args) => {
    const result = await resolveProduct(deps.storage, args.productId);
    if (!result.success) {
      return error(result.error);
    }

    const { profile, id } = result;

    // Validate against schema
    const schema = sectionSchemas[args.type];
    if (!schema) {
      return error(`Unknown section type: ${args.type}`);
    }

    const parseResult = schema.safeParse(args.data);
    if (!parseResult.success) {
      return error(
        `Validation failed for ${args.type}:\n${formatZodErrors(parseResult.error)}`
      );
    }

    const validatedData = parseResult.data;
    const beforeCompleteness = profile.completeness ?? 0;

    // Apply update
    if (DEFINITION_TYPES.has(args.type)) {
      const existingDefs =
        (profile.definitions as Record<string, unknown>) ?? {};
      (profile as Record<string, unknown>).definitions = {
        ...existingDefs,
        [args.type]: validatedData,
      };
    } else if (TOP_LEVEL_SECTIONS.has(args.type)) {
      (profile as Record<string, unknown>)[args.type] = validatedData;
    }

    // Recalculate completeness and confidence
    const { completeness, overallConfidence } =
      recalculateCompleteness(profile);
    (profile as Record<string, unknown>).completeness = completeness;
    (profile as Record<string, unknown>).overallConfidence = overallConfidence;
    (profile as Record<string, unknown>).updatedAt = Date.now();

    // Save
    await deps.storage.save(profile);

    // Re-read to confirm
    const saved = await deps.storage.load(id);
    const afterCompleteness = saved?.completeness ?? completeness;

    // Build confirmation output
    const lines = [
      `## Updated: ${capitalise(args.type)}`,
      "",
      formatSection(args.type, validatedData),
      "",
      formatCompletenessChange(beforeCompleteness, afterCompleteness as number),
    ];

    return text(lines.join("\n"));
  };
}

export function registerUpdateDefinitionTool(
  server: McpServer,
  deps: ToolDeps
) {
  server.registerTool(
    "update_definition",
    { ...updateDefinitionMeta, inputSchema: updateDefinitionSchema },
    handleUpdateDefinition(deps)
  );
}

function capitalise(s: string): string {
  if (s === "firstValue") return "First Value";
  if (s === "atRisk") return "At Risk";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
