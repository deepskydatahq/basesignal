import { computeTfIdfVectors, cosineSimilarity } from "./similarity";
import { extractJson } from "./json";
import type {
  ValidatedCandidate,
  CandidateCluster,
  ExperientialLensType,
} from "../types/convergence";

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
  const iLenses = new Set<ExperientialLensType>();
  const jLenses = new Set<ExperientialLensType>();

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

// --- LLM clustering prompt/parser ---

export const CLUSTERING_SYSTEM_PROMPT = `You are a product analyst grouping value moment candidates into semantic clusters.

You will receive a numbered list of candidates from different analytical lenses (jtbd, outcomes, pains, gains, alternatives, workflows, emotions). Each candidate describes a value moment a product provides.

Your job: group candidates that describe the SAME user action or in-product experience into clusters.

Rules:
1. NEVER place two candidates from the SAME lens in the same cluster. Each cluster must have at most one candidate per lens.
2. Target 15-30 clusters total. Prefer more granular clusters over overly broad ones.
3. Candidates that don't clearly belong with others should be singleton clusters.
4. Group by shared user action, not abstract theme or surface-level keyword overlap.

Return a JSON array of clusters. Each cluster is an object with:
- "label": a short (3-8 word) descriptive label for the cluster, describing a user action
- "candidate_ids": array of candidate ID strings that belong to this cluster

Example:
\`\`\`json
[
  { "label": "Configure deployment pipeline steps", "candidate_ids": ["c1", "c5", "c12"] },
  { "label": "Comment on shared documents", "candidate_ids": ["c3", "c8"] },
  { "label": "View invoice breakdown details", "candidate_ids": ["c7"] }
]
\`\`\`

Return ONLY the JSON array, no commentary.`;

/**
 * Build the user prompt listing all candidates for LLM clustering.
 */
export function buildClusteringPrompt(candidates: ValidatedCandidate[]): string {
  const lines = candidates.map(
    (c) =>
      `[${c.id}] (${c.lens}) ${c.name}: ${c.description}`
  );
  return `Group these ${candidates.length} candidates into semantic clusters:\n\n${lines.join("\n")}`;
}

/**
 * Parse LLM clustering response into CandidateCluster[].
 * Handles JSON in code fences and raw JSON.
 * Repairs same-lens violations by ejecting violators as singletons.
 * Adds orphaned candidates (not mentioned by LLM) as singleton clusters.
 */
export function parseClusteringResponse(
  responseText: string,
  candidates: ValidatedCandidate[]
): CandidateCluster[] {
  const parsed = extractJson(responseText);

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array of clusters, got ${typeof parsed}`);
  }

  // Build lookup map: id -> candidate
  const candidateMap = new Map<string, ValidatedCandidate>();
  for (const c of candidates) {
    candidateMap.set(c.id, c);
  }

  const assignedIds = new Set<string>();
  const clusters: CandidateCluster[] = [];
  let clusterIndex = 0;

  for (const item of parsed) {
    const ids: string[] = Array.isArray(item.candidate_ids)
      ? item.candidate_ids.map(String)
      : [];

    // Resolve candidates and filter out unknown IDs
    const resolved: ValidatedCandidate[] = [];
    for (const id of ids) {
      const candidate = candidateMap.get(id);
      if (candidate && !assignedIds.has(id)) {
        resolved.push(candidate);
        assignedIds.add(id);
      }
    }

    if (resolved.length === 0) continue;

    // Same-lens repair: keep first candidate per lens, eject duplicates
    const seenLenses = new Set<ExperientialLensType>();
    const kept: ValidatedCandidate[] = [];
    const ejected: ValidatedCandidate[] = [];

    for (const c of resolved) {
      if (seenLenses.has(c.lens)) {
        ejected.push(c);
      } else {
        seenLenses.add(c.lens);
        kept.push(c);
      }
    }

    if (kept.length > 0) {
      clusters.push(buildCluster(`cluster-${clusterIndex++}`, kept));
    }

    // Ejected candidates become singleton clusters
    for (const c of ejected) {
      clusters.push(buildCluster(`cluster-${clusterIndex++}`, [c]));
    }
  }

  // Orphan handling: candidates not assigned by LLM become singletons
  for (const c of candidates) {
    if (!assignedIds.has(c.id)) {
      clusters.push(buildCluster(`cluster-${clusterIndex++}`, [c]));
    }
  }

  return clusters;
}
