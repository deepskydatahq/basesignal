export type ValidationResult = {
  valid: boolean;
  error?: string;
};

// Known irregular past tense verbs
const IRREGULAR_PAST_TENSE = [
  'sent', 'built', 'run', 'begun', 'done', 'gone', 'known',
  'seen', 'taken', 'written', 'bought', 'brought', 'caught',
  'taught', 'thought', 'found', 'held', 'left', 'lost', 'made',
  'paid', 'said', 'sold', 'told', 'won', 'set', 'put', 'cut',
  'hit', 'read', 'shut', 'split', 'spread', 'fed', 'met', 'led',
];

// Terms that are too vague to be useful
const VAGUE_TERMS = [
  'onboarding', 'activation', 'setup', 'getting started',
  'engaged', 'active', 'retention', 'churn', 'growth',
];

/**
 * Validate that entity + action follows the required format
 */
export function validateActivityFormat(entity: string, action: string): ValidationResult {
  const errors: string[] = [];

  // Entity checks
  if (!entity || entity.trim().length === 0) {
    errors.push('Entity is required');
  } else {
    const trimmedEntity = entity.trim();
    if (trimmedEntity.includes(' ')) {
      errors.push(`Entity should be a single noun, got "${trimmedEntity}"`);
    }
    if (VAGUE_TERMS.includes(trimmedEntity.toLowerCase())) {
      errors.push(`"${trimmedEntity}" is too vague. What specific thing was acted upon?`);
    }
  }

  // Action checks
  if (!action || action.trim().length === 0) {
    errors.push('Action is required');
  } else {
    const trimmedAction = action.trim().toLowerCase();

    // Check for vague action terms
    if (VAGUE_TERMS.includes(trimmedAction)) {
      errors.push(`"${action}" is too vague. What specific action happened?`);
    }

    // Check for past tense
    const isPastTense =
      trimmedAction.endsWith('ed') ||
      IRREGULAR_PAST_TENSE.includes(trimmedAction);

    if (!isPastTense) {
      errors.push(`Action must be past tense. Got "${action}", try "${action}ed" or similar`);
    }
  }

  return errors.length > 0
    ? { valid: false, error: errors.join('; ') }
    : { valid: true };
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export type Activity = {
  entity?: string;
  action?: string;
};

/**
 * Find a duplicate or near-duplicate activity in existing list
 * Returns the matching activity if found, null otherwise
 */
export function findDuplicate(
  entity: string,
  action: string,
  existing: Activity[]
): Activity | null {
  const candidateName = `${entity} ${action}`.toLowerCase();
  const candidateEntity = entity.toLowerCase();
  const candidateAction = action.toLowerCase();

  for (const activity of existing) {
    if (!activity.entity || !activity.action) continue;

    const existingName = `${activity.entity} ${activity.action}`.toLowerCase();
    const existingEntity = activity.entity.toLowerCase();
    const existingAction = activity.action.toLowerCase();

    // Exact match (case-insensitive)
    if (candidateName === existingName) {
      return activity;
    }

    // Fuzzy match on full name - distance < 3
    if (levenshtein(candidateName, existingName) < 3) {
      return activity;
    }

    // Same entity, similar action - distance < 3
    // This catches typos like "Createed" vs "Created" for the same entity
    if (candidateEntity === existingEntity) {
      const actionDistance = levenshtein(candidateAction, existingAction);
      if (actionDistance < 3) {
        return activity;
      }
    }
  }

  return null;
}
