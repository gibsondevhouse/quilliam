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
import type { RankSimilarityRequest, RankSimilarityResultMessage } from "./messages";

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
      } catch (error) {
        console.error("Failed to hydrate embedding for node", { nodeId: node.id, error });
        return null;
      }
    }),
  );
  return hydrated.filter((n): n is RAGNode => n !== null);
}

/**
 * Asks the rag-indexer worker to rank `hydrated` nodes by cosine similarity
 * to `queryVec` and returns results in `rankBySimilarity` format.
 *
 * Uses a requestId-correlated one-shot message listener so it is safe to
 * call concurrently on the same shared worker instance.
 */
function rankViaWorker(
  worker: Worker,
  queryVec: Float32Array,
  hydrated: RAGNode[],
  topK: number,
): Promise<{ item: RAGNode; score: number }[]> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const nodeMap = new Map(hydrated.map((n) => [n.id, n]));

    const handler = (event: MessageEvent) => {
      const data = event.data as RankSimilarityResultMessage;
      if (data.type !== "rank-similarity-result" || data.requestId !== requestId) return;
      worker.removeEventListener("message", handler);
      clearTimeout(timeoutId);
      resolve(
        data.results
          .map((r) => ({ item: nodeMap.get(r.id)!, score: r.score }))
          .filter((r) => r.item !== undefined),
      );
    };

    const timeoutId = setTimeout(() => {
      worker.removeEventListener("message", handler);
      reject(new Error("rank-similarity worker timeout"));
    }, 5000);

    worker.addEventListener("message", handler);
    worker.postMessage({
      type: "rank-similarity",
      requestId,
      queryVector: queryVec,
      items: hydrated
        .filter((n) => n.vectorEmbedding !== undefined)
        .map((n) => ({ id: n.id, vector: n.vectorEmbedding! })),
      limit: topK,
    } satisfies RankSimilarityRequest);
  });
}

/**
 * Builds a markdown context block of the top-k semantically similar passages
 * for `query`.
 *
 * When `worker` is supplied the cosine similarity ranking runs off the main
 * thread via the rag-indexer worker, keeping the UI responsive during retrieval.
 *
 * Steps:
 * 1. Embed the query via `POST /api/embeddings`
 * 2. Hydrate all nodes with stored vectors from IDB
 * 3. Run cosine similarity ranking
 * 4. Format the top-k results (score threshold ≥ 0.25 to suppress noise)
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
  worker?: Worker,
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

    // Rank by cosine similarity — off main thread when a worker is available
    let ranked: { item: RAGNode; score: number }[];
    try {
      ranked = worker
        ? await rankViaWorker(worker, queryVec, hydrated, topK)
        : rankBySimilarity(queryVec, hydrated, topK);
    } catch (error) {
      console.error("Worker ranking failed, falling back to sync ranking", error);
      // Worker timeout or failure — fall back to synchronous ranking
      ranked = rankBySimilarity(queryVec, hydrated, topK);
    }
    if (ranked.length === 0) return "";

    // Score gap filter: truncate at the first consecutive score drop that
    // exceeds 40% of the preceding result's score. Naturally handles queries
    // where only 2-3 chunks are genuinely relevant without discarding later
    // strong matches on uniform-topic queries.
    let cutoff = ranked.length;
    for (let i = 1; i < ranked.length; i++) {
      if (ranked[i - 1].score > 0 && (ranked[i - 1].score - ranked[i].score) / ranked[i - 1].score > 0.4) {
        cutoff = i;
        break;
      }
    }
    const gapFiltered = ranked.slice(0, cutoff);


    const lines: string[] = ["## Semantically Relevant Passages"];
    for (const { item, score } of gapFiltered) {
      if (score < 0.25) continue; // nomic-embed-text: < 0.25 is noise (was 0.10)
      const excerpt = item.content.slice(0, 600).trim();
      if (!excerpt) continue;
      const pct = (score * 100).toFixed(0);
      lines.push(`\n### ${item.title} (relevance: ${pct}%)`);
      lines.push(excerpt + (item.content.length > 600 ? "\n[…]" : ""));
    }

    // If all results were below threshold the lines array only has the header
    return lines.length > 1 ? lines.join("\n") : "";
  } catch (error) {
    console.error("Failed to build RAG context", error);
    return "";
  }
}
