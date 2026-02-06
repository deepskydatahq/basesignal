/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountMappings from "../accountMappings.js";
import type * as activity from "../activity.js";
import type * as activityDefinitions from "../activityDefinitions.js";
import type * as ai from "../ai.js";
import type * as amplitude from "../amplitude.js";
import type * as amplitudeActions from "../amplitudeActions.js";
import type * as analysis_convergence_clusterCandidates from "../analysis/convergence/clusterCandidates.js";
import type * as analysis_convergence_types from "../analysis/convergence/types.js";
import type * as analysis_extractActivationLevels from "../analysis/extractActivationLevels.js";
import type * as analysis_extractIdentity from "../analysis/extractIdentity.js";
import type * as analysis_extractJourney from "../analysis/extractJourney.js";
import type * as analysis_orchestrate from "../analysis/orchestrate.js";
import type * as communityJoin from "../communityJoin.js";
import type * as crawledPages from "../crawledPages.js";
import type * as devReset from "../devReset.js";
import type * as entities from "../entities.js";
import type * as extractEntities from "../extractEntities.js";
import type * as extractOutcomes from "../extractOutcomes.js";
import type * as extractRevenue from "../extractRevenue.js";
import type * as firstValue from "../firstValue.js";
import type * as http from "../http.js";
import type * as interviewTypes from "../interviewTypes.js";
import type * as interviews from "../interviews.js";
import type * as journeys from "../journeys.js";
import type * as lib_extractOutcomesHelpers from "../lib/extractOutcomesHelpers.js";
import type * as lib_metricSuggestions from "../lib/metricSuggestions.js";
import type * as lib_similarity from "../lib/similarity.js";
import type * as lib_urlUtils from "../lib/urlUtils.js";
import type * as mcpProducts from "../mcpProducts.js";
import type * as measurementPlan from "../measurementPlan.js";
import type * as measurementProperties from "../measurementProperties.js";
import type * as metricCatalog from "../metricCatalog.js";
import type * as metrics from "../metrics.js";
import type * as overviewInterview from "../overviewInterview.js";
import type * as productProfiles from "../productProfiles.js";
import type * as products from "../products.js";
import type * as profile from "../profile.js";
import type * as scanJobs from "../scanJobs.js";
import type * as scanning from "../scanning.js";
import type * as scans from "../scans.js";
import type * as seed from "../seed.js";
import type * as setupProgress from "../setupProgress.js";
import type * as sources from "../sources.js";
import type * as stages from "../stages.js";
import type * as suggestMetrics from "../suggestMetrics.js";
import type * as transitions from "../transitions.js";
import type * as users from "../users.js";
import type * as valueRules from "../valueRules.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountMappings: typeof accountMappings;
  activity: typeof activity;
  activityDefinitions: typeof activityDefinitions;
  ai: typeof ai;
  amplitude: typeof amplitude;
  amplitudeActions: typeof amplitudeActions;
  "analysis/convergence/clusterCandidates": typeof analysis_convergence_clusterCandidates;
  "analysis/convergence/types": typeof analysis_convergence_types;
  "analysis/extractActivationLevels": typeof analysis_extractActivationLevels;
  "analysis/extractIdentity": typeof analysis_extractIdentity;
  "analysis/extractJourney": typeof analysis_extractJourney;
  "analysis/orchestrate": typeof analysis_orchestrate;
  communityJoin: typeof communityJoin;
  crawledPages: typeof crawledPages;
  devReset: typeof devReset;
  entities: typeof entities;
  extractEntities: typeof extractEntities;
  extractOutcomes: typeof extractOutcomes;
  extractRevenue: typeof extractRevenue;
  firstValue: typeof firstValue;
  http: typeof http;
  interviewTypes: typeof interviewTypes;
  interviews: typeof interviews;
  journeys: typeof journeys;
  "lib/extractOutcomesHelpers": typeof lib_extractOutcomesHelpers;
  "lib/metricSuggestions": typeof lib_metricSuggestions;
  "lib/similarity": typeof lib_similarity;
  "lib/urlUtils": typeof lib_urlUtils;
  mcpProducts: typeof mcpProducts;
  measurementPlan: typeof measurementPlan;
  measurementProperties: typeof measurementProperties;
  metricCatalog: typeof metricCatalog;
  metrics: typeof metrics;
  overviewInterview: typeof overviewInterview;
  productProfiles: typeof productProfiles;
  products: typeof products;
  profile: typeof profile;
  scanJobs: typeof scanJobs;
  scanning: typeof scanning;
  scans: typeof scans;
  seed: typeof seed;
  setupProgress: typeof setupProgress;
  sources: typeof sources;
  stages: typeof stages;
  suggestMetrics: typeof suggestMetrics;
  transitions: typeof transitions;
  users: typeof users;
  valueRules: typeof valueRules;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
