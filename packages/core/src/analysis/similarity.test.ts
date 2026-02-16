import { describe, it, expect } from "vitest";
import {
  tokenize,
  termFrequency,
  inverseDocumentFrequency,
  computeTfIdfVectors,
  cosineSimilarity,
  pairwiseSimilarity,
} from "./similarity";

describe("tokenize", () => {
  it("lowercases and splits on whitespace", () => {
    expect(tokenize("Hello World")).toEqual(["hello", "world"]);
  });

  it("removes stop words", () => {
    const tokens = tokenize("the quick brown fox is a very fast animal");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("is");
    expect(tokens).not.toContain("a");
    expect(tokens).not.toContain("very");
    expect(tokens).toContain("quick");
    expect(tokens).toContain("brown");
    expect(tokens).toContain("fox");
    expect(tokens).toContain("fast");
    expect(tokens).toContain("animal");
  });

  it("removes single-character tokens", () => {
    expect(tokenize("I a b c test")).toEqual(["test"]);
  });

  it("removes punctuation", () => {
    const tokens = tokenize("reduce deployment time (CI/CD)");
    expect(tokens).toContain("reduce");
    expect(tokens).toContain("deployment");
    expect(tokens).toContain("time");
    expect(tokens).toContain("ci");
    expect(tokens).toContain("cd");
  });

  it("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("handles hyphenated words", () => {
    const tokens = tokenize("real-time collaboration");
    expect(tokens).toContain("real-time");
    expect(tokens).toContain("collaboration");
  });
});

describe("termFrequency", () => {
  it("computes frequency for each term", () => {
    const tf = termFrequency(["cat", "dog", "cat", "cat"]);
    expect(tf.get("cat")).toBeCloseTo(0.75);
    expect(tf.get("dog")).toBeCloseTo(0.25);
  });

  it("returns empty map for empty tokens", () => {
    const tf = termFrequency([]);
    expect(tf.size).toBe(0);
  });

  it("returns 1.0 for single-token document", () => {
    const tf = termFrequency(["hello"]);
    expect(tf.get("hello")).toBe(1);
  });
});

describe("inverseDocumentFrequency", () => {
  it("gives higher weight to rare terms", () => {
    const corpus = [
      ["project", "management"],
      ["project", "tracking"],
      ["team", "collaboration"],
    ];
    const idf = inverseDocumentFrequency(corpus);
    // "project" appears in 2/3 docs, "management" in 1/3
    expect(idf.get("management")!).toBeGreaterThan(idf.get("project")!);
  });

  it("uses smoothed IDF (never zero for shared terms)", () => {
    const corpus = [
      ["task", "management"],
      ["task", "tracking"],
    ];
    const idf = inverseDocumentFrequency(corpus);
    // "task" appears in all docs but should still have non-zero weight
    expect(idf.get("task")!).toBeGreaterThan(0);
  });

  it("handles single-document corpus", () => {
    const corpus = [["hello", "world"]];
    const idf = inverseDocumentFrequency(corpus);
    expect(idf.get("hello")).toBeDefined();
    expect(idf.get("hello")!).toBeGreaterThan(0);
  });
});

