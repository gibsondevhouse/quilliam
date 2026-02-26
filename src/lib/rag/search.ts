/**
 * Vector similarity helpers for local RAG search.
 */

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface RankedVector<T> {
  item: T;
  score: number;
}

export function rankBySimilarity<T extends { vectorEmbedding?: Float32Array }>(
  query: Float32Array,
  items: T[],
  limit = 5
): RankedVector<T>[] {
  const scored: RankedVector<T>[] = [];
  items.forEach((item) => {
    if (!item.vectorEmbedding) return;
    const score = cosineSimilarity(query, item.vectorEmbedding);
    scored.push({ item, score });
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
}
