/**
 * Minimal metadata returned by list() and search().
 * Avoids loading full profile documents for listing views.
 */
export interface ProfileSummary {
  id: string;
  name: string;
  url: string;
  completeness: number;
  updatedAt: number;
}

/**
 * Placeholder for the ProductProfile type from @basesignal/core.
 *
 * This is a minimal stand-in until M008-E001-S002 extracts the full
 * ProductProfile type system into packages/core. The storage layer
 * treats profiles as opaque JSON documents -- it only reads `id`,
 * `identity.productName`, `metadata.url`, and `completeness` for
 * indexing. The rest is serialized as-is.
 *
 * TODO: Replace with `import type { ProductProfile } from "@basesignal/core"`
 * once packages/core exists.
 */
export interface ProductProfile {
  /** UUID assigned by storage on first save. */
  id?: string;

  /** Core product identity. */
  identity?: {
    productName: string;
    description: string;
    targetCustomer: string;
    businessModel: string;
    industry?: string;
    companyStage?: string;
    teams?: string[];
    companies?: string[];
    use_cases?: string[];
    revenue_model?: string[];
    confidence: number;
    evidence: Array<{ url: string; excerpt: string }>;
  };

  /** Product URL and scan metadata. */
  metadata?: {
    url: string;
    docsUrl?: string;
    scannedAt?: number;
  };

  /** Revenue architecture. */
  revenue?: Record<string, unknown>;

  /** Entity model. */
  entities?: Record<string, unknown>;

  /** Journey stages. */
  journey?: Record<string, unknown>;

  /** Definitions (activation, firstValue, active, atRisk, churn). */
  definitions?: Record<string, unknown>;

  /** Outcomes. */
  outcomes?: Record<string, unknown>;

  /** Metrics (MetricsSection data, set via MCP tools). */
  metrics?: Record<string, unknown>;

  /** Measurement spec (MeasurementSpec data, set by scan pipeline). */
  measurement_spec?: Record<string, unknown>;

  /** Generated outputs (ICP profiles, activation map, measurement spec). */
  outputs?: Record<string, unknown>;

  /** Completeness score (0-1). */
  completeness?: number;

  /** Overall confidence score (0-1). */
  overallConfidence?: number;

  /** Source material stats (counts and timestamps per category). */
  sourceMaterial?: {
    pagesScanned?: number;
    pagesLastUpdated?: number;
    documentsRead?: number;
    documentsLastUpdated?: number;
    videosWatched?: number;
    videosLastUpdated?: number;
  };

  /** Allow additional fields for forward compatibility. */
  [key: string]: unknown;
}

/**
 * Storage adapter interface. All implementations must satisfy this contract.
 *
 * Methods return Promise to support both synchronous adapters (SQLite) and
 * asynchronous adapters (Postgres, HTTP-backed, etc.). The SQLite adapter
 * wraps synchronous calls in Promise.resolve().
 */
export interface StorageAdapter {
  /** Persist a profile. Creates on first call, upserts on subsequent calls. Returns the profile ID. */
  save(profile: ProductProfile): Promise<string>;

  /** Load a profile by ID. Returns null if not found. */
  load(id: string): Promise<ProductProfile | null>;

  /** List all profiles with summary metadata, ordered by most recently updated. */
  list(): Promise<ProfileSummary[]>;

  /** Delete a profile by ID. Returns true if it existed, false if not found. */
  delete(id: string): Promise<boolean>;

  /** Search profiles by name or URL substring. Case-insensitive. */
  search(query: string): Promise<ProfileSummary[]>;

  /** Clean up resources (close database connections, etc.). */
  close(): void;
}
