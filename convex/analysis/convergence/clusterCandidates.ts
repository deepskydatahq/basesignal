import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import {
  computeTfIdfVectors,
  cosineSimilarity,
} from "../../lib/similarity";
import type {
  ValidatedCandidate,
  CandidateCluster,
  LensType,
} from "./types";

export const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

// --- Union-Find data structure ---

export class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // path compression
    }
    return this.parent[x];
  }

  union(x: number, y: number): void {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return;
    // union by rank
    if (this.rank[rx] < this.rank[ry]) {
      this.parent[rx] = ry;
    } else if (this.rank[rx] > this.rank[ry]) {
      this.parent[ry] = rx;
    } else {
      this.parent[ry] = rx;
      this.rank[rx]++;
    }
  }

  connected(x: number, y: number): boolean {
    return this.find(x) === this.find(y);
  }
}

// --- Helper functions ---

/**
 * Build the text representation of a candidate for TF-IDF vectorization.
 */
export function candidateText(candidate: ValidatedCandidate): string {
  return `${candidate.name} ${candidate.description}`;
}

/**
 * Check if two candidates are from the same lens.
 */
export function sameLens(a: ValidatedCandidate, b: ValidatedCandidate): boolean {
  return a.lens === b.lens;
}

/**
 * Check if merging two candidates would violate the same-lens constraint
 * in the current union-find state. Two candidates can merge only if no
 * candidate in one's cluster shares a lens with any candidate in the other's.
 */
export function canMerge(
  uf: UnionFind,
  i: number,
  j: number,
  candidates: ValidatedCandidate[]
): boolean {
  // Collect lenses in i's cluster
  const iLenses = new Set<LensType>();
  const jLenses = new Set<LensType>();

  for (let k = 0; k < candidates.length; k++) {
    if (uf.connected(i, k)) {
      iLenses.add(candidates[k].lens);
    }
    if (uf.connected(j, k)) {
      jLenses.add(candidates[k].lens);
    }
  }

  // Check for overlap
  for (const lens of iLenses) {
    if (jLenses.has(lens)) return false;
  }
  return true;
}

/**
 * Build a CandidateCluster from a group of candidates.
 */
export function buildCluster(
  clusterId: string,
  candidates: ValidatedCandidate[]
): CandidateCluster {
  const lenses = [...new Set(candidates.map((c) => c.lens))];
  return {
    cluster_id: clusterId,
    candidates,
    lens_count: lenses.length,
    lenses,
  };
}

// --- Core clustering function ---

/**
 * Cluster validated candidates by semantic similarity using TF-IDF + cosine similarity.
 *
 * Candidates from the same lens are never placed in the same cluster.
 * Uses union-find for efficient cluster merging with canMerge pre-check
 * to prevent transitive same-lens violations.
 */
export function clusterCandidatesCore(
  candidates: ValidatedCandidate[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): CandidateCluster[] {
  if (candidates.length === 0) return [];

  // Compute TF-IDF vectors
  const texts = candidates.map(candidateText);
  const vectors = computeTfIdfVectors(texts);

  // Initialize union-find
  const uf = new UnionFind(candidates.length);

  // Compute pairwise similarity and merge where appropriate
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      // Skip same-lens pairs
      if (sameLens(candidates[i], candidates[j])) continue;

      const similarity = cosineSimilarity(vectors[i], vectors[j]);
      if (similarity >= threshold && canMerge(uf, i, j, candidates)) {
        uf.union(i, j);
      }
    }
  }

  // Group candidates by cluster root
  const groups = new Map<number, ValidatedCandidate[]>();
  for (let i = 0; i < candidates.length; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(candidates[i]);
  }

  // Build cluster objects
  let clusterIndex = 0;
  const clusters: CandidateCluster[] = [];
  for (const [, group] of groups) {
    clusters.push(buildCluster(`cluster-${clusterIndex++}`, group));
  }

  return clusters;
}

// --- Convex internalAction ---

export const clusterCandidates = internalAction({
  args: {
    productId: v.id("products"),
    validatedCandidates: v.any(),
    threshold: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const candidates = args.validatedCandidates as ValidatedCandidate[];

    // Filter out removed candidates
    const active = candidates.filter((c) => c.validation_status !== "removed");

    const threshold = args.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    return clusterCandidatesCore(active, threshold);
  },
});
