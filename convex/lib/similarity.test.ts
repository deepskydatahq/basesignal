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
    const tokens = tokenize("Hello World");
    expect(tokens).toEqual(["hello", "world"]);
  });

  it("removes punctuation", () => {
    const tokens = tokenize("user's project-management tool.");
    expect(tokens).toContain("user");
    expect(tokens).toContain("project");
    expect(tokens).toContain("management");
    expect(tokens).toContain("tool");
  });

  it("filters stop words", () => {
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

  it("filters tokens shorter than 2 characters", () => {
    const tokens = tokenize("I x am a b testing c");
    expect(tokens).not.toContain("x");
    expect(tokens).not.toContain("b");
    expect(tokens).not.toContain("c");
    expect(tokens).toContain("testing");
  });

  it("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("handles string with only stop words", () => {
    expect(tokenize("the a is and or")).toEqual([]);
  });
});

describe("termFrequency", () => {
  it("computes normalized term frequency", () => {
    const tokens = ["project", "management", "project"];
    const tf = termFrequency(tokens);
    expect(tf.get("project")).toBeCloseTo(2 / 3);
    expect(tf.get("management")).toBeCloseTo(1 / 3);
  });

  it("handles single token", () => {
    const tf = termFrequency(["hello"]);
    expect(tf.get("hello")).toBe(1);
  });

  it("handles empty array", () => {
    const tf = termFrequency([]);
    expect(tf.size).toBe(0);
  });
});

describe("inverseDocumentFrequency", () => {
  it("computes IDF for terms across documents", () => {
    const docs = [
      ["project", "management"],
      ["project", "tracking"],
      ["issue", "tracking"],
    ];
    const idf = inverseDocumentFrequency(docs);

    // Smoothed IDF: log(1 + N / (1 + df))
    // "project" appears in 2 of 3 docs: log(1 + 3/3) = log(2)
    expect(idf.get("project")).toBeCloseTo(Math.log(1 + 3 / (1 + 2)));
    // "tracking" appears in 2 of 3 docs: log(1 + 3/3) = log(2)
    expect(idf.get("tracking")).toBeCloseTo(Math.log(1 + 3 / (1 + 2)));
    // "management" appears in 1 of 3 docs: log(1 + 3/2) = log(2.5)
    expect(idf.get("management")).toBeCloseTo(Math.log(1 + 3 / (1 + 1)));
    // "issue" appears in 1 of 3 docs: log(1 + 3/2) = log(2.5)
    expect(idf.get("issue")).toBeCloseTo(Math.log(1 + 3 / (1 + 1)));
  });

  it("returns small positive IDF for terms in all documents (smoothed)", () => {
    const docs = [["common"], ["common"], ["common"]];
    const idf = inverseDocumentFrequency(docs);
    // Smoothed: log(1 + 3/4) = log(1.75) > 0
    expect(idf.get("common")).toBeGreaterThan(0);
    expect(idf.get("common")).toBeCloseTo(Math.log(1 + 3 / (1 + 3)));
  });
});

describe("computeTfIdfVectors", () => {
  it("returns one vector per document", () => {
    const docs = ["project management tool", "issue tracking system"];
    const vectors = computeTfIdfVectors(docs);
    expect(vectors).toHaveLength(2);
  });

  it("produces non-zero weights for distinctive terms", () => {
    const docs = [
      "project management tool for teams",
      "issue tracking system for developers",
    ];
    const vectors = computeTfIdfVectors(docs);

    // "project" is in doc 0 only, should have positive weight
    expect(vectors[0].get("project")).toBeGreaterThan(0);
    // "issue" is in doc 1 only, should have positive weight
    expect(vectors[1].get("issue")).toBeGreaterThan(0);
  });

  it("produces lower weight for terms shared across all documents", () => {
    const docs = ["team collaboration tool", "team productivity tool"];
    const vectors = computeTfIdfVectors(docs);

    // With smoothed IDF, shared terms still have positive weight
    // but distinctive terms should have higher weight
    const sharedWeight = vectors[0].get("team") ?? 0;
    const distinctiveWeight = vectors[0].get("collaboration") ?? 0;
    expect(distinctiveWeight).toBeGreaterThan(sharedWeight);
  });

  it("handles empty document list", () => {
    expect(computeTfIdfVectors([])).toEqual([]);
  });

  it("handles document with only stop words", () => {
    const vectors = computeTfIdfVectors(["the and or is"]);
    expect(vectors).toHaveLength(1);
    expect(vectors[0].size).toBe(0);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = new Map([["a", 1], ["b", 2]]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Map([["x", 1]]);
    const b = new Map([["y", 1]]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it("returns value between 0 and 1 for partially overlapping vectors", () => {
    const a = new Map([["x", 1], ["y", 1]]);
    const b = new Map([["y", 1], ["z", 1]]);
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it("returns 0 for empty vectors", () => {
    const empty = new Map<string, number>();
    const v = new Map([["a", 1]]);
    expect(cosineSimilarity(empty, v)).toBe(0);
    expect(cosineSimilarity(v, empty)).toBe(0);
    expect(cosineSimilarity(empty, empty)).toBe(0);
  });

  it("is commutative", () => {
    const a = new Map([["x", 1], ["y", 2]]);
    const b = new Map([["y", 3], ["z", 1]]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a));
  });
});

describe("pairwiseSimilarity", () => {
  it("returns identity diagonal", () => {
    const vectors = [
      new Map([["a", 1]]),
      new Map([["b", 1]]),
    ];
    const matrix = pairwiseSimilarity(vectors);
    expect(matrix[0 * 2 + 0]).toBeCloseTo(1);
    expect(matrix[1 * 2 + 1]).toBeCloseTo(1);
  });

  it("returns symmetric matrix", () => {
    const vectors = [
      new Map([["a", 1], ["b", 1]]),
      new Map([["b", 1], ["c", 1]]),
      new Map([["c", 1], ["d", 1]]),
    ];
    const matrix = pairwiseSimilarity(vectors);
    const n = 3;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        expect(matrix[i * n + j]).toBeCloseTo(matrix[j * n + i]);
      }
    }
  });

  it("returns 0 for orthogonal vectors", () => {
    const vectors = [
      new Map([["a", 1]]),
      new Map([["b", 1]]),
    ];
    const matrix = pairwiseSimilarity(vectors);
    expect(matrix[0 * 2 + 1]).toBeCloseTo(0);
  });

  it("handles single vector", () => {
    const vectors = [new Map([["a", 1]])];
    const matrix = pairwiseSimilarity(vectors);
    expect(matrix).toEqual([1]);
  });

  it("handles empty vector list", () => {
    const matrix = pairwiseSimilarity([]);
    expect(matrix).toEqual([]);
  });
});
