import { z } from "zod/v4";
import { ProductProfileSchema } from "../schema/profile";
import { CoreIdentitySchema } from "../schema/identity";
import { RevenueArchitectureSchema } from "../schema/revenue";
import { EntityModelSchema } from "../schema/entities";
import { JourneyStagesSchema } from "../schema/journey";
import { DefinitionsSchema } from "../schema/definitions";
import { OutcomesSchema } from "../schema/outcomes";
import { MetricsSectionSchema } from "../schema/metrics";
import type { ProductProfile } from "../schema/profile";
import type { ValidationResult, ValidationError } from "./result";

export type { ValidationResult, ValidationError } from "./result";

const sectionSchemas = {
  identity: CoreIdentitySchema,
  revenue: RevenueArchitectureSchema,
  entities: EntityModelSchema,
  journey: JourneyStagesSchema,
  definitions: DefinitionsSchema,
  outcomes: OutcomesSchema,
  metrics: MetricsSectionSchema,
} as const;

type SectionName = keyof typeof sectionSchemas;

export function validateProfile(data: unknown): ValidationResult<ProductProfile> {
  const result = ProductProfileSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: mapZodErrors(result.error) };
}

export function validateSection<S extends SectionName>(
  section: S,
  data: unknown,
): ValidationResult<z.infer<(typeof sectionSchemas)[S]>> {
  const schema = sectionSchemas[section];
  const result = (schema as z.ZodType).safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as z.infer<(typeof sectionSchemas)[S]> };
  }
  return { success: false, errors: mapZodErrors(result.error!) };
}

function mapZodErrors(error: z.ZodError): ValidationError[] {
  return error.issues.map((issue) => {
    const raw = issue as unknown as Record<string, unknown>;
    return {
      path: issue.path.map(String),
      expected: (raw.expected as string) ?? "valid value",
      received: String(raw.received ?? "unknown"),
      message: issue.message,
    };
  });
}
