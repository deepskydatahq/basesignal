import { describe, it, expect } from "vitest";
import {
  tokenize,
  termFrequency,
  inverseDocumentFrequency,
  cosineSimilarity,
  computeTfIdfVectors,
} from "./similarity";

describe("tokenize", () => {
  it("lowercases and splits on whitespace", () => {
    expect(tokenize("Hello World")).toEqual(["hello", "world"]);
  });

  it("strips punctuation", () => {
    expect(tokenize("user's data-driven approach!")).toEqual([
      "user",
      "s",
      "data",
      "driven",
      "approach",
    ]);
  });

  it("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("handles multiple spaces", () => {
    expect(tokenize("a   b")).toEqual(["a", "b"]);
  });
});

describe("termFrequency", () => {
  it("computes normalized term frequencies", () => {
    const tf = termFrequency(["the", "cat", "sat", "the"]);
    expect(tf.get("the")).toBeCloseTo(0.5);
    expect(tf.get("cat")).toBeCloseTo(0.25);
    expect(tf.get("sat")).toBeCloseTo(0.25);
  });

  it("handles empty tokens", () => {
    const tf = termFrequency([]);
    expect(tf.size).toBe(0);
  });
});

describe("inverseDocumentFrequency", () => {
  it("computes IDF values across documents", () => {
    const docs = [
      ["the", "cat"],
      ["the", "dog"],
      ["a", "bird"],
    ];
    const idf = inverseDocumentFrequency(docs);
    // "the" appears in 2/3 docs, "cat" in 1/3
    // "the": log(4/3) + 1, "cat": log(4/2) + 1
    expect(idf.get("the")).toBeLessThan(idf.get("cat")!);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    const a = new Map([["x", 1], ["y", 2]]);
    const b = new Map([["x", 1], ["y", 2]]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Map([["x", 1]]);
    const b = new Map([["y", 1]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    const a = new Map<string, number>();
    const b = new Map<string, number>();
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

describe("computeTfIdfVectors", () => {
  it("returns one vector per input text", () => {
    const vectors = computeTfIdfVectors(["hello world", "foo bar"]);
    expect(vectors).toHaveLength(2);
  });

  it("near-identical texts produce high similarity", () => {
    const vectors = computeTfIdfVectors([
      "reduce deployment time from 45 minutes to 3 minutes with automation",
      "reduce deployment time from 45 minutes to 3 minutes via automation",
    ]);
    const sim = cosineSimilarity(vectors[0], vectors[1]);
    expect(sim).toBeGreaterThan(0.8);
  });

  it("very different texts produce low similarity", () => {
    const vectors = computeTfIdfVectors([
      "reduce deployment time from 45 minutes to 3 minutes",
      "gain visibility into team morale across departments",
    ]);
    const sim = cosineSimilarity(vectors[0], vectors[1]);
    expect(sim).toBeLessThan(0.3);
  });
});
