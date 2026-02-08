/**
 * Text similarity utilities using TF-IDF vectors and cosine similarity.
 * Used by the candidate validation pipeline for duplicate detection.
 */

/** Tokenize text into lowercase words, stripping punctuation */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Compute term frequency map for a list of tokens */
export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  // Normalize by total tokens
  const total = tokens.length;
  if (total > 0) {
    for (const [term, count] of tf) {
      tf.set(term, count / total);
    }
  }
  return tf;
}

/** Compute inverse document frequency from a collection of token lists */
export function inverseDocumentFrequency(
  documents: string[][]
): Map<string, number> {
  const docCount = documents.length;
  const df = new Map<string, number>();

  for (const tokens of documents) {
    const seen = new Set(tokens);
    for (const term of seen) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log((docCount + 1) / (count + 1)) + 1);
  }
  return idf;
}

/** Compute TF-IDF vector for a document given its tokens and IDF map */
export function tfidfVector(
  tokens: string[],
  idf: Map<string, number>
): Map<string, number> {
  const tf = termFrequency(tokens);
  const vector = new Map<string, number>();
  for (const [term, tfVal] of tf) {
    const idfVal = idf.get(term) ?? 1;
    vector.set(term, tfVal * idfVal);
  }
  return vector;
}

/** Compute cosine similarity between two sparse vectors */
export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, val] of a) {
    normA += val * val;
    const bVal = b.get(term);
    if (bVal !== undefined) {
      dotProduct += val * bVal;
    }
  }

  for (const [, val] of b) {
    normB += val * val;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Compute TF-IDF vectors for a set of texts.
 * Returns one vector per input text, sharing the same IDF values.
 */
export function computeTfIdfVectors(
  texts: string[]
): Map<string, number>[] {
  const tokenized = texts.map(tokenize);
  const idf = inverseDocumentFrequency(tokenized);
  return tokenized.map((tokens) => tfidfVector(tokens, idf));
}
