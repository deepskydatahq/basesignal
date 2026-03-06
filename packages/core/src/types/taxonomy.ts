// ---------------------------------------------------------------------------
// Analytics Taxonomy Types
// ---------------------------------------------------------------------------
// Normalized, platform-agnostic event taxonomy from analytics platforms
// (Amplitude, PostHog, Mixpanel, etc.)
// ---------------------------------------------------------------------------

/** A property attached to a taxonomy event. */
export interface TaxonomyProperty {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

/** A single event in the analytics taxonomy. */
export interface TaxonomyEvent {
  name: string;
  description: string;
  properties: TaxonomyProperty[];
  category?: string;
  status?: string;
  tags: string[];
  volume_last_30d?: number;
}

/** Platform-level metadata for the taxonomy extraction. */
export interface TaxonomyMetadata {
  loader_version?: string;
  extraction_duration_ms?: number;
  event_count?: number;
  [key: string]: unknown;
}

/** Normalized analytics taxonomy extracted from a platform. */
export interface AnalyticsTaxonomy {
  platform: string;
  project_id: string;
  extracted_at: string;
  events: TaxonomyEvent[];
  metadata?: TaxonomyMetadata;
}