describe("computeTfIdfVectors", () => {
  it("returns one vector per document", () => {
    const vectors = computeTfIdfVectors(["doc one", "doc two", "doc three"]);
    expect(vectors).toHaveLength(3);
  });

  it("assigns higher weight to distinguishing terms", () => {
    const vectors = computeTfIdfVectors([
      "track team tasks and projects",
      "track team progress and velocity",
      "manage customer billing invoices",
    ]);
    // "billing" is unique to doc 3, should have higher weight than "track" (in 2 docs)
    const billingWeight = vectors[2].get("billing") ?? 0;
    const trackWeight = vectors[0].get("track") ?? 0;
    expect(billingWeight).toBeGreaterThan(trackWeight);
  });

  it("handles empty documents", () => {
    const vectors = computeTfIdfVectors(["", "hello world"]);
    expect(vectors[0].size).toBe(0);
    expect(vectors[1].size).toBeGreaterThan(0);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const vectors = computeTfIdfVectors([
      "reduce deployment time",
      "reduce deployment time",
    ]);
    expect(cosineSimilarity(vectors[0], vectors[1])).toBeCloseTo(1.0);
  });

  it("returns 0 for completely disjoint vectors", () => {
    const a = new Map([["alpha", 1]]);
    const b = new Map([["beta", 1]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns high similarity for semantically related text", () => {
    const vectors = computeTfIdfVectors([
      "reduce deployment time by automating CI/CD pipeline",
      "decrease deployment duration through CI/CD automation",
    ]);
    // Shared terms: deployment, ci, cd — should give moderate-high similarity
    expect(cosineSimilarity(vectors[0], vectors[1])).toBeGreaterThan(0.3);
  });

  it("returns low similarity for unrelated text", () => {
    const vectors = computeTfIdfVectors([
      "reduce deployment time by automating CI/CD pipeline",
      "manage customer billing and subscription renewals",
    ]);
    expect(cosineSimilarity(vectors[0], vectors[1])).toBeLessThan(0.2);
  });

  it("returns 0 for empty vectors", () => {
    const empty = new Map<string, number>();
    const nonEmpty = new Map([["hello", 1]]);
    expect(cosineSimilarity(empty, nonEmpty)).toBe(0);
    expect(cosineSimilarity(nonEmpty, empty)).toBe(0);
    expect(cosineSimilarity(empty, empty)).toBe(0);
  });

  it("is commutative", () => {
    const vectors = computeTfIdfVectors([
      "track sprint velocity and burndown",
      "monitor team velocity metrics",
    ]);
    const ab = cosineSimilarity(vectors[0], vectors[1]);
    const ba = cosineSimilarity(vectors[1], vectors[0]);
    expect(ab).toBeCloseTo(ba);
  });

  it("returns value between 0 and 1", () => {
    const vectors = computeTfIdfVectors([
      "reduce deployment time",
      "track project progress",
      "manage team resources",
    ]);
    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        const sim = cosineSimilarity(vectors[i], vectors[j]);
        expect(sim).toBeGreaterThanOrEqual(0);
        expect(sim).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("pairwiseSimilarity", () => {
  it("returns correct number of pairs", () => {
    const vectors = computeTfIdfVectors(["a", "b", "c"]);
    const pairs = pairwiseSimilarity(vectors);
    // n*(n-1)/2 = 3*2/2 = 3
    expect(pairs).toHaveLength(3);
  });

  it("pairs have correct indices (i < j)", () => {
    const vectors = computeTfIdfVectors(["doc one", "doc two", "doc three"]);
    const pairs = pairwiseSimilarity(vectors);
    for (const p of pairs) {
      expect(p.i).toBeLessThan(p.j);
    }
  });

  it("returns empty array for single document", () => {
    const vectors = computeTfIdfVectors(["single doc"]);
    expect(pairwiseSimilarity(vectors)).toHaveLength(0);
  });

  it("returns empty array for no documents", () => {
    expect(pairwiseSimilarity([])).toHaveLength(0);
  });

  it("similarity values are between 0 and 1", () => {
    const vectors = computeTfIdfVectors([
      "project management tool",
      "project tracking software",
      "customer billing system",
      "team collaboration platform",
    ]);
    const pairs = pairwiseSimilarity(vectors);
    for (const p of pairs) {
      expect(p.similarity).toBeGreaterThanOrEqual(0);
      expect(p.similarity).toBeLessThanOrEqual(1);
    }
  });

  it("finds similar pairs above threshold", () => {
    const vectors = computeTfIdfVectors([
      "track team sprint velocity",
      "monitor team sprint velocity metrics",
      "manage customer billing invoices",
    ]);
    const pairs = pairwiseSimilarity(vectors);
    // docs 0 and 1 should be more similar than either with doc 2
    const sim01 = pairs.find((p) => p.i === 0 && p.j === 1)!.similarity;
    const sim02 = pairs.find((p) => p.i === 0 && p.j === 2)!.similarity;
    const sim12 = pairs.find((p) => p.i === 1 && p.j === 2)!.similarity;
    expect(sim01).toBeGreaterThan(sim02);
    expect(sim01).toBeGreaterThan(sim12);
  });
});
