// Stub file for primitives - TODO: implement actual primitives

export interface PrimitiveParam {
  name: string;
  type: 'string' | 'column_select';
  description: string;
  required?: boolean;
}

export interface Primitive {
  name: string;
  label: string;
  description: string;
  params: PrimitiveParam[];
  generateSQL: (params: Record<string, unknown>) => string;
}

export const PRIMITIVES: Primitive[] = [
  {
    name: 'hash_email',
    label: 'Hash Email',
    description: 'Hash an email address',
    params: [{ name: 'column', type: 'column_select', description: 'Column to hash', required: true }],
    generateSQL: (params) => `SHA256(LOWER(TRIM(${params.column})))`,
  },
  {
    name: 'date_diff_days',
    label: 'Date Diff (Days)',
    description: 'Calculate days between dates',
    params: [
      { name: 'column', type: 'column_select', description: 'Date column', required: true },
      { name: 'reference', type: 'string', description: 'Reference date', required: false },
    ],
    generateSQL: (params) => `DATE_DIFF(${params.reference || 'CURRENT_DATE'}, ${params.column}, DAY)`,
  },
];

export function getPrimitiveByName(name: string): Primitive | undefined {
  return PRIMITIVES.find((p) => p.name === name);
}
