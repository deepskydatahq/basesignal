// Pure TF-IDF similarity library for semantic clustering
// No external dependencies — deterministic, sub-100ms for 60-100 candidates

export type TfIdfVector = Map<string, number>;

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "not", "only", "own", "same", "so", "than", "too", "very", "just",
  "because", "but", "and", "or", "if", "while", "about", "against",
  "this", "that", "these", "those", "it", "its", "i", "me", "my",
  "we", "our", "you", "your", "he", "him", "his", "she", "her",
  "they", "them", "their", "what", "which", "who", "whom",
]);

/**
 * Tokenize text into lowercase terms, removing stop words and short tokens.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Compute term frequency for a list of tokens.
 * Returns a map of term → (count / total tokens).
 */
export function termFrequency(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const total = tokens.length;
  if (total === 0) return counts;
  const tf = new Map<string, number>();
  for (const [term, count] of counts) {
    tf.set(term, count / total);
  }
  return tf;
}

/**
 * Compute inverse document frequency across a corpus of token lists.
 * Uses smoothed IDF: log((N + 1) / (df + 1)) + 1
 * This prevents zero weights when a term appears in all documents.
 */
export function inverseDocumentFrequency(
  corpus: string[][]
): Map<string, number> {
  const N = corpus.length;
  const df = new Map<string, number>();
  for (const tokens of corpus) {
    const seen = new Set(tokens);
    for (const term of seen) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log((N + 1) / (count + 1)) + 1);
  }
  return idf;
}

/**
 * Compute TF-IDF vectors for a set of documents.
 * Each document is a string. Returns one TfIdfVector per document.
 */
export function computeTfIdfVectors(documents: string[]): TfIdfVector[] {
  const tokenized = documents.map(tokenize);
  const idf = inverseDocumentFrequency(tokenized);

  return tokenized.map((tokens) => {
    const tf = termFrequency(tokens);
    const vector: TfIdfVector = new Map();
    for (const [term, tfVal] of tf) {
      const idfVal = idf.get(term) ?? 0;
      vector.set(term, tfVal * idfVal);
    }
    return vector;
  });
}

/**
 * Compute cosine similarity between two TF-IDF vectors.
 * Returns a value in [0, 1]. Returns 0 if either vector is empty.
 */
export function cosineSimilarity(a: TfIdfVector, b: TfIdfVector): number {
  if (a.size === 0 || b.size === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, valA] of a) {
    normA += valA * valA;
    const valB = b.get(term);
    if (valB !== undefined) {
      dot += valA * valB;
    }
  }
  for (const [, valB] of b) {
    normB += valB * valB;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Compute pairwise similarity matrix for a set of TF-IDF vectors.
 * Returns a flat array of { i, j, similarity } for all pairs where i < j.
 */
export function pairwiseSimilarity(
  vectors: TfIdfVector[]
): Array<{ i: number; j: number; similarity: number }> {
  const pairs: Array<{ i: number; j: number; similarity: number }> = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const similarity = cosineSimilarity(vectors[i], vectors[j]);
      pairs.push({ i, j, similarity });
    }
  }
  return pairs;
}
