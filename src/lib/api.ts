// Stub file for API utilities - TODO: implement actual API calls

export interface ConflictDetails {
  has_conflict: boolean;
  conflicting_fields: string[];
  draft_changes: Record<string, unknown>;
  live_changes: Record<string, unknown>;
}

export interface ResolveResult {
  entity_status: string;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export async function getConflictDetails(
  _projectName: string,
  _entityName: string
): Promise<ConflictDetails> {
  // TODO: implement actual API call
  console.warn('getConflictDetails is a stub - implement actual API call');
  return {
    has_conflict: false,
    conflicting_fields: [],
    draft_changes: {},
    live_changes: {},
  };
}

export async function resolveConflict(
  _projectName: string,
  _entityName: string,
  _resolution: 'keep_draft' | 'accept_git'
): Promise<ResolveResult> {
  // TODO: implement actual API call
  console.warn('resolveConflict is a stub - implement actual API call');
  return { entity_status: 'live' };
}
/* eslint-enable @typescript-eslint/no-unused-vars */
