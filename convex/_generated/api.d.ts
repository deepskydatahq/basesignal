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
import type * as activityDefinitions from "../activityDefinitions.js";
import type * as ai from "../ai.js";
import type * as amplitude from "../amplitude.js";
import type * as amplitudeActions from "../amplitudeActions.js";
import type * as communityJoin from "../communityJoin.js";
import type * as devReset from "../devReset.js";
import type * as entities from "../entities.js";
import type * as firstValue from "../firstValue.js";
import type * as http from "../http.js";
import type * as interviewTypes from "../interviewTypes.js";
import type * as interviews from "../interviews.js";
import type * as journeys from "../journeys.js";
import type * as measurementPlan from "../measurementPlan.js";
import type * as measurementProperties from "../measurementProperties.js";
import type * as metricCatalog from "../metricCatalog.js";
import type * as metrics from "../metrics.js";
import type * as overviewInterview from "../overviewInterview.js";
import type * as profile from "../profile.js";
import type * as seed from "../seed.js";
import type * as setupProgress from "../setupProgress.js";
import type * as sources from "../sources.js";
import type * as stages from "../stages.js";
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
  activityDefinitions: typeof activityDefinitions;
  ai: typeof ai;
  amplitude: typeof amplitude;
  amplitudeActions: typeof amplitudeActions;
  communityJoin: typeof communityJoin;
  devReset: typeof devReset;
  entities: typeof entities;
  firstValue: typeof firstValue;
  http: typeof http;
  interviewTypes: typeof interviewTypes;
  interviews: typeof interviews;
  journeys: typeof journeys;
  measurementPlan: typeof measurementPlan;
  measurementProperties: typeof measurementProperties;
  metricCatalog: typeof metricCatalog;
  metrics: typeof metrics;
  overviewInterview: typeof overviewInterview;
  profile: typeof profile;
  seed: typeof seed;
  setupProgress: typeof setupProgress;
  sources: typeof sources;
  stages: typeof stages;
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
