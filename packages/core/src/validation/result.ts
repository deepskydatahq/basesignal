export interface ValidationError {
  path: string[];
  expected: string;
  received: string;
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };
