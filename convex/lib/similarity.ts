// Thin re-export: all pure functions live in @basesignal/core
export {
  type TfIdfVector,
  tokenize,
  termFrequency,
  inverseDocumentFrequency,
  computeTfIdfVectors,
  cosineSimilarity,
  pairwiseSimilarity,
} from "@basesignal/core";
