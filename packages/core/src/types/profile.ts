import type { Evidence, SignalStrength } from "./common";
import { SCHEMA_VERSION } from "../version";

export { SCHEMA_VERSION };

// ---------------------------------------------------------------------------
// Root ProductProfile
// ---------------------------------------------------------------------------

/** Top-level product profile containing all analyzed sections. */
export interface ProductProfile {
  /** Reference to the product this profile describes. */
  productId: string;

  /** Core identity extracted from the product's website. */
  identity?: CoreIdentity;

  /** Revenue architecture and pricing analysis. */
  revenue?: RevenueArchitecture;

  /** Entity model discovered from the product. */
  entities?: EntityModel;

  /** User journey stages. */
  journey?: UserJourney;

  /** Lifecycle definitions (activation, first value, active, at-risk, churn). */
  definitions?: DefinitionsMap;

  /** Business outcomes linked to features. */
  outcomes?: OutcomesSection;

  /** Metrics catalog derived from the product analysis. */
  metrics?: MetricsSection;

  /** Schema version for migration support. */
  basesignal_version?: string;

  /** Percentage of sections populated (0-100). */
  completeness: number;

  /** Weighted average confidence across all sections. */
  overallConfidence: number;

  /** Timestamp when the profile was created. */
  createdAt: number;

  /** Timestamp when the profile was last updated. */
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Core Identity
// ---------------------------------------------------------------------------

/** Core identity extracted from a product's website. */
export interface CoreIdentity {
  productName: string;
  description: string;
  targetCustomer: string;
  businessModel: string;
  industry?: string;
  companyStage?: string;
  confidence: number;
  evidence: Evidence[];
}

// ---------------------------------------------------------------------------
// Revenue Architecture
// ---------------------------------------------------------------------------

/** A single pricing tier. */
export interface PricingTier {
  name: string;
  price: string;
  features: string[];
}

/** Revenue model and pricing structure. */
export interface RevenueArchitecture {
  model: string;
  billingUnit?: string;
  hasFreeTier: boolean;
  tiers: PricingTier[];
  expansionPaths: string[];
  contractionRisks: string[];
  confidence: number;
  evidence: Evidence[];
}

// ---------------------------------------------------------------------------
// Entity Model
// ---------------------------------------------------------------------------

/** A single entity discovered in the product. */
export interface EntityItem {
  name: string;
  type: string;
  properties: string[];
}

/** A relationship between two entities. */
export interface EntityRelationship {
  from: string;
  to: string;
  type: string;
}

/** Entity model describing the product's domain objects and their relationships. */
export interface EntityModel {
  items: EntityItem[];
  relationships: EntityRelationship[];
  confidence: number;
  evidence: Evidence[];
}

// ---------------------------------------------------------------------------
// User Journey
// ---------------------------------------------------------------------------

/** A single stage in the user journey. */
export interface JourneyStage {
  name: string;
  description: string;
  order: number;
}

/** User journey stages from onboarding through retention. */
export interface UserJourney {
  stages: JourneyStage[];
  confidence: number;
  evidence: Evidence[];
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

/** A single criterion for activation (used in multi-level format). */
export interface ActivationCriterion {
  action: string;
  count: number;
  timeWindow?: string;
}

/** A single activation level in the multi-level format. */
export interface ActivationLevelDef {
  level: number;
  name: string;
  signalStrength: SignalStrength;
  criteria: ActivationCriterion[];
  reasoning: string;
  confidence: number;
  evidence: Evidence[];
}

/** Legacy flat activation definition with string criteria. */
export interface LegacyActivationDefinition {
  criteria: string[];
  timeWindow?: string;
  reasoning: string;
  confidence: number;
  source: string;
  evidence: Evidence[];
}

/** Multi-level activation definition with structured levels. */
export interface MultiLevelActivationDefinition {
  levels: ActivationLevelDef[];
  primaryActivation?: number;
  overallConfidence: number;
}

/** Activation definition supporting both legacy and multi-level formats. */
export type ActivationDefinition =
  | LegacyActivationDefinition
  | MultiLevelActivationDefinition;

/** Lifecycle definition for a single state (first value, active, at-risk, churn). */
export interface LifecycleDefinition {
  description?: string;
  criteria: string[];
  timeWindow?: string;
  reasoning: string;
  confidence: number;
  source: string;
  evidence: Evidence[];
}

/** Map of all lifecycle definitions on a product profile. */
export interface DefinitionsMap {
  activation?: ActivationDefinition;
  firstValue?: LifecycleDefinition;
  active?: LifecycleDefinition;
  atRisk?: LifecycleDefinition;
  churn?: LifecycleDefinition;
}

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

/** A single business outcome. */
export interface OutcomeItem {
  description: string;
  type: string;
  linkedFeatures: string[];
  measurement_references?: Array<{ entity: string; activity: string }>;
  suggested_metrics?: string[];
}

/** Business outcomes section of a product profile. */
export interface OutcomesSection {
  items: OutcomeItem[];
  confidence: number;
  evidence: Evidence[];
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/** A single metric in the catalog. */
export interface MetricItem {
  name: string;
  category: string;
  formula?: string;
  linkedTo: string[];
}

/** Metrics catalog section of a product profile. */
export interface MetricsSection {
  items: MetricItem[];
  confidence: number;
  evidence: Evidence[];
}
