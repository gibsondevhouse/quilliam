/**
 * Query-time contextual retrieval.
 *
 * Provides two exports used by the chat pipeline:
 *
 * 1. `hydrateEmbeddings` — loads stored vectors from IndexedDB onto RAGNode objects
 *    so they can be passed to `rankBySimilarity`.
 *
 * 2. `buildRAGContext` — end-to-end: embeds the user query, hydrates nodes,
 *    ranks by cosine similarity, and returns a formatted markdown block ready
 *    to append to the Ollama system prompt.
 *
 * Both functions degrade gracefully (return empty / partial results) when
 * Ollama is unavailable or when no embeddings have been indexed yet.
 */

import type { RAGNode } from "./hierarchy";
import type { RAGStore } from "./store";
import { rankBySimilarity } from "./search";

/**
 * Attaches `vectorEmbedding: Float32Array` to every node that has a persisted
 * embedding in IndexedDB.  Nodes without a stored embedding are omitted from
 * the returned array so `rankBySimilarity` can skip the `undefined` guard.
 *
 * Runs all IDB lookups in parallel — safe because IDB transactions are
 * serialised internally.
 */
export async function hydrateEmbeddings(
  nodes: RAGNode[],
  store: RAGStore,
): Promise<RAGNode[]> {
  const hydrated = await Promise.all(
    nodes.map(async (node): Promise<RAGNode | null> => {
      try {
        const record = await store.getEmbeddingByFragment(node.id);
        if (!record || record.vector.length === 0) return null;
        return { ...node, vectorEmbedding: new Float32Array(record.vector) };
      } catch {
        return null;
      }
    }),
  );
  return hydrated.filter((n): n is RAGNode => n !== null);
}

/**
 * Builds a markdown context block of the top-k semantically similar passages
 * for `query`.
 *
 * Steps:
 * 1. Embed the query via `POST /api/embeddings`
 * 2. Hydrate all nodes with stored vectors from IDB
 * 3. Run cosine similarity ranking
 * 4. Format the top-k results (score threshold ≥ 0.10 to suppress noise)
 *
 * Returns `""` when Ollama is unreachable, no embeddings exist yet, or no
 * results pass the similarity threshold — the caller should treat an empty
 * string as "no additional context".
 */
export async function buildRAGContext(
  query: string,
  nodes: RAGNode[],
  store: RAGStore,
  model: string,
  topK = 5,
): Promise<string> {
  if (!query.trim() || nodes.length === 0) return "";

  try {
    const response = await fetch("/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: query, model }),
    });
    if (!response.ok) return "";

    const data = (await response.json()) as { embedding: number[] };
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) return "";

    const queryVec = new Float32Array(data.embedding);

    const hydrated = await hydrateEmbeddings(nodes, store);
    if (hydrated.length === 0) return "";

    const ranked = rankBySimilarity(queryVec, hydrated, topK);
    if (ranked.length === 0) return "";

    const lines: string[] = ["## Semantically Relevant Passages"];
    for (const { item, score } of ranked) {
      if (score < 0.1) continue; // suppress near-zero cosine similarity noise
      const excerpt = item.content.slice(0, 600).trim();
      if (!excerpt) continue;
      const pct = (score * 100).toFixed(0);
      lines.push(`\n### ${item.title} (relevance: ${pct}%)`);
      lines.push(excerpt + (item.content.length > 600 ? "\n[…]" : ""));
    }

    // If all results were below threshold the lines array only has the header
    return lines.length > 1 ? lines.join("\n") : "";
  } catch {
    return "";
  }
}
