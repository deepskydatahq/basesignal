export { extractJson } from "./json";

export {
  type TfIdfVector,
  tokenize,
  termFrequency,
  inverseDocumentFrequency,
  computeTfIdfVectors,
  cosineSimilarity,
  pairwiseSimilarity,
} from "./similarity";

export {
  DEFAULT_SIMILARITY_THRESHOLD,
  UnionFind,
  candidateText,
  sameLens,
  canMerge,
  buildCluster,
  clusterCandidatesCore,
  CLUSTERING_SYSTEM_PROMPT,
  buildClusteringPrompt,
  parseClusteringResponse,
} from "./clustering";

export {
  FEATURE_AS_VALUE_PATTERNS,
  MARKETING_LANGUAGE_PATTERNS,
  ABSTRACT_OUTCOME_PATTERNS,
  VAGUE_PHRASES,
  isFeatureAsValue,
  isVagueCandidate,
  isMarketingLanguage,
  findWithinLensDuplicates,
  hasUnverifiedFeatureRef,
  buildKnownFeaturesSet,
  runValidationPipeline,
  type ValidationLensResult,
} from "./validation";

// Convergence and tiering (S006)
export {
  type LlmProvider,
  type ConvergeOptions,
  assignTier,
  parseMergeResponse,
  directMerge,
  capTierDistribution,
  BUSINESS_VERBS,
  USER_ACTION_VERBS,
  isBusinessVerb,
  validateConvergenceQuality,
  MERGE_SYSTEM_PROMPT,
  buildMergePrompt,
  converge,
  runConvergence,
} from "./convergence";

export * from "./convergence-types";
