/**
 * Pure TypeScript TF-IDF + cosine similarity implementation.
 *
 * No external dependencies. Designed for clustering 60-100 candidate
 * descriptions where each document is a short text (name + description).
 */

// --- Tokenization ---

/**
 * Basic English stop words to filter out common low-signal terms.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "dare",
  "it", "its", "this", "that", "these", "those", "i", "you", "he", "she",
  "we", "they", "me", "him", "her", "us", "them", "my", "your", "his",
  "our", "their", "what", "which", "who", "whom", "when", "where", "why",
  "how", "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "because", "as", "until", "while",
  "about", "between", "through", "during", "before", "after", "above",
  "below", "up", "down", "out", "off", "over", "under", "again",
  "further", "then", "once", "here", "there", "also", "into",
]);

/**
 * Tokenize text into lowercase word tokens, filtering stop words
 * and tokens shorter than 2 characters.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

// --- TF-IDF ---

/**
 * Term frequency: count of each token in a document, normalized by
 * document length.
 */
export function termFrequency(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const length = tokens.length;
  if (length === 0) return counts;
  for (const [term, count] of counts) {
    counts.set(term, count / length);
  }
  return counts;
}

/**
 * Inverse document frequency for each term across a corpus.
 * Uses smoothed IDF: log(1 + N / (1 + df(t))) to handle small corpora
 * where most terms appear in all documents. Without smoothing, shared
 * terms get IDF=0 and nearly identical texts become orthogonal.
 */
export function inverseDocumentFrequency(
  tokenizedDocs: string[][]
): Map<string, number> {
  const docCount = tokenizedDocs.length;
  const df = new Map<string, number>();

  for (const tokens of tokenizedDocs) {
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log(1 + docCount / (1 + count)));
  }
  return idf;
}

/**
 * A TF-IDF vector represented as a Map from term to weight.
 */
export type TfIdfVector = Map<string, number>;

/**
 * Compute TF-IDF vectors for a list of documents.
 * Each document is a string that will be tokenized internally.
 */
export function computeTfIdfVectors(documents: string[]): TfIdfVector[] {
  const tokenizedDocs = documents.map(tokenize);
  const idf = inverseDocumentFrequency(tokenizedDocs);

  return tokenizedDocs.map((tokens) => {
    const tf = termFrequency(tokens);
    const vector: TfIdfVector = new Map();
    for (const [term, tfVal] of tf) {
      const idfVal = idf.get(term) ?? 0;
      const weight = tfVal * idfVal;
      if (weight > 0) {
        vector.set(term, weight);
      }
    }
    return vector;
  });
}

// --- Cosine Similarity ---

/**
 * Compute cosine similarity between two TF-IDF vectors.
 * Returns a value between 0 and 1 (vectors are non-negative).
 */
export function cosineSimilarity(a: TfIdfVector, b: TfIdfVector): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, weightA] of a) {
    normA += weightA * weightA;
    const weightB = b.get(term);
    if (weightB !== undefined) {
      dotProduct += weightA * weightB;
    }
  }

  for (const [, weightB] of b) {
    normB += weightB * weightB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Compute the full pairwise similarity matrix for a set of TF-IDF vectors.
 * Returns a flat array where entry [i * n + j] is the similarity between
 * document i and document j.
 */
export function pairwiseSimilarity(vectors: TfIdfVector[]): number[] {
  const n = vectors.length;
  const matrix = new Array<number>(n * n).fill(0);

  for (let i = 0; i < n; i++) {
    matrix[i * n + i] = 1; // self-similarity
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      matrix[i * n + j] = sim;
      matrix[j * n + i] = sim;
    }
  }

  return matrix;
}
