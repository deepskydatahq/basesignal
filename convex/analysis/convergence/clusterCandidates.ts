/**
 * Semantic clustering of validated candidates using TF-IDF + cosine similarity.
 *
 * Groups similar candidates across different lenses into clusters.
 * Candidates from the same lens are never merged into the same cluster.
 *
 * Approach:
 * 1. Compute TF-IDF vectors from candidate name + description
 * 2. Calculate pairwise cosine similarity
 * 3. Use union-find to build clusters with same-lens constraint
 * 4. Return CandidateCluster[] with traceability
 */

import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import type { ValidatedCandidate, CandidateCluster } from "./types";
import {
  computeTfIdfVectors,
  pairwiseSimilarity,
} from "../../lib/similarity";

// --- Union-Find ---

/**
 * Union-Find (disjoint set) data structure with path compression
 * and union by rank for efficient clustering.
 */
export class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  /**
   * Find the root of the set containing element x.
   * Uses path compression for amortized near-constant time.
   */
  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  /**
   * Merge the sets containing elements x and y.
   * Uses union by rank to keep the tree balanced.
   * Returns true if a merge occurred, false if already in same set.
   */
  union(x: number, y: number): boolean {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return false;

    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
    return true;
  }

  /**
   * Check if elements x and y are in the same set.
   */
  connected(x: number, y: number): boolean {
    return this.find(x) === this.find(y);
  }

  /**
   * Return groups as a map from root index to array of member indices.
   */
  groups(): Map<number, number[]> {
    const result = new Map<number, number[]>();
    for (let i = 0; i < this.parent.length; i++) {
      const root = this.find(i);
      const group = result.get(root);
      if (group) {
        group.push(i);
      } else {
        result.set(root, [i]);
      }
    }
    return result;
  }
}

// --- Clustering Logic (pure functions) ---

/** Default similarity threshold for clustering. */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

/**
 * Build the text to embed for a candidate: name + description concatenated.
 */
export function candidateText(candidate: ValidatedCandidate): string {
  return `${candidate.name} ${candidate.description}`;
}

/**
 * Check whether two candidates come from the same lens.
 */
export function sameLens(a: ValidatedCandidate, b: ValidatedCandidate): boolean {
  return a.lens === b.lens;
}

/**
 * Core clustering algorithm.
 *
 * 1. Compute TF-IDF vectors for all candidates
 * 2. Compute pairwise similarity
 * 3. For each pair above threshold from DIFFERENT lenses, union them
 * 4. Extract clusters from the union-find structure
 *
 * Returns CandidateCluster[] sorted by cluster size descending.
 */
export function clusterCandidatesCore(
  candidates: ValidatedCandidate[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): CandidateCluster[] {
  if (candidates.length === 0) return [];

  // Single candidate -> singleton cluster
  if (candidates.length === 1) {
    return [buildCluster("cluster-0", [candidates[0]])];
  }

  // 1. Compute TF-IDF vectors
  const documents = candidates.map(candidateText);
  const vectors = computeTfIdfVectors(documents);

  // 2. Compute pairwise similarity
  const n = candidates.length;
  const similarities = pairwiseSimilarity(vectors);

  // 3. Union-find with same-lens constraint
  const uf = new UnionFind(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = similarities[i * n + j];
      if (sim >= threshold && !sameLens(candidates[i], candidates[j])) {
        // Before merging, verify the merge won't create a cluster
        // with two candidates from the same lens
        if (canMerge(uf, candidates, i, j)) {
          uf.union(i, j);
        }
      }
    }
  }

  // 4. Extract clusters
  const groups = uf.groups();
  const clusters: CandidateCluster[] = [];
  let clusterIndex = 0;

  for (const [, memberIndices] of groups) {
    const clusterCandidates = memberIndices.map((idx) => candidates[idx]);
    clusters.push(
      buildCluster(`cluster-${clusterIndex}`, clusterCandidates)
    );
    clusterIndex++;
  }

  // Sort by cluster size descending (largest clusters first)
  clusters.sort((a, b) => b.candidates.length - a.candidates.length);

  return clusters;
}

/**
 * Check whether merging indices i and j would create a cluster
 * containing two candidates from the same lens.
 *
 * We need this because union-find is transitive: if A-B merge and B-C merge,
 * A and C end up in the same cluster even if A and C have the same lens.
 */
export function canMerge(
  uf: UnionFind,
  candidates: ValidatedCandidate[],
  i: number,
  j: number
): boolean {
  // Collect all lenses in the group that would be formed if i and j merge
  const rootI = uf.find(i);
  const rootJ = uf.find(j);

  // If already in same group, no conflict
  if (rootI === rootJ) return true;

  // Gather lenses from both groups
  const lenses = new Set<string>();
  for (let k = 0; k < candidates.length; k++) {
    const root = uf.find(k);
    if (root === rootI || root === rootJ) {
      if (lenses.has(candidates[k].lens)) {
        return false; // Merging would create duplicate lens
      }
      lenses.add(candidates[k].lens);
    }
  }

  return true;
}

/**
 * Build a CandidateCluster from a set of candidates.
 */
export function buildCluster(
  clusterId: string,
  candidates: ValidatedCandidate[]
): CandidateCluster {
  const lensSet = new Set(candidates.map((c) => c.lens));
  return {
    cluster_id: clusterId,
    candidates,
    lens_count: lensSet.size,
    lenses: [...lensSet].sort(),
  };
}

// --- Convex internalAction ---

/**
 * Cluster validated candidates into groups based on semantic similarity.
 *
 * Input: Array of ValidatedCandidate objects (from the validation pass).
 * Output: Array of CandidateCluster objects.
 *
 * Uses TF-IDF + cosine similarity (pure TypeScript, no external APIs).
 * Same-lens candidates are never placed in the same cluster.
 */
export const clusterCandidates = internalAction({
  args: {
    candidates: v.any(),
    threshold: v.optional(v.number()),
  },
  handler: async (
    _ctx,
    args: { candidates: ValidatedCandidate[]; threshold?: number }
  ): Promise<CandidateCluster[]> => {
    const threshold = args.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;

    // Filter out removed candidates before clustering
    const activeCandidates = args.candidates.filter(
      (c) => c.validation_status !== "removed"
    );

    const clusters = clusterCandidatesCore(activeCandidates, threshold);

    console.log(
      `Clustered ${activeCandidates.length} candidates into ${clusters.length} clusters ` +
        `(${clusters.filter((c) => c.lens_count > 1).length} multi-lens)`
    );

    return clusters;
  },
});
